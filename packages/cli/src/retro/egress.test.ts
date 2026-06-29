import { describe, expect, it } from 'vitest';

import { resolveSurface, sanitizeText, scrubSecrets } from './egress.js';

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
