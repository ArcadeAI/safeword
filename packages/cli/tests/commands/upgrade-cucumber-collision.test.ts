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
  HOST_CUCUMBER_YAML,
  readTestFile,
  removeTemporaryDirectory,
  repoRoot,
  runCli,
  setupOrThrow,
  TIMEOUT_BUN_INSTALL,
  writeTestFile,
} from '../helpers.js';

const CURRENT_LANE_TEMPLATE = readFileSync(
  nodePath.join(repoRoot, 'packages/cli/templates/cucumber/cucumber.mjs'),
  'utf8',
);

// The 102a/b-era shipped revision of templates/cucumber/cucumber.mjs
// (git a874ea92) — an install from that era has exactly this content.
const PREVIOUS_TEMPLATE_REVISION = `// cucumber-js config — safeword's BDD acceptance lane, separate from your unit
// tests. \`tsx/esm\` transpiles the TypeScript step definitions on the fly;
// \`paths\` are the Gherkin \`.feature\` files. Run via \`npm run test:bdd\` (or
// \`bun run test:bdd\`). Safeword owns this file; step definitions and features
// are yours.
const workspaceFeaturePaths = [
  'features/**/*.feature',
  'packages/*/features/**/*.feature',
  'apps/*/features/**/*.feature',
  'libs/*/features/**/*.feature',
  'modules/*/features/**/*.feature',
];

const workspaceStepImports = [
  'tsx/esm',
  'steps/**/*.ts',
  'packages/*/features/steps/**/*.ts',
  'apps/*/features/steps/**/*.ts',
  'libs/*/features/steps/**/*.ts',
  'modules/*/features/steps/**/*.ts',
];

export default {
  import: workspaceStepImports,
  paths: workspaceFeaturePaths,
  tags: 'not @manual and not @live',
};
`;

describe('upgrade recognizes a previous template revision as its own scaffold (TB1.AC2)', () => {
  let directory: string;
  let upgradeOutput: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    await setupOrThrow(directory);
    // Simulate an install from an older safeword: the lane config is a
    // previously shipped template revision, not the current one.
    writeTestFile(directory, 'cucumber.mjs', PREVIOUS_TEMPLATE_REVISION);

    const upgrade = await runCli(['upgrade'], { cwd: directory });
    expect(upgrade.exitCode, upgrade.stderr).toBe(0);
    upgradeOutput = `${upgrade.stdout}\n${upgrade.stderr}`;
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC2.previous_revision_is_updated_to_current', () => {
    expect(readTestFile(directory, 'cucumber.mjs')).toBe(CURRENT_LANE_TEMPLATE);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC2.previous_revision_no_detection_notice', () => {
    expect(upgradeOutput).not.toContain('Detected an existing cucumber harness');
  });
});

describe('upgrade on a bitten repo maintains the lane without touching the host harness (TB1.AC2)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    await setupOrThrow(directory);
    // A "bitten" repo: an older safeword scaffolded the lane into a repo
    // that has its own cucumber harness (the ArcadeAI/monorepo incident).
    writeTestFile(directory, 'cucumber.mjs', PREVIOUS_TEMPLATE_REVISION);
    writeTestFile(directory, 'cucumber.yaml', HOST_CUCUMBER_YAML);

    const upgrade = await runCli(['upgrade'], { cwd: directory });
    expect(upgrade.exitCode, upgrade.stderr).toBe(0);
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC2.bitten_repo_lane_is_still_maintained', () => {
    expect(readTestFile(directory, 'cucumber.mjs')).toBe(CURRENT_LANE_TEMPLATE);
  });

  it('bdd-lane-collision-detection-and-paths.TB1.AC2.bitten_repo_host_config_is_unchanged', () => {
    expect(readTestFile(directory, 'cucumber.yaml')).toBe(HOST_CUCUMBER_YAML);
  });
});

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
