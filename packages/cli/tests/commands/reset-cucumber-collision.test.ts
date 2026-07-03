/**
 * Uninstall/reset safety for host cucumber harnesses (ticket 56JCFZ,
 * TB1.AC3 + TB1.AC5): reset removes what safeword owns and never a host's
 * own cucumber config, deps, or files at configured paths.* locations.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  setupOrThrow,
  TIMEOUT_BUN_INSTALL,
  writeTestFile,
} from '../helpers.js';

interface PackageJsonShape {
  devDependencies?: Record<string, string>;
}

describe('reset leaves a host harness untouched (TB1.AC3)', () => {
  let directory: string;
  const CUSTOMER_CONFIG = 'export default { paths: ["acceptance/**/*.feature"] };\n';

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory, {
      devDependencies: { typescript: '^5.0.0', '@cucumber/cucumber': '^12.0.0' },
    });
    writeTestFile(directory, 'cucumber.mjs', CUSTOMER_CONFIG);
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
    expect(readTestFile(directory, 'cucumber.mjs')).toBe(CUSTOMER_CONFIG);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC3.customer_cucumber_deps_remain', () => {
    const packageJson = JSON.parse(readTestFile(directory, 'package.json')) as PackageJsonShape;
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
    writeTestFile(
      directory,
      '.safeword/config.json',
      JSON.stringify(
        {
          installedPacks: ['typescript'],
          paths: { features: 'tests/behaviors', steps: 'tests/steps' },
        },
        undefined,
        2,
      ),
    );
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
