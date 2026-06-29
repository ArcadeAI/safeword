// Retro egress guard — the deterministic scrub that runs before anything is
// filed. Deny-by-default: secrets and customer paths are redacted; only
// safeword-internal paths survive (reusing the spool's allowlist). Two real
// layers back this: the constrained finding schema (no field for customer code)
// and this scrubber. There is NO LLM redaction pass today — adopting
// `@secretlint/core` behind the `scrubSecrets` seam (which tracks new key
// formats) is the durable hardening; until then the pattern set below is the
// guarantee, so it errs toward over-redaction for a PUBLIC issue body.

import { safewordInternalTail } from '../../templates/hooks/lib/self-report.js';

// High-signal secret token shapes. Covers structured (`_`) AND hyphenated
// provider keys — the latter (sk-ant-…, sk-proj-…) are exactly what shows up in
// AI-coding transcripts, the dominant input here (review #543).
const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk_(?:live|test)_\w{8,}\b/g, // Stripe secret keys
  /\bsk-[\w-]{20,}\b/g, // Anthropic (sk-ant-…) / OpenAI (sk-proj-…, sk-…) keys
  /\bgh[pousr]_\w{20,}\b/g, // GitHub tokens
  /\bglpat-[\w-]{20,}\b/g, // GitLab personal access tokens
  /\bnpm_\w{30,}\b/g, // npm tokens
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bAIza[\w-]{20,}\b/g, // Google API key
  /\bxox[baprs]-[\w-]{10,}\b/g, // Slack tokens
  /\bBearer\s+[\w.=+/-]{16,}/gi, // Authorization: Bearer <token>
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/g, // JWT
  /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g, // PEM blocks
  /(?<=:\/\/)[^\s/@:]*:[^\s/@]+(?=@)/g, // [user]:pass in a connection string (redact the credentials, incl. empty-username form)
  // secret-named assignment literals: `password = "…"`, `token=…`, `api_key: …`.
  // Split in two to keep each alternation under the regex-complexity budget.
  /\b(?:password|passwd|secret|token)\s*[:=]\s*['"]?[^\s'"]{6,}/gi,
  /\b(?:api|auth|access)[_-]?(?:key|token)\s*[:=]\s*['"]?[^\s'"]{6,}/gi,
];

/** Redact high-signal secret tokens. Seam: replace with secretlint detection later. */
export function scrubSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) out = out.replaceAll(pattern, '[redacted]');
  return out;
}

// Absolute / home / Windows path tokens. The `(?<!\w)` lookbehind is the key:
// a root token (`/`, `~`, `X:\`) NOT preceded by a word char. So a customer path
// glued to a quote/paren/colon — `(/Users/…)`, `'/Users/…'`, `file:///Users/…`
// — is caught (C1), while a relative safeword tail like `hooks/stop-quality.ts`
// (whose internal `/` follows the word char `s`) is not matched and survives.
const ABSOLUTE_PATH = /(?<!\w)(?:~|\/|[a-z]:[/\\])[\w./\\-]+/gi;

/** Keep a path token only if it resolves to a safeword-internal tail, else redact. */
function keepInternalElseRedact(match: string): string {
  return safewordInternalTail(match) ?? safewordInternalTail(`.safeword/${match}`) ?? '[path]';
}

// Whether a token's core is a relative, multi-segment file path (review #543:
// only absolute paths were scrubbed before, so `src/customers/acme/secret.ts`
// leaked). Plain string ops — no backtracking regex on the path body — so prose
// with a slash (`and/or`, `TCP/IP`) is rejected (no extension) and there is no
// ReDoS surface.
function isRelativeFilePath(core: string): boolean {
  const firstSlash = core.indexOf('/');
  if (firstSlash <= 0) return false; // need a dir segment before the first slash
  if (core.startsWith('/') || core.includes('//')) return false; // absolute / URL — handled elsewhere
  const dot = core.lastIndexOf('.');
  if (dot <= core.lastIndexOf('/')) return false; // the extension must be in the basename
  const extension = core.slice(dot + 1);
  return extension.length > 0 && extension.length <= 6 && /^[a-z0-9]+$/i.test(extension);
}

// Anchored, bounded single-class peels — no backtracking. Strip wrapping
// punctuation (quotes/parens/commas) that isn't part of a path so a glued path
// still scrubs.
const LEADING_PUNCT = /^[^\w~./-]{1,64}/;
const TRAILING_PUNCT = /[^\w/-]{1,64}$/;

/** Redact one whitespace-delimited token if its core is a relative file path. */
function scrubRelativePathToken(token: string): string {
  const lead = LEADING_PUNCT.exec(token)?.[0] ?? '';
  const trail = TRAILING_PUNCT.exec(token)?.[0] ?? '';
  const core = token.slice(lead.length, token.length - trail.length);
  if (!isRelativeFilePath(core)) return token;
  return `${lead}${keepInternalElseRedact(core)}${trail}`;
}

/** Redact absolute and relative customer paths; safeword-internal tails survive. */
function scrubPaths(text: string): string {
  return text
    .replaceAll(ABSOLUTE_PATH, match => keepInternalElseRedact(match))
    .replaceAll(/\S+/g, token => scrubRelativePathToken(token));
}

const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

/** Redact email addresses. */
function scrubContacts(text: string): string {
  return text.replaceAll(EMAIL, '[email]');
}

/** Full deny-by-default scrub for a free-text field before egress. */
export function sanitizeText(text: string): string {
  return scrubContacts(scrubPaths(scrubSecrets(text)));
}

/**
 * Resolve a finding's `safeword_surface` against the spool allowlist (fail
 * closed). Returns the internal tail when the surface names a real safeword
 * location — an absolute safeword path or a bare internal tail — else undefined,
 * so the caller drops the finding. The synthetic `.safeword/` prefix routes bare
 * tails through the same separator-bounded segment + internal-prefix allowlist.
 */
export function resolveSurface(surface: string): string | undefined {
  const tail = safewordInternalTail(surface) ?? safewordInternalTail(`.safeword/${surface}`);
  if (tail === undefined) return undefined;
  // Reject path traversal and any non-path characters in the resolved tail (C2):
  // the tail is interpolated into a public issue body, so it must be a clean
  // safeword-internal path, never a `..`-laden or crafted string.
  if (tail.split('/').includes('..')) return undefined;
  if (!/^[\w./-]+$/.test(tail)) return undefined;
  return tail;
}
