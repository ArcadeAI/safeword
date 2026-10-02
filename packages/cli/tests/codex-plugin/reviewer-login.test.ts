import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseReviewerLoginOutput } from '../../src/codex-plugin/reviewer-login.js';
import { trustedReviewerExecutable } from '../../src/review/runtime.js';

describe('reviewer login output', () => {
  it('extracts the exact vendor URL and current Codex device-code shape', () => {
    expect(
      parseReviewerLoginOutput(
        'codex',
        'Open https://auth.openai.com/codex/device and enter 5T5I-3IZNL',
      ),
    ).toEqual({ auth_url: 'https://auth.openai.com/codex/device', device_code: '5T5I-3IZNL' });
    expect(
      parseReviewerLoginOutput(
        'codex',
        'Build ABCD-1234\nOpen https://auth.openai.com/codex/device\nCode 5T5I-3IZNL\n',
      ),
    ).toEqual({ auth_url: 'https://auth.openai.com/codex/device', device_code: '5T5I-3IZNL' });
  });

  it('waits for a complete code and rejects other domains', () => {
    expect(
      parseReviewerLoginOutput('codex', 'https://auth.openai.com/codex/device'),
    ).toBeUndefined();
    expect(parseReviewerLoginOutput('claude', 'https://evil.example/login')).toBeUndefined();
  });

  it('preserves the CLI-generated Claude OAuth URL', () => {
    const url = 'https://claude.com/cai/oauth/authorize?code_challenge=abc&state=def';
    expect(parseReviewerLoginOutput('claude', `Open ${url}\n`)).toEqual({ auth_url: url });
    expect(parseReviewerLoginOutput('claude', `Open ${url.slice(0, -3)}`)).toBeUndefined();
    expect(
      parseReviewerLoginOutput('claude', `\u{1B}]8;;${url}\u{7}Open link\u{1B}]8;;\u{7}`),
    ).toEqual({ auth_url: url });
  });

  it('never selects a project-controlled login executable from PATH', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-login-trust-'));
    const bin = nodePath.join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(nodePath.join(bin, 'claude'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const previousPath = process.env.PATH;
    try {
      process.env.PATH = bin;
      expect(() => trustedReviewerExecutable('claude', root)).toThrow();
    } finally {
      process.env.PATH = previousPath;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
