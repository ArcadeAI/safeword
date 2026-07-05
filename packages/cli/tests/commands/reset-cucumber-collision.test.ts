/**
 * Uninstall/reset safety for host cucumber harnesses (ticket 56JCFZ,
 * TB1.AC3 + TB1.AC5): reset removes what safeword owns and never a host's
 * own cucumber config, deps, or files at configured paths.* locations.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  CUSTOMER_CUCUMBER_MJS,
  fileExists,
  readPackageJson,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  setupOrThrow,
  TIMEOUT_BUN_INSTALL,
  writeSafewordPathsConfig,
  writeTestFile,
} from '../helpers.js';

describe('reset leaves a host harness untouched (TB1.AC3)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory, {
      devDependencies: { typescript: '^5.0.0', '@cucumber/cucumber': '^12.0.0' },
    });
    writeTestFile(directory, 'cucumber.mjs', CUSTOMER_CUCUMBER_MJS);
    await setupOrThrow(directory);
    expect(fileExists(directory, '.safeword')).toBe(true);

    // --full engages package removal (computePackagesToRemove) — without it
    // the deps-remain assertion is vacuous, plain reset never touches deps.
    const reset = await runCli(['reset', '--full', '--yes'], { cwd: directory });
    expect(reset.exitCode, reset.stderr).toBe(0);
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC3.safeword_installed_files_are_removed', () => {
    expect(fileExists(directory, '.safeword')).toBe(false);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC3.customer_cucumber_mjs_survives_reset', () => {
    expect(fileExists(directory, 'cucumber.mjs')).toBe(true);
    expect(readTestFile(directory, 'cucumber.mjs')).toBe(CUSTOMER_CUCUMBER_MJS);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC3.customer_cucumber_deps_remain', () => {
    const packageJson = readPackageJson(directory);
    expect(packageJson.devDependencies?.['@cucumber/cucumber']).toBeDefined();
  });
});

describe('full uninstall never deletes files at configured paths locations (TB1.AC5)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    await setupOrThrow(directory);
    // The customer relocates their lane and points safeword at it.
    writeSafewordPathsConfig(directory, { installedPacks: ['typescript'] });
    writeTestFile(directory, 'tests/behaviors/demo.feature', 'Feature: demo\n');

    const reset = await runCli(['reset', '--full', '--yes'], { cwd: directory });
    expect(reset.exitCode, reset.stderr).toBe(0);
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC5.safeword_installed_files_are_removed', () => {
    expect(fileExists(directory, '.safeword')).toBe(false);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC5.configured_location_feature_file_survives', () => {
    expect(fileExists(directory, 'tests/behaviors/demo.feature')).toBe(true);
  });
});
