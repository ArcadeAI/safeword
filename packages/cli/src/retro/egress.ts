// Retro egress guard — the deterministic scrub that runs before anything is
// filed. Deny-by-default: secrets and customer paths are redacted; only
// safeword-internal paths survive (reusing the spool's allowlist). Three real
// layers back this: the constrained finding schema (no field for customer code),
// the maintained `@secretlint/core` rule-packs (28 provider formats, tracked
// upstream), and the hand-rolled scrubber below.
//
// secretlint and the regex set are COMPLEMENTARY, not redundant — keep both:
//   - secretlint is PRECISE (low false-positive). It only fires on well-formed
//     keys (e.g. the anthropic rule needs the exact 108-char `sk-ant-api0[34]-`
//     shape) and its AWS rule skips access-key ids by default — so a truncated
//     key in a transcript excerpt, or a bare `AKIA…`, slips past it.
//   - the regex set is BROAD (errs toward over-redaction — the safe direction
//     for a PUBLIC issue body) and is fully synchronous, so it is also the
//     fail-open floor when secretlint throws or its dep is unavailable.
// `sanitizeTextDeep` runs secretlint first, then the sync `sanitizeText` floor.

import { lintSource } from '@secretlint/core';
import { creator } from '@secretlint/secretlint-rule-preset-recommend';

import { safewordInternalTail } from '../../templates/hooks/lib/self-report.js';

// The inert sentinel BOTH secret layers emit. Load-bearing invariant: it must
// carry no secret/path/email shape, so when `sanitizeTextDeep` runs the sync
// floor over secretlint's output the downstream passes never re-match it.
const REDACTED = '[redacted]';

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

/**
 * Redact high-signal secret tokens — the broad, synchronous floor. Catches
 * truncated/malformed keys and bare `AKIA…` access-key ids that secretlint's
 * precise rules skip; `redactKnownSecrets` layers maintained provider formats on
 * top (see `sanitizeTextDeep`).
 */
export function scrubSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) out = out.replaceAll(pattern, () => REDACTED);
  return out;
}

// One config built per module load: the recommend preset wired as a single
// preset descriptor (core expands `creator.rules` into its 28 scanners).
const SECRETLINT_CONFIG = {
  rules: [{ id: '@secretlint/secretlint-rule-preset-recommend', rule: creator }],
};

/**
 * Coalesce `[start, end)` spans into a minimal disjoint set: sort by start, then
 * fuse any span that overlaps OR abuts the previous one. This is what makes the
 * splice below correct for ANY topology secretlint reports — its pipeline only
 * de-dupes exactly-equal ranges, so two rules can report overlapping spans for
 * the same credential (e.g. basicauth ⊃ github over a credentialed URL). Without
 * coalescing, splicing overlapping spans with stale offsets can under-delete and
 * leak a secret's tail; merged disjoint spans spliced back-to-front cannot.
 */
