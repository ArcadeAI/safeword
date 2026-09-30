import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  capturedReviewerLogin,
  startReviewerLogin,
} from '../../src/codex-plugin/reviewer-login.js';
import { trustedReviewerExecutable } from '../../src/review/runtime.js';

vi.mock('../../src/review/runtime.js', () => ({ trustedReviewerExecutable: vi.fn() }));

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('reviewer login process', () => {
  it.each([
    ['claude', ['auth', 'login'], 'https://claude.com/cai/oauth/authorize?state=abc', undefined],
    ['codex', ['login', '--device-auth'], 'https://auth.openai.com/codex/device', '5T5I-3IZNL'],
  ] as const)(
    'runs only the %s login command and returns its complete output',
    async (reviewer, expectedArguments, url, code) => {
      const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-login-process-'));
      roots.push(root);
      const script = nodePath.join(root, 'reviewer');
      const argumentFile = nodePath.join(root, 'args.json');
      const output = code === undefined ? `Open ${url}\n` : `Open ${url}\nEnter ${code}\n`;
      const midpoint = Math.floor(output.length / 2);
      const writeOutput =
        reviewer === 'claude'
          ? `process.stdout.write(${JSON.stringify(output.slice(0, midpoint))}); setTimeout(() => process.stdout.write(${JSON.stringify(output.slice(midpoint))}), 15);`
          : `process.stdout.write(${JSON.stringify(output)});`;
      writeFileSync(
        script,
        `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(argumentFile)}, JSON.stringify({args: process.argv.slice(2), cwd: process.cwd(), sentinel: process.env.SAFEWORD_UNTRUSTED_SENTINEL})); ${writeOutput}\n`,
        { mode: 0o755 },
      );
      vi.mocked(trustedReviewerExecutable).mockReturnValue(script);
      vi.stubEnv('SAFEWORD_UNTRUSTED_SENTINEL', 'project-controlled');
      const result = await startReviewerLogin(`${root}:review`, reviewer, root);
      expect(trustedReviewerExecutable).toHaveBeenCalledWith(reviewer, root);
      const spawned = JSON.parse(readFileSync(argumentFile, 'utf8')) as {
        args: string[];
        cwd: string;
        sentinel?: string;
      };
      expect(spawned.args).toEqual(expectedArguments);
      expect(spawned.cwd).not.toBe(root);
      expect(spawned.sentinel).toBeUndefined();
      expect(result).toEqual({ auth_url: url, ...(code && { device_code: code }) });
    },
  );

  it('rejects a second login for the same review while its CLI is running', async () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-login-duplicate-'));
    roots.push(root);
    const script = nodePath.join(root, 'reviewer');
    writeFileSync(
      script,
      '#!/usr/bin/env node\nprocess.stdout.write("Open https://claude.com/cai/oauth/authorize?state=abc\\n"); setTimeout(() => process.exit(0), 200);\n',
      { mode: 0o755 },
    );
    vi.mocked(trustedReviewerExecutable).mockReturnValue(script);
    const key = `${root}:review`;
    await startReviewerLogin(key, 'claude', root);
    await expect(startReviewerLogin(key, 'claude', root)).rejects.toThrow('already running');
    await vi.waitFor(() => {
      expect(capturedReviewerLogin(key)).toBeUndefined();
    });
    await expect(startReviewerLogin(key, 'claude', root)).resolves.toMatchObject({
      auth_url: 'https://claude.com/cai/oauth/authorize?state=abc',
    });
  });

  it('fails when the CLI exits before printing a sign-in URL', async () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-login-exit-'));
    roots.push(root);
    const script = nodePath.join(root, 'reviewer');
    writeFileSync(script, '#!/usr/bin/env node\nprocess.exit(7);\n', { mode: 0o755 });
    vi.mocked(trustedReviewerExecutable).mockReturnValue(script);
    await expect(startReviewerLogin(`${root}:review`, 'codex', root)).rejects.toThrow(
      'exited before printing a URL',
    );
  });
});
