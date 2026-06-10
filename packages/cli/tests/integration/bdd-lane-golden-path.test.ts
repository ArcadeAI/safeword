/**
 * Golden-path tests for the scaffolded BDD lane (ticket 102b —
 * gherkin-setup.DEV1.AC3): a freshly set-up project runs its starter feature
 * green via the `test:bdd` script, out of the box — TS and pure-Go fixtures.
 * Slow: real `safeword setup` including dependency install.
 */

import { spawnSync } from 'node:child_process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createGoProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  removeTemporaryDirectory,
  setupOrThrow,
  TIMEOUT_BUN_INSTALL,
  TIMEOUT_SETUP,
} from '../helpers.js';

function runTestBdd(directory: string): { output: string; status: number | null } {
  const result = spawnSync('bun', ['run', 'test:bdd'], {
    cwd: directory,
    encoding: 'utf8',
    timeout: TIMEOUT_SETUP,
  });
  return { output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`, status: result.status };
}

describe('scaffolded lane runs green (AC3)', () => {
  let tsDirectory: string;
  let goDirectory: string;

  beforeAll(async () => {
    tsDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(tsDirectory);
    await setupOrThrow(tsDirectory);

    goDirectory = createTemporaryDirectory();
    createGoProject(goDirectory);
    await setupOrThrow(goDirectory);
  }, TIMEOUT_BUN_INSTALL * 2);

  afterAll(() => {
    removeTemporaryDirectory(tsDirectory);
    removeTemporaryDirectory(goDirectory);
  });

  it(
    'gherkin-setup.DEV1.AC3.starter_feature_runs_green_in_a_ts_project',
    () => {
      const { output, status } = runTestBdd(tsDirectory);
      expect(status, output).toBe(0);
      expect(output).toContain('1 scenario (1 passed)');
      expect(output).not.toMatch(/undefined|pending/);
    },
    TIMEOUT_SETUP,
  );

  it(
    'gherkin-setup.DEV1.AC3.starter_feature_runs_green_in_a_pure_go_project',
    () => {
      const { output, status } = runTestBdd(goDirectory);
      expect(status, output).toBe(0);
      expect(output).toContain('1 scenario (1 passed)');
      expect(output).not.toMatch(/undefined|pending/);
    },
    TIMEOUT_SETUP,
  );
});
