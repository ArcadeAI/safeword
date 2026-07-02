import { describe, expect, it } from 'vitest';

import {
  redactKnownSecrets,
  resolveSurface,
  sanitizeText,
  sanitizeTextDeep,
  scrubSecrets,
} from './egress.js';

describe('sanitizeText', () => {
  it('retro-transcript-mining.NTB1.AC2.secret_in_free_text_is_redacted', () => {
    const out = sanitizeText('the env held sk_live_TESTONLY1 and it broke');
    expect(out).not.toContain('sk_live_TESTONLY1');
    expect(out).toContain('[redacted]');
  });

  it('retro-transcript-mining.NTB1.AC2.customer_path_redacted_safeword_path_kept', () => {
    const out = sanitizeText(
      'editing /Users/jdoe/app/src/billing.ts when the gate in hooks/stop-quality.ts fired',
    );
    expect(out).not.toContain('/Users/jdoe/app/src/billing.ts');
    expect(out).toContain('hooks/stop-quality.ts');
  });

  it('redacts an absolute safeword path down to its internal tail, not [path]', () => {
    const out = sanitizeText('thrown from /Users/jdoe/proj/.safeword/hooks/stop-quality.ts here');
    expect(out).toContain('hooks/stop-quality.ts');
    expect(out).not.toContain('/Users/jdoe/proj');
  });

  it('redacts a variety of secret token shapes', () => {
    expect(scrubSecrets('ghp_abcdefghijklmnopqrstuvwxyz0123456789')).toContain('[redacted]');
    expect(scrubSecrets('AKIA1234567890ABCDEF')).toContain('[redacted]');
    expect(scrubSecrets('key AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345')).toContain('[redacted]');
  });

  // C1 (review): paths NOT at a whitespace boundary previously leaked.
  it('redacts customer paths glued to punctuation, quotes, and stack frames', () => {
    const cases = [
      'at Object.<anonymous> (/Users/jane/app/index.js:1:1)',
      "ENOENT: '/Users/jane/proj/.env'",
      'import from "/Users/jane/app/lib.ts"',
      'file:///Users/jane/secret/config.ts',
    ];
    for (const text of cases) {
      const out = sanitizeText(text);
      expect(out).not.toContain('/Users/jane');
    }
  });

  // C4 (review): credentials inside a connection string previously leaked.
  it('redacts the password in a connection string', () => {
    const out = sanitizeText('db at postgres://admin:hunter2@db.internal:5432/app failed');
    expect(out).not.toContain('hunter2');
  });

  it('redacts a password-only connection string (empty username)', () => {
    expect(scrubSecrets('cache at redis://:justpassword@host:6379')).not.toContain('justpassword');
  });

  it('redacts GitLab and npm token shapes', () => {
    expect(scrubSecrets('glpat-abcdefghijklmnopqrst')).toContain('[redacted]');
    expect(scrubSecrets('npm_abcdefghijklmnopqrstuvwxyz0123456789AB')).toContain('[redacted]');
  });

  // Review (#543): hyphenated LLM-provider keys are exactly what appears in AI
  // coding transcripts, and retro files into the PUBLIC repo. These previously
  // leaked because every prior pattern assumed `_`/structured shapes.
  it('redacts Anthropic and OpenAI key shapes (hyphenated)', () => {
    expect(scrubSecrets('key sk-ant-api03-AbCdEf012345_-ghIJklMnOpQrStuv')).not.toContain('sk-ant');
    expect(scrubSecrets('OPENAI=sk-proj-AbCdEf012345ghIJklMnOpQr')).not.toContain('sk-proj');
    expect(scrubSecrets('legacy sk-AbCdEf012345ghIJklMnOpQrStuv')).toContain('[redacted]');
  });

  it('does not redact ordinary hyphenated words that merely start with sk-', () => {
    // Guard against over-redaction: short non-key tokens must survive.
    expect(scrubSecrets('the sk-cli flag and task-runner')).toBe('the sk-cli flag and task-runner');
  });

  it('redacts a Bearer token', () => {
    expect(scrubSecrets('Authorization: Bearer abcdef0123456789ABCDEF0123')).not.toContain(
      'abcdef0123456789',
    );
  });

  it('redacts secret-looking assignment literals', () => {
    expect(scrubSecrets('password = "hunter2pass"')).not.toContain('hunter2pass');
    expect(scrubSecrets('api_key: s3cr3t_value_here')).not.toContain('s3cr3t_value_here');
  });
});

