// Retro egress guard — the deterministic scrub that runs before anything is
// filed. Deny-by-default: secrets and customer paths are redacted; only
// safeword-internal paths survive (reusing the spool's allowlist). This is one
// layer of defense-in-depth — the constrained schema and the independent LLM
// redaction pass back it — so the secret-pattern set is high-signal, not
// exhaustive. Swap-in point: `@secretlint/core` behind the `scrubSecrets` seam.

import { safewordInternalTail } from '../../templates/hooks/lib/self-report.js';

// High-signal secret token shapes (gitleaks-derived). Specific patterns only —
// no generic high-entropy catch-all, which over-redacts; the LLM pass covers
// unknown-shape secrets.
const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk_(?:live|test)_\w{8,}\b/g, // Stripe secret keys
  /\bgh[pousr]_\w{20,}\b/g, // GitHub tokens
  /\bglpat-[\w-]{20,}\b/g, // GitLab personal access tokens
  /\bnpm_\w{30,}\b/g, // npm tokens
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bAIza[\w-]{20,}\b/g, // Google API key
  /\bxox[baprs]-[\w-]{10,}\b/g, // Slack tokens
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/g, // JWT
  /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g, // PEM blocks
  /(?<=:\/\/)[^\s/@:]*:[^\s/@]+(?=@)/g, // [user]:pass in a connection string (redact the credentials, incl. empty-username form)
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

/** Redact absolute/home paths unless they resolve to a safeword-internal tail. */
function scrubPaths(text: string): string {
  return text.replaceAll(ABSOLUTE_PATH, match => safewordInternalTail(match) ?? '[path]');
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
