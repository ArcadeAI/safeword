/**
 * Real cucumber-js runs for configured lane paths (ticket 56JCFZ, TB2.AC2 +
 * TB2.AC3): the scaffolded cucumber.mjs reads `paths.features`/`paths.steps`
 * from .safeword/config.json at runtime and AUGMENTS its default globs;
 * missing or unparseable config falls back to default behavior. Slow: real
 * `safeword setup` including dependency install, then `bun run test:bdd`.
 */

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  removeTemporaryDirectory,
  setupOrThrow,
  TIMEOUT_BUN_INSTALL,
  TIMEOUT_SETUP,
  writeTestFile,
} from '../helpers.js';

function runTestBdd(directory: string): { output: string; status: number | null } {
  const result = spawnSync('bun', ['run', 'test:bdd'], {
    cwd: directory,
    encoding: 'utf8',
    timeout: TIMEOUT_SETUP,
  });
  return { output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`, status: result.status };
}

function addConfiguredLane(directory: string): void {
  writeTestFile(
    directory,
    'tests/behaviors/relocated.feature',
    [
      'Feature: Relocated feature',
      '',
      '  Scenario: configured directory scenario runs',
      '    When the relocated feature runs',
      '    Then the relocated result is visible',
      '',
    ].join('\n'),
  );
  writeTestFile(
    directory,
    'tests/steps/relocated.steps.ts',
    [
      "import { Then, When } from '@cucumber/cucumber';",
      '',
      "When('the relocated feature runs', function () {",
      '  // Scenario reached.',
      '});',
      '',
      "Then('the relocated result is visible', function () {",
      '  // Assertion is the step binding itself; undefined steps would fail the lane.',
      '});',
      '',
    ].join('\n'),
  );
}

describe('scaffolded runner honors configured paths (TB2.AC2 + TB2.AC3)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    await setupOrThrow(directory);
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it(
    'bdd-lane-collision-detection-and-paths.TB2.AC3.runner_defaults_apply_without_a_config_file',
    () => {
      rmSync(nodePath.join(directory, '.safeword/config.json'), { force: true });

      const { output, status } = runTestBdd(directory);
      expect(status, output).toBe(0);
      expect(output).toContain('1 scenario (1 passed)');
    },
    TIMEOUT_SETUP,
  );

  it(
    'bdd-lane-collision-detection-and-paths.TB2.AC3.runner_falls_back_when_config_is_unparseable',
    () => {
      writeTestFile(directory, '.safeword/config.json', '{ not json !!!');

      const { output, status } = runTestBdd(directory);
      expect(status, output).toBe(0);
      expect(output).toContain('1 scenario (1 passed)');
    },
    TIMEOUT_SETUP,
  );

  it(
    'bdd-lane-collision-detection-and-paths.TB2.AC2.configured_and_default_scenarios_both_run',
    () => {
      addConfiguredLane(directory);
      writeTestFile(
        directory,
        '.safeword/config.json',
        JSON.stringify(
          { paths: { features: 'tests/behaviors', steps: 'tests/steps' } },
          undefined,
          2,
        ),
      );

      const { output, status } = runTestBdd(directory);
      expect(status, output).toBe(0);
      // Starter lane scenario (default dirs) + relocated scenario (configured dirs).
      expect(output).toContain('2 scenarios (2 passed)');
      expect(output).not.toMatch(/undefined|pending/);
    },
    TIMEOUT_SETUP,
  );
});