describe('sanitizeText — relative customer paths (review #543)', () => {
  it('redacts a relative customer path but keeps a safeword-internal relative tail', () => {
    const out = sanitizeText('edited src/customers/acme/secret.ts via hooks/stop-quality.ts');
    expect(out).not.toContain('src/customers/acme/secret.ts');
    expect(out).toContain('[path]');
    expect(out).toContain('hooks/stop-quality.ts'); // safeword-internal tail survives
  });

  it('leaves ordinary prose with a slash untouched', () => {
    // and/or, he/she, TCP/IP — not paths; must not become [path].
    expect(sanitizeText('weigh the and/or case for TCP/IP')).toBe(
      'weigh the and/or case for TCP/IP',
    );
  });

  // Review #543 round 2 — verified-by-construction leaks the first pass missed.
  it('redacts a Windows backslash relative path (C6)', () => {
    expect(sanitizeText(String.raw`edited src\customers\acme\secret.ts`)).not.toContain(
      'customers',
    );
  });

  it('redacts a relative path glued to surrounding text (C7)', () => {
    expect(sanitizeText('see(src/customers/acme/secret.ts)here')).not.toContain(
      'src/customers/acme/secret.ts',
    );
  });

  it('redacts a path carrying a query string (C8)', () => {
    expect(sanitizeText('fetched config/customers/acme.json?token=value')).not.toContain(
      'config/customers/acme.json',
    );
  });
});

describe('scrubSecrets — formats from review #543 round 2', () => {
  it('redacts a GitHub fine-grained PAT (C1)', () => {
    const pat = 'github_pat_11ABCDEFG0aBcDeFgHiJkL_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abcdef';
    expect(scrubSecrets(pat)).not.toContain('github_pat_11');
  });

  it('redacts a Slack app-level token (C2)', () => {
    expect(scrubSecrets('xapp-1-A01234567-1234567890123-abcdef0123456789abcdef')).toContain(
      '[redacted]',
    );
  });

  it('redacts an Authorization: Basic header (C3)', () => {
    expect(scrubSecrets('Authorization: Basic dXNlcjpwYXNzd29yZA==')).not.toContain(
      'dXNlcjpwYXNzd29yZA',
    );
  });

  it('redacts underscore-prefixed secret names like aws_secret / client_secret (C4)', () => {
    expect(scrubSecrets('aws_secret = wJalrXUtnFEMIK7MDENGbPxRfi')).not.toContain('wJalrXUtnFEMIK');
    expect(scrubSecrets('client_secret: abc123def456ghi')).not.toContain('abc123def456ghi');
  });
});

// SPNZKM: the maintained @secretlint rule-packs catch well-formed modern
// provider keys that the broad regex floor does not target. These prove the
// secretlint layer (via sanitizeTextDeep / redactKnownSecrets) actually fires.
describe('sanitizeTextDeep — secretlint provider-format coverage (SPNZKM)', () => {
  it('redacts a well-formed Anthropic key (exact 108-char shape the regex floor would miss-classify)', async () => {
    const key = `sk-ant-api03-${'A'.repeat(93)}AA`;
    const out = await sanitizeTextDeep(`the call used ${key} and failed`);
    expect(out).not.toContain(key);
    expect(out).toContain('[redacted]');
  });

  it('redacts a SendGrid key, which has no dedicated regex-floor pattern', async () => {
    const key = `SG.${'a'.repeat(22)}.${'b'.repeat(43)}`;
    const out = await sanitizeTextDeep(`mailer key ${key} leaked`);
    expect(out).not.toContain(key);
    expect(out).toContain('[redacted]');
  });

  it('still applies the sync floor (paths, emails) alongside the secretlint pass', async () => {
    const out = await sanitizeTextDeep('mailed jane@corp.example from /Users/jane/app/secret.ts');
    expect(out).not.toContain('jane@corp.example');
    expect(out).not.toContain('/Users/jane/app/secret.ts');
  });

  it('redactKnownSecrets returns clean text unchanged (no false positives)', async () => {
    const clean = 'the coverage gate blocked with no file and no number';
    expect(await redactKnownSecrets(clean)).toBe(clean);
  });

  it('redactKnownSecrets isolates the secretlint layer for a secretlint-only key', async () => {
    // sendgrid has NO regex-floor pattern — proves redactKnownSecrets itself fired.
    const key = `SG.${'a'.repeat(22)}.${'b'.repeat(43)}`;
    const out = await redactKnownSecrets(`key ${key} here`);
    expect(out).not.toContain(key);
    expect(out).toContain('[redacted]');
  });

  // Review (independent pass): @secretlint can report OVERLAPPING ranges for one
  // credential (basicauth ⊃ github over a credentialed URL). The splice must
  // coalesce them — a naive descending-by-start splice with stale offsets can
  // leak the secret's tail. Verify the whole credential is gone, no remnant.
  it('fully redacts a credential covered by overlapping secretlint ranges', async () => {
    // Assembled (not a single literal) so the lint-kit secret scanner doesn't
    // flag the fixture; shape is a GitHub PAT inside a credentialed clone URL.
    const ghToken = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('_');
    const out = await redactKnownSecrets(`clone https://git:${ghToken}@github.com/x/y.git`);
    expect(out).not.toContain(ghToken);
    expect(out).not.toContain('ghp_');
    expect(out).toContain('[redacted]');
  });
});

