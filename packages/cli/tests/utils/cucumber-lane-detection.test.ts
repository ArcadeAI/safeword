/**
 * Unit tests for cucumber-harness detection radius (issue #708).
 *
 * Regression guard: config-file detection must reach into workspace packages,
 * not just the repo root — otherwise a bitten repo whose only cucumber config
 * lives inside a workspace package (with a hoisted root dependency) produces no
 * detection evidence, and `safeword setup` would scaffold a colliding lane. The
 * existing collision integration tests cover a workspace *dependency* and a
 * *root* config file; this pins the previously-uncovered workspace *config file*.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectCucumberLane } from '../../src/utils/project-detector.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers';

const shared: { projectDirectory: string } = { projectDirectory: '' };

beforeEach(() => {
  shared.projectDirectory = createTemporaryDirectory();
});

afterEach(() => {
  if (shared.projectDirectory) {
    removeTemporaryDirectory(shared.projectDirectory);
  }
});

describe('detectCucumberLane workspace-package config files (#708)', () => {
  it('detects a cucumber config file inside a workspace package', () => {
    writeTestFile(
      shared.projectDirectory,
      'packages/api/cucumber.js',
      'export default { paths: ["features/**/*.feature"] };\n',
    );

    const detection = detectCucumberLane(shared.projectDirectory);

    expect(detection.existingCucumberHarness).toBe('packages/api/cucumber.js');
    // Fresh repo (no safeword lane) + host harness → no starter lane scaffolded.
    expect(detection.scaffoldBddLane).toBe(false);
  });

  it('surfaces the workspace config file even with a hoisted root dependency', () => {
    // The exact issue-#708 repro: config lives only in the workspace package,
    // and @cucumber/cucumber is hoisted to the root manifest. Detection must
    // still fire (dependency OR config-file evidence is enough).
    writeTestFile(
      shared.projectDirectory,
      'package.json',
      JSON.stringify(
        { name: 'root', devDependencies: { '@cucumber/cucumber': '^13.0.0' } },
        undefined,
        2,
      ),
    );
    writeTestFile(
      shared.projectDirectory,
      'packages/web/cucumber.mjs',
      'export default { paths: ["features/**/*.feature"] };\n',
    );

    const detection = detectCucumberLane(shared.projectDirectory);

    expect(detection.existingCucumberHarness).toBe('packages/web/cucumber.mjs');
    expect(detection.scaffoldBddLane).toBe(false);
  });

  it('scaffolds the starter lane when no harness exists anywhere', () => {
    writeTestFile(shared.projectDirectory, 'package.json', '{"name":"root"}\n');

    const detection = detectCucumberLane(shared.projectDirectory);

    expect(detection.existingCucumberHarness).toBeUndefined();
    expect(detection.scaffoldBddLane).toBe(true);
  });
});
