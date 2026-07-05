/**
 * Integration tests for cucumber-harness collision detection at setup
 * (ticket 56JCFZ, issue #645). A repo that already has a cucumber harness
 * must not receive safeword's starter lane — no lane files, no cucumber
 * deps, no test:bdd script — and setup names the detected harness plus the
 * paths.* config lines that point safeword at it. End-to-end via the built
 * CLI on temp fixtures, mirroring setup-bdd-lane.test.ts.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  CUSTOMER_CUCUMBER_MJS,
  fileExists,
  HOST_CUCUMBER_YAML,
  readPackageJson,
  readTestFile,
  removeTemporaryDirectory,
  setupOrThrow,
  TIMEOUT_BUN_INSTALL,
  writeTestFile,
} from '../helpers.js';

const LANE_FILES = [
  'cucumber.mjs',
  'features/safeword-lane.feature',
  'steps/world.ts',
  'steps/shared.steps.ts',
] as const;

describe('setup skips the starter lane when a customer-authored cucumber.mjs exists (TB1.AC1)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    writeTestFile(directory, 'cucumber.mjs', CUSTOMER_CUCUMBER_MJS);
    await setupOrThrow(directory);
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.custom_cucumber_mjs_suppresses_lane_files', () => {
    for (const file of LANE_FILES) {
      if (file === 'cucumber.mjs') continue; // exists — it's the customer's own config
      expect(fileExists(directory, file), `${file} should not exist`).toBe(false);
    }
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.customer_cucumber_mjs_content_is_unchanged', () => {
    expect(readTestFile(directory, 'cucumber.mjs')).toBe(CUSTOMER_CUCUMBER_MJS);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.custom_cucumber_mjs_no_cucumber_dep_added', () => {
    const packageJson = readPackageJson(directory);
    expect(packageJson.devDependencies?.['@cucumber/cucumber']).toBeUndefined();
  });
});

describe('setup skips the starter lane when a workspace package depends on cucumber (TB1.AC1)', () => {
  let directory: string;
  let output: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    writeTestFile(
      directory,
      'packages/api/package.json',
      JSON.stringify(
        { name: 'api', private: true, devDependencies: { '@cucumber/cucumber': '^12.0.0' } },
        undefined,
        2,
      ),
    );
    const result = await setupOrThrow(directory);
    output = `${result.stdout}\n${result.stderr}`;
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.workspace_dep_suppresses_the_lane', () => {
    for (const file of LANE_FILES) {
      expect(fileExists(directory, file), `${file} should not exist`).toBe(false);
    }
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.workspace_dep_no_root_cucumber_dep_added', () => {
    const packageJson = readPackageJson(directory);
    expect(packageJson.devDependencies?.['@cucumber/cucumber']).toBeUndefined();
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.output_names_the_workspace_dependency', () => {
    expect(output).toContain('packages/api');
    expect(output).toContain('@cucumber/cucumber');
  });
});

describe('setup skips the starter lane when only a root cucumber dependency exists (TB1.AC1)', () => {
  let directory: string;
  let output: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory, {
      devDependencies: { typescript: '^5.0.0', '@cucumber/cucumber': '^12.0.0' },
    });
    const result = await setupOrThrow(directory);
    output = `${result.stdout}\n${result.stderr}`;
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.root_dep_suppresses_the_lane', () => {
    for (const file of LANE_FILES) {
      expect(fileExists(directory, file), `${file} should not exist`).toBe(false);
    }
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.root_dep_is_named_as_the_detected_harness', () => {
    expect(output).toContain('@cucumber/cucumber');
  });
});

describe('setup skips the starter lane when a root cucumber config exists (TB1.AC1)', () => {
  let directory: string;
  let output: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    writeTestFile(directory, 'cucumber.yaml', HOST_CUCUMBER_YAML);
    const result = await setupOrThrow(directory);
    output = `${result.stdout}\n${result.stderr}`;
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.no_starter_lane_file_is_created', () => {
    for (const file of LANE_FILES) {
      expect(fileExists(directory, file), `${file} should not exist`).toBe(false);
    }
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.no_cucumber_dependency_is_added', () => {
    const packageJson = readPackageJson(directory);
    expect(packageJson.devDependencies?.['@cucumber/cucumber']).toBeUndefined();
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.no_test_bdd_script_is_added', () => {
    const packageJson = readPackageJson(directory);
    expect(packageJson.scripts?.['test:bdd']).toBeUndefined();
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.output_names_the_detected_harness', () => {
    expect(output).toContain('cucumber.yaml');
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC1.output_shows_the_paths_config_lines', () => {
    expect(output).toContain('paths.features');
    expect(output).toContain('paths.steps');
  });
});