// SPNZKM / eng-review #601: the blocklist misses secrets with no known prefix.
// A deny-by-default entropy backstop + network-locator scrub close the residual,
// layered UNDER the blocklist + secretlint. Over-redaction is the safe direction
// for a PUBLIC body, but must not nuke ordinary identifiers/words/UUIDs.
describe('sanitizeText — entropy + network backstop (SPNZKM, #601 egress review)', () => {
  it('redacts a bare high-entropy token with no known prefix', () => {
    const hex40 = 'deadbeefcafebabe0123456789abcdef01234567';
    const b64 = 'Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3A';
    expect(sanitizeText(`token ${hex40} leaked`)).not.toContain(hex40);
    expect(sanitizeText(`token ${hex40} leaked`)).toContain('[redacted]');
    expect(sanitizeText(`blob ${b64} here`)).not.toContain(b64);
  });

  it('redacts a value-only assignment whose key name is not secret-shaped', () => {
    // MYVAR is not password/token/api_key — the blocklist misses it; entropy catches the value.
    const out = sanitizeText('env MYVAR=a8f3c9e1b7d24506f8a1c3e5d7 set');
    expect(out).not.toContain('a8f3c9e1b7d24506f8a1c3e5d7');
    expect(out).toContain('[redacted]');
  });

  it('redacts a prefixless pure-alpha high-entropy token (charset-aware tier, F1)', () => {
    // No digit, so the letters+digits gate misses it; a random alpha token clears the
    // higher pure-alpha entropy floor (>=4.2) where identifiers/words (<3.95) do not.
    const alphaToken = 'QxZvBnMkLpWsEdRfTgYhUjIm'; // 24-char mixed-case, entropy ~4.58
    const out = sanitizeText(`session ${alphaToken} opened`);
    expect(out).not.toContain(alphaToken);
    expect(out).toContain('[redacted]');
  });

  it('redacts a dot-split high-entropy token as one run (F2)', () => {
    // Sub-20-char halves individually; the `.` keeps them one run so the value is caught.
    const dotted = 'abcd1234efgh5678.ijkl9012mnop3456';
    const out = sanitizeText(`cursor ${dotted} paged`);
    expect(out).not.toContain(dotted);
    expect(out).toContain('[redacted]');
  });

  it('redacts private IPs (with port) and internal hostnames', () => {
    // Assemble from octets so the literal IP never appears in source (sonarjs/no-hardcoded-ip).
    const privateIp = ['10', '1', '2', '3'].join('.');
    const routerIp = ['192', '168', '0', '42'].join('.');
    expect(sanitizeText(`connected to ${privateIp}:5432 ok`)).not.toContain(privateIp);
    expect(sanitizeText(`reached ${routerIp} fine`)).not.toContain(routerIp);
    expect(sanitizeText('resolved db-primary.internal now')).not.toContain('db-primary.internal');
  });

  it('does NOT redact ordinary identifiers, long words, UUIDs, or versions (no gratuitous FP)', () => {
    const survivors = [
      'the getUserAccountBalanceById call regressed',
      'the handleUserAuthenticationFlow helper timed out', // ~3.94, just under the 4.2 tier
      'internationalization of the message catalog',
      'the task-runner-config-loader module',
      'request id 550e8400-e29b-41d4-a716-446655440000 logged',
      'the ledger showed 1234509876542345678901234 events', // long pure-digit: max entropy < 4.2
      'bumped to version 1.2.3 today',
    ];
    for (const text of survivors) {
      expect(sanitizeText(text)).toBe(text);
    }
  });
});

describe('resolveSurface (fail-closed)', () => {
  it('resolves a bare safeword-internal tail', () => {
    expect(resolveSurface('hooks/stop-quality.ts')).toBe('hooks/stop-quality.ts');
    expect(resolveSurface('packages/cli/src/commands/retro.ts')).toBe(
      'packages/cli/src/commands/retro.ts',
    );
  });

  it('resolves an absolute safeword path to its internal tail', () => {
    expect(resolveSurface('/Users/jdoe/p/.safeword/hooks/stop-quality.ts')).toBe(
      'hooks/stop-quality.ts',
    );
  });

  it('drops a non-safeword (customer) surface', () => {
    expect(resolveSurface('src/billing.ts')).toBeUndefined();
    expect(resolveSurface('/Users/jdoe/app/src/billing.ts')).toBeUndefined();
  });

  // C2 (review): a `..`-laden tail must not resolve past the allowlist.
  it('rejects path-traversal in the surface tail', () => {
    expect(resolveSurface('hooks/../../../etc/passwd')).toBeUndefined();
    expect(resolveSurface('.safeword/hooks/../../../etc/passwd')).toBeUndefined();
  });
});
