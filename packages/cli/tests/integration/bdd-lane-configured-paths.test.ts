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
  INSTALL_DEPENDENCIES_ENV,
  removeTemporaryDirectory,
  setupOrThrow,
  TIMEOUT_BUN_INSTALL,
  TIMEOUT_SETUP,
  UNPARSEABLE_LANE_CONFIG,
  writeTestFile,
} from '../helpers.js';

function runTestBdd(
  directory: string,
  cucumberArguments: readonly string[] = [],
): { output: string; status: number | null } {
  const forwarded = cucumberArguments.length > 0 ? ['--', ...cucumberArguments] : [];
  const result = spawnSync('bun', ['run', 'test:bdd', ...forwarded], {
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
    await setupOrThrow(directory, ['setup', '--yes'], { env: INSTALL_DEPENDENCIES_ENV });
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it(
    'runs only the selected scenario when a feature path carries a line selector',
    () => {
      const featureLines = [
        'Feature: Line selector',
        '',
        '  Scenario: unselected scenario',
        '    When the unselected scenario runs',
        '',
        '  Scenario: selected scenario',
        '    When the selected scenario runs',
        '',
      ];
      const selectedLine = featureLines.indexOf('  Scenario: selected scenario') + 1;
      writeTestFile(directory, 'features/line-selector.feature', featureLines.join('\n'));
      writeTestFile(
        directory,
        'steps/line-selector.steps.ts',
        [
          "import { When } from '@cucumber/cucumber';",
          '',
          "When('the selected scenario runs', function () {",
          '  // Scenario reached.',
          '});',
          '',
          "When('the unselected scenario runs', function () {",
          "  throw new Error('unselected scenario ran despite the line selector');",
          '});',
          '',
        ].join('\n'),
      );
      try {
        const { output, status } = runTestBdd(directory, [
          `features/line-selector.feature:${selectedLine}`,
          '--format',
          'summary',
        ]);
        // The unselected scenario throws, so a pass means it did not run; the
        // count rules out the starter feature riding along on default globs.
        expect(status, output).toBe(0);
        expect(output).toContain('1 scenario (1 passed)');
      } finally {
        rmSync(nodePath.join(directory, 'features/line-selector.feature'), { force: true });
        rmSync(nodePath.join(directory, 'steps/line-selector.steps.ts'), { force: true });
      }
    },
    TIMEOUT_SETUP,
  );

  it(
    'runs only the targeted directory when a directory path is passed',
    () => {
      writeTestFile(
        directory,
        'features/targeted/targeted.feature',
        [
          'Feature: Targeted directory',
          '',
          '  Scenario: targeted scenario',
          '    When the targeted scenario runs',
          '',
        ].join('\n'),
      );
      writeTestFile(
        directory,
        'features/untargeted.feature',
        [
          'Feature: Untargeted',
          '',
          '  Scenario: untargeted scenario',
          '    When the untargeted scenario runs',
          '',
        ].join('\n'),
      );
      writeTestFile(
        directory,
        'steps/targeted.steps.ts',
        [
          "import { When } from '@cucumber/cucumber';",
          '',
          "When('the targeted scenario runs', function () {",
          '  // Scenario reached.',
          '});',
          '',
          "When('the untargeted scenario runs', function () {",
          "  throw new Error('untargeted scenario ran despite the directory path');",
          '});',
          '',
        ].join('\n'),
      );
      try {
        // A trailing slash is a valid Cucumber directory path that no exact
        // directory-name match recognizes.
        const { output, status } = runTestBdd(directory, [
          'features/targeted/',
          '--format',
          'summary',
        ]);
        expect(status, output).toBe(0);
        expect(output).toContain('1 scenario (1 passed)');
      } finally {
        rmSync(nodePath.join(directory, 'features/targeted'), { force: true, recursive: true });
        rmSync(nodePath.join(directory, 'features/untargeted.feature'), { force: true });
        rmSync(nodePath.join(directory, 'steps/targeted.steps.ts'), { force: true });
      }
    },
    TIMEOUT_SETUP,
  );

  it(
    'keeps workspace feature directories when an option value ends in .feature',
    () => {
      writeTestFile(
        directory,
        'packages/demo/features/option-value.feature',
        [
          'Feature: Option value',
          '',
          '  Scenario: option-value feature in a workspace package',
          '    When the workspace package scenario runs',
          '',
        ].join('\n'),
      );
      writeTestFile(
        directory,
        'packages/demo/features/steps/option-value.steps.ts',
        [
          "import { When } from '@cucumber/cucumber';",
          '',
          "When('the workspace package scenario runs', function () {",
          '  // Scenario reached.',
          '});',
          '',
        ].join('\n'),
      );
      try {
        // `--name` takes a regular expression; this one ends in `.feature` and
        // matches the workspace scenario's name. Read as a feature path, it
        // would drop the workspace globs and the scenario would never be found.
        const { output, status } = runTestBdd(directory, [
          '--name',
          'option-value.feature',
          '--format',
          'summary',
        ]);
        expect(status, output).toBe(0);
        expect(output).toContain('1 scenario (1 passed)');
      } finally {
        rmSync(nodePath.join(directory, 'packages'), { force: true, recursive: true });
      }
    },
    TIMEOUT_SETUP,
  );

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
      writeTestFile(directory, '.safeword/config.json', UNPARSEABLE_LANE_CONFIG);

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
