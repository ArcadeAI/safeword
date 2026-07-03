/**
 * Upgrade-side self-exclusion for cucumber-harness detection (ticket 56JCFZ,
 * TB1.AC2): safeword never mistakes the lane it installed for a host harness.
 * Own-scaffold repos keep getting lane maintenance; previous template
 * revisions count as own scaffold; bitten repos (own lane + host config)
 * keep the lane without safeword touching the host's files.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  readTestFile,
  removeTemporaryDirectory,
  repoRoot,
  runCli,
  setupOrThrow,
  TIMEOUT_BUN_INSTALL,
} from '../helpers.js';

const CURRENT_LANE_TEMPLATE = readFileSync(
  nodePath.join(repoRoot, 'packages/cli/templates/cucumber/cucumber.mjs'),
  'utf8',
);

describe('upgrade keeps maintaining the lane safeword installed (TB1.AC2)', () => {
  let directory: string;
  let upgradeOutput: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    await setupOrThrow(directory);

    const upgrade = await runCli(['upgrade'], { cwd: directory });
    expect(upgrade.exitCode, upgrade.stderr).toBe(0);
    upgradeOutput = `${upgrade.stdout}\n${upgrade.stderr}`;
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC2.cucumber_mjs_is_still_the_template', () => {
    expect(readTestFile(directory, 'cucumber.mjs')).toBe(CURRENT_LANE_TEMPLATE);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC2.no_detected_harness_notice', () => {
    expect(upgradeOutput).not.toContain('Detected an existing cucumber harness');
  });
});