function coalesceRanges(ranges: readonly [number, number][]): [number, number][] {
  const ascending = ranges.toSorted((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of ascending) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/**
 * Redact secrets that the maintained `@secretlint` rule-packs detect (well-formed
 * provider keys: sendgrid, linear, notion, grafana, vercel, databricks, figma,
 * cloudflare, openai, anthropic, …). Fail-OPEN at runtime: a `lintSource` error
 * (malformed source, internal rule fault) returns the text unchanged, because
 * the caller still runs the sync `scrubSecrets` floor over the result — so a
 * secretlint *runtime* failure is never less safe than the regex-only path. (A
 * missing dep is different: both packages are declared runtime `dependencies`,
 * so a failed static import would throw at module load — fail-CLOSED, the retro
 * command files nothing, which is also safe for a leak-prevention boundary.)
 */
export async function redactKnownSecrets(text: string): Promise<string> {
  if (!text) return text;
  let ranges: [number, number][];
  try {
    const result = await lintSource({
      source: { filePath: 'retro.txt', content: text, ext: '.txt', contentType: 'text' },
      options: { config: SECRETLINT_CONFIG, noPhysicFilePath: true },
    });
    ranges = result.messages
      .map(message => message.range)
      .filter((range): range is [number, number] => Array.isArray(range) && range.length === 2);
  } catch {
    return text; // floor (scrubSecrets) runs next regardless — never less safe
  }
  if (ranges.length === 0) return text;
  // Coalesce first, then redact back-to-front so each splice leaves the earlier
  // (already-disjoint) offsets valid.
  let out = text;
  for (const [start, end] of coalesceRanges(ranges).toReversed()) {
    out = `${out.slice(0, start)}${REDACTED}${out.slice(end)}`;
  }
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
 * `[path]`. An arbitrary `KEY=secret` whose name isn't allowlisted, and prefixless
 * entropy-shaped keys, are not this pass's job — the `scrubHighEntropy` backstop
 * later in the same `sanitizeText` pipeline redacts them (secretlint remains the
 * maintained detector for well-formed provider keys).
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

/** Shannon entropy of a string, in bits per character. */
function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Token-shaped runs of >=20 chars (word/base64/token alphabet, minus `=` so a
// `KEY=<token>` assignment isolates the value; `.` kept so a dot-split token —
// two sub-20 halves — is still weighed as one run). Canonical UUIDs are exempt.
// INVARIANT: `.` is the only separator added beyond the base token alphabet, so
// `runCarriesSecret` reverses the merge by splitting on `.`. If another separator
// is added here, add it to that split too or the additive-segment property breaks.
const HIGH_ENTROPY_RUN = /[\w+/.-]{20,}/g;
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Charset-aware floors, mirroring detect-secrets (hex 3.0 / base64 4.5) and its
// all-digit down-weighting. A run that mixes letters+digits (hex/base64-with-digits
// secrets) clears the low floor; a pure-alpha/pure-digit run needs the high floor,
// which sits in the gap between ordinary identifiers/words (<=~3.95) and random
// alpha tokens (>=~4.32) — so `getUserAccountBalanceById` survives while a bare
// alpha token does not, and long numbers (entropy <=log2(10)=3.32) never trip.
const MIXED_MIN_BITS = 3;
const ALPHA_MIN_BITS = 4.2;

/**
 * A run is secret-shaped when it isn't a canonical UUID and clears the
 * charset-appropriate Shannon-entropy floor: the low floor when it mixes letters
 * and digits, the higher pure-alpha floor otherwise (so identifiers, words, and
 * numbers survive but a prefixless bare-alpha token does not — SPNZKM F1).
 *
 * Accepted residual false-negatives (thin tail, backstopped by secretlint + the
 * blocklist; over-redaction is the safe direction so we don't chase them here):
 * a bare pure-alpha token under ~4.2 bits (e.g. 20-char lowercase), a pure-digit
 * secret (max log2(10)=3.32 bits — matches detect-secrets' all-digit down-weight),
 * a canonical-UUID-shaped credential, a sub-20-char token, and IPv6 / non-listed
 * internal TLDs in `scrubNetworkLocators`. Full 40-char hex (git SHAs) IS redacted
 * — accepted over-redaction under the #601 public-egress posture.
 */
function looksHighEntropySecret(run: string): boolean {
  if (CANONICAL_UUID.test(run)) return false;
  const mixesLettersAndDigits = /[a-z]/i.test(run) && /\d/.test(run);
  const floor = mixesLettersAndDigits ? MIXED_MIN_BITS : ALPHA_MIN_BITS;
  return shannonEntropy(run) >= floor;
}

/**
 * True when the run — or, since `.` now joins runs, any of its >=20-char
 * dot-separated segments — is secret-shaped. Testing segments keeps the `.`
 * merge purely additive: a segment IS a pre-`.` run, so a real secret glued to a
 * low-entropy dotted tail (which dilutes the merged entropy below the floor) is
 * still caught, while a token split across a `.` into sub-20 halves is caught by
 * the merged run (F2).
 */
function runCarriesSecret(run: string): boolean {
  if (looksHighEntropySecret(run)) return true;
  return run.split('.').some(segment => segment.length >= 20 && looksHighEntropySecret(segment));
}

/**
 * Deny-by-default entropy backstop: redact bare/prefixless high-entropy tokens and
 * `KEY=<token>` values whose key name isn't secret-shaped — the residual the
 * blocklist (`scrubSecrets`) and secretlint's precise provider rules miss (SPNZKM,
 * eng-review #601). Over-redaction is the safe direction for a PUBLIC body; the
 * charset-aware entropy floors + UUID guard keep ordinary identifiers and words intact.
 */
function scrubHighEntropy(text: string): string {
  return text.replaceAll(HIGH_ENTROPY_RUN, run => (runCarriesSecret(run) ? REDACTED : run));
}

// Valid IPv4 and internal-TLD hostnames. Any `:port` after the address is left
// intact — redacting the address alone already strips the leakable locator, and
// a nested `(?::\d{1,5})?` quantifier would trip the ReDoS guard. `[host]` carries
// no leakable shape, so downstream passes never re-match it.
const IPV4_CANDIDATE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
const INTERNAL_HOST = /\b[a-z0-9][a-z0-9.-]*\.(?:internal|local|corp|lan|intranet)\b/gi;
const HOST = '[host]';

/** Redact IPv4 addresses (octets <=255) and internal hostnames. */
function scrubNetworkLocators(text: string): string {
  const withoutIps = text.replaceAll(IPV4_CANDIDATE, run =>
    run.split('.').every(octet => Number(octet) <= 255) ? HOST : run,
  );
  return withoutIps.replaceAll(INTERNAL_HOST, () => HOST);
}

/**
 * Full deny-by-default scrub for a free-text field — the synchronous regex floor:
 * blocklist secrets, customer paths, emails, network locators, then the entropy
 * backstop for prefixless secrets the blocklist can't name. Always safe to call
 * standalone; it is also the fallback layer `sanitizeTextDeep` composes over.
 */
export function sanitizeText(text: string): string {
  let out = scrubSecrets(text);
  out = scrubPaths(out);
  out = scrubContacts(out);
  out = scrubNetworkLocators(out);
  return scrubHighEntropy(out);
}

/**
 * The egress scrub the pipeline uses: maintained `@secretlint` provider-format
 * detection FIRST (on the raw text, for best detection), then the full sync
 * `sanitizeText` floor over the result. The redacted spans become `[redacted]`,
 * which carries no secret/path/email shape, so the downstream floor passes stay
 * clean. Async only because `lintSource` is.
 */
export async function sanitizeTextDeep(text: string): Promise<string> {
  return sanitizeText(await redactKnownSecrets(text));
}

// Virtual process namespace (PNZM3B): friction with no single-file home files
// under `process/<slug>`. The surface field BYPASSES sanitizeTextDeep — this
// wall is the only egress guarantee on it — so the slug is a strict bounded
// token: lowercase alphanumerics + hyphens, ≤32 chars, non-empty.
const PROCESS_PREFIX = 'process/';

/**
 * Domain predicate: does this (already-resolved) surface live in the virtual
 * process namespace? The single answer to that question — draft labeling and
 * the reconcile sweep both key on it, so the namespace's representation can
 * change in one place.
 */
export function isProcessSurface(surface: string): boolean {
  return surface.startsWith(PROCESS_PREFIX);
}
const PROCESS_SLUG_SHAPE = /^[a-z0-9-]{1,32}$/;
const PROCESS_HEX_RUN = /^[0-9a-f]+$/;
// The entropy backstop applies to the hyphen-stripped slug from this length up
// — NOT HIGH_ENTROPY_RUN's ≥20 floor (a sub-20 hex slug must still drop), and
// not shorter, so honest mixed slugs like `sprint2-retro` survive.
const PROCESS_ENTROPY_MIN_LENGTH = 16;
// Any ≥8-char run of consecutive hex chars in the STRIPPED slug reads as a
// secret fragment — substring, not per-segment, so hyphen placement and
// low-entropy padding (`deadbe1f-zzzz…`) can't hide it (whole-ticket review).
// Accepted over-block: stripping concatenates hyphen-adjacent hex-alphabet
// words (`added-feedback` → 12 hex chars → dropped) — safe direction, rare.
const PROCESS_HEX_SUBSTRING = /[0-9a-f]{8}/;

/**
 * Secret-shape rejection: hex shapes at ANY length — the whole hyphen-stripped
 * slug being pure hex (`deadbeefcafe`, hyphen-split hex) or any ≥8-char hex
 * substring within it — plus the entropy backstop for non-hex alphabets on
 * stripped slugs ≥16 chars. Calibrated so digit-free hex-alphabet dictionary
 * words among non-hex segments (`dead-code-cleanup`) survive. Documented
 * residuals (matching the egress posture's accepted tail): sub-16-char mixed
 * alnum tokens and pure-alpha tokens (whose ≤26-symbol alphabet cannot clear
 * ALPHA_MIN_BITS below ~19 distinct chars) — both backstopped by the schema's
 * required non-surface fields and the flag-only public target.
 */
function isSecretShapedSlug(slug: string): boolean {
  const stripped = slug.replaceAll('-', '');
  if (PROCESS_HEX_RUN.test(stripped)) return true;
  if (PROCESS_HEX_SUBSTRING.test(stripped)) return true;
  return stripped.length >= PROCESS_ENTROPY_MIN_LENGTH && looksHighEntropySecret(stripped);
}

function resolveProcessSurface(slug: string): string | undefined {
  if (!PROCESS_SLUG_SHAPE.test(slug)) return undefined;
  if (isSecretShapedSlug(slug)) return undefined;
  return `${PROCESS_PREFIX}${slug}`;
}

/**
 * Resolve a finding's `safeword_surface` against the spool allowlist (fail
 * closed). Returns the internal tail when the surface names a real safeword
 * location — an absolute safeword path or a bare internal tail — or the
 * constrained `process/<slug>` virtual namespace (PNZM3B); else undefined,
 * so the caller drops the finding. The synthetic `.safeword/` prefix routes bare
 * tails through the same separator-bounded segment + internal-prefix allowlist.
 */
export function resolveSurface(surface: string): string | undefined {
  if (isProcessSurface(surface)) {
    return resolveProcessSurface(surface.slice(PROCESS_PREFIX.length));
  }
  const tail = safewordInternalTail(surface) ?? safewordInternalTail(`.safeword/${surface}`);
  if (tail === undefined) return undefined;
  // Reject path traversal and any non-path characters in the resolved tail (C2):
  // the tail is interpolated into a public issue body, so it must be a clean
  // safeword-internal path, never a `..`-laden or crafted string.
  if (tail.split('/').includes('..')) return undefined;
  if (!/^[\w./-]+$/.test(tail)) return undefined;
  return tail;
}
