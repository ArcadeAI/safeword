/**
 * `safeword check` advisories for cucumber-harness misalignment (ticket
 * 56JCFZ, TB3.AC1 + TB3.AC2): persistent zero-exit warnings when a host
 * harness is detected but paths.* is unset, and when an older safeword left
 * a duplicate starter lane next to a host harness. Advisories name the exact
 * files/deps/script and never edit or delete anything.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  HOST_CUCUMBER_YAML,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  setupOrThrow,
  TIMEOUT_BUN_INSTALL,
  TIMEOUT_QUICK,
  writeSafewordPathsConfig,
  writeTestFile,
} from '../helpers.js';

async function runCheck(directory: string): Promise<string> {
  const result = await runCli(['check', '--offline'], { cwd: directory });
  return `${result.stdout}\n${result.stderr}`;
}

describe('check warns when a harness is detected and paths are unset (TB3.AC1)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    writeTestFile(directory, 'cucumber.yaml', HOST_CUCUMBER_YAML);
    await setupOrThrow(directory);
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it(
    'bdd-lane-collision-detection-and-paths.TB3.AC1.check_warns_with_the_config_lines_to_add',
    async () => {
      const output = await runCheck(directory);
      expect(output).toContain('cucumber.yaml');
      expect(output).toContain('paths.features');
      expect(output).toContain('paths.steps');
    },
    TIMEOUT_QUICK,
  );
});

describe('check stays silent when safeword’s own lane is the only harness (TB3.AC1)', () => {
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
    'bdd-lane-collision-detection-and-paths.TB3.AC1.own_lane_only_no_cucumber_advisory',
    async () => {
      const output = await runCheck(directory);
      expect(output).not.toContain('cucumber harness');
    },
    TIMEOUT_QUICK,
  );
});

describe('check stays silent once configured paths point at the detected harness (TB3.AC1)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    writeTestFile(directory, 'cucumber.yaml', HOST_CUCUMBER_YAML);
    await setupOrThrow(directory);
    // The user applies the fix the setup notice / advisory names.
    writeSafewordPathsConfig(directory, { installedPacks: ['typescript'] });
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it(
    'bdd-lane-collision-detection-and-paths.TB3.AC1.configured_paths_silence_the_advisory',
    async () => {
      const output = await runCheck(directory);
      expect(output).not.toContain('cucumber harness');
    },
    TIMEOUT_QUICK,
  );
});

describe('check enumerates a leftover duplicate scaffold without touching it (TB3.AC2)', () => {
  let directory: string;
  let cucumberMjsBefore: string;
  let starterFeatureBefore: string;
  let output: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    await setupOrThrow(directory);
    // Bitten repo: an older safeword scaffolded the lane, and the host's own
    // harness (cucumber.yaml) is also present.
    writeTestFile(directory, 'cucumber.yaml', HOST_CUCUMBER_YAML);

    cucumberMjsBefore = readTestFile(directory, 'cucumber.mjs');
    starterFeatureBefore = readTestFile(directory, 'features/safeword-lane.feature');
    output = await runCheck(directory);
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it(
    'bdd-lane-collision-detection-and-paths.TB3.AC2.leftover_scaffold_is_enumerated',
    () => {
      expect(output).toContain('cucumber.mjs');
      expect(output).toContain('features/safeword-lane.feature');
      expect(output).toContain('steps/world.ts');
      expect(output).toContain('steps/shared.steps.ts');
      expect(output).toContain('@cucumber/cucumber');
      expect(output).toContain('test:bdd');
    },
    TIMEOUT_QUICK,
  );

  it(
    'bdd-lane-collision-detection-and-paths.TB3.AC2.nothing_is_edited_or_deleted',
    () => {
      expect(readTestFile(directory, 'cucumber.mjs')).toBe(cucumberMjsBefore);
      expect(readTestFile(directory, 'features/safeword-lane.feature')).toBe(starterFeatureBefore);
    },
    TIMEOUT_QUICK,
  );
});
