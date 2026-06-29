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
  /\bgh[pousr]_\w{20,}\b/g, // GitHub classic/oauth tokens
  /\bgithub_pat_\w{20,}\b/g, // GitHub fine-grained PAT (the current default format)
  /\bglpat-[\w-]{20,}\b/g, // GitLab personal access tokens
  /\bnpm_\w{30,}\b/g, // npm tokens
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key id
  /\bAIza[\w-]{20,}\b/g, // Google API key
  /\b(?:xox[baprs]|xapp)-[\w-]{10,}\b/g, // Slack bot/user/app-level tokens
  /\b(?:Bearer|Basic)\s+[\w.=+/-]{16,}/gi, // Authorization: Bearer/Basic <token> (Basic carries base64 user:pass)
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b/g, // JWT
  /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g, // PEM blocks
  /(?<=:\/\/)[^\s/@:]*:[^\s/@]+(?=@)/g, // [user]:pass in a connection string (redact the credentials, incl. empty-username form)
  // secret-named assignment literals: `password = "…"`, `token=…`, `aws_secret: …`.
  // `(?<![a-z0-9])` (not `\b`) so an underscored prefix — `aws_secret`,
  // `client_secret` — still matches (the keyword is preceded by `_`, a word char,
  // which `\b` would miss). Split in two to stay under the regex-complexity budget.
  /(?<![a-z0-9])(?:password|passwd|secret|token)\s*[:=]\s*['"]?[^\s'"]{6,}/gi,
  /(?<![a-z0-9])(?:api|auth|access)[_-]?(?:key|token)\s*[:=]\s*['"]?[^\s'"]{6,}/gi,
];

/** Redact high-signal secret tokens. Seam: replace with secretlint detection later. */
export function scrubSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) out = out.replaceAll(pattern, '[redacted]');
  return out;
}

// A run of path characters. Surrounding punctuation (quotes, parens, `?`, `:`,
// `,`) is NOT in the class, so it delimits runs — which is what catches a path
// glued to text or wrapped in punctuation (`(…secret.ts)here`,
// `acme.json?token=…`) and isolates the path from a query string (review #543
// C7/C8). Single class, no nested quantifier → no ReDoS surface.
const PATH_CANDIDATE = /[\w~./\\-]+/g;

/** A run that begins at a filesystem root: POSIX `/`, home `~`, or a drive `X:/`. */
function isAbsolutePath(run: string): boolean {
  return run.startsWith('/') || run.startsWith('~') || /^[a-z]:\//i.test(run);
}

// A relative, multi-segment file path: `src/customers/acme/secret.ts` (review
// #543 — only absolute paths were scrubbed before). Plain string ops, so prose
// with a slash (`and/or`, `TCP/IP`) is rejected (no extension) and there is no
// ReDoS surface. Operates on a `/`-normalized run so Windows `src\…\x.ts` (C6)
// is covered too.
function isRelativeFilePath(run: string): boolean {
  const firstSlash = run.indexOf('/');
  if (firstSlash <= 0) return false; // need a dir segment before the first slash
  if (run.startsWith('/') || run.includes('//')) return false; // absolute / URL handled by isAbsolutePath
  const dot = run.lastIndexOf('.');
  if (dot <= run.lastIndexOf('/')) return false; // the extension must be in the basename
  const extension = run.slice(dot + 1);
  return extension.length > 0 && extension.length <= 6 && /^[a-z0-9]+$/i.test(extension);
}

/**
 * Redact absolute and relative customer paths; safeword-internal tails survive
 * the allowlist. Backslashes are normalized to `/` for analysis so Windows
 * relative paths are covered. Over-redaction note (accepted, safe direction for a
 * PUBLIC body): non-safeword relative paths like `tests/foo.test.ts` also become
 * `[path]`. Residual: an arbitrary `KEY=secret` whose name isn't allowlisted, and
 * 40-char entropy-shaped keys with no prefix, are NOT caught here — secretlint
 * (ticket SPNZKM) is the durable fix.
 */
function scrubPaths(text: string): string {
  return text.replaceAll(PATH_CANDIDATE, run => {
    const normalized = run.replaceAll('\\', '/');
    if (!isAbsolutePath(normalized) && !isRelativeFilePath(normalized)) return run;
    return (
      safewordInternalTail(normalized) ??
      safewordInternalTail(`.safeword/${normalized}`) ??
      '[path]'
    );
  });
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
