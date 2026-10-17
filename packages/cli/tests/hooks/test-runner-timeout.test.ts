import type * as childProcess from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { runTests } from '../../../../.safeword/hooks/lib/test-runner';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
// Only the suite subprocess is replaced. Plan resolution and hook wiring are real.
vi.mock('node:child_process', async importOriginal => ({
  ...(await importOriginal<typeof childProcess>()),
  execSync: execute,
}));

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
  vi.unstubAllEnvs();
  execute.mockReset();
});

it('reports a synchronous timeout without relying on the absent killed property', () => {
  let timeoutError: unknown;
  try {
    execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], { timeout: 20 });
  } catch (error) {
    timeoutError = error;
  }
  expect(timeoutError).toMatchObject({ code: 'ETIMEDOUT' });
  execute.mockImplementation(() => {
    throw timeoutError;
  });
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-timeout-'));
  directories.push(directory);
  writeFileSync(nodePath.join(directory, 'package-lock.json'), '{}');
  writeFileSync(
    nodePath.join(directory, 'package.json'),
    JSON.stringify({
      scripts: { 'test:bdd': 'node acceptance.js' },
    }),
  );
  vi.stubEnv('SAFEWORD_CLI', nodePath.resolve(import.meta.dirname, '../../src/cli.ts'));
  vi.stubEnv('SAFEWORD_FAKE_TOOLS', 'all');

  const result = runTests(directory);

  expect(result.passed).toBe(false);
  expect(result.skipped).toBe(false);
  expect(result.toolchainMissing).not.toBe(true);
  expect(result.output).toContain('npm run test:bdd');
  expect(result.output).toContain('timed out after 480s');
});
