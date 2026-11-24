import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

import { executeNoShellCommand } from '../../src/review/red-execution.js';

it('passes owned Electron isolation to a real child without changing the host environment', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-electron-environment-'));
  const previousPort = process.env.SOULLESS_ELECTRON_TEST_PORT;
  try {
    const result = await executeNoShellCommand({
      projectRoot: root,
      cwd: '.',
      argv: [
        process.execPath,
        '-e',
        'console.log(JSON.stringify({port:process.env.SOULLESS_ELECTRON_TEST_PORT,profile:process.env.TMPDIR,secret:process.env.SAFEWORD_REVIEW_JOB_ID}))',
      ],
      timeoutMs: 10_000,
      environment: {
        ...process.env,
        SOULLESS_ELECTRON_TEST_PORT: '6499',
        TMPDIR: path.join(root, 'owned-profile'),
        SAFEWORD_REVIEW_JOB_ID: 'must-not-reach-electron',
      },
    });
    expect(result.termination).toMatchObject({ exitCode: 0, timedOut: false });
    expect(JSON.parse(result.stdout.excerpt)).toEqual({
      port: '6499',
      profile: path.join(root, 'owned-profile'),
    });
    expect(process.env.SOULLESS_ELECTRON_TEST_PORT).toBe(previousPort);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
