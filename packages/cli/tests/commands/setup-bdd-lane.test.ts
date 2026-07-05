/**
 * Integration tests for the BDD acceptance-lane scaffold (ticket 102b —
 * gherkin-setup.DEV1.AC1 + AC2). `safeword setup` scaffolds the cucumber-js
 * lane as core output in any project; a repo with no package.json gets a
 * minimal private one (Option A: the full JS toolchain comes along — the lane's
 * step files are TypeScript and need linting). End-to-end via the built CLI on
 * temp fixtures. The runs-green proof (AC3) lives in
 * tests/integration/bdd-lane-golden-path.test.ts.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createGoProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  readPackageJson,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  setupOrThrow,
  SKIP_SKILLS_ENV,
  TIMEOUT_BUN_INSTALL,
  TIMEOUT_QUICK,
  writeTestFile,
} from '../helpers.js';

const LANE_FILES = [
  'cucumber.mjs',
  'features/safeword-lane.feature',
  'steps/world.ts',
  'steps/shared.steps.ts',
] as const;

describe('setup scaffolds the lane in a TS project (AC1)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    await setupOrThrow(directory);
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('gherkin-setup.DEV1.AC1.ts_project_gets_the_lane_files', () => {
    for (const file of LANE_FILES) {
      expect(fileExists(directory, file), `${file} should exist`).toBe(true);
    }
  });

  it('gherkin-linting.DEV1.AC1.ts_project_uses_safeword_owned_gherkin_linting', () => {
    expect(fileExists(directory, '.safeword/.gherkin-lintrc')).toBe(false);
  });

  it('gherkin-setup.DEV1.AC1.deps_and_script_are_added', () => {
    const packageJson = readPackageJson(directory);
    expect(packageJson.devDependencies?.['@cucumber/cucumber']).toBeDefined();
    expect(packageJson.devDependencies?.['gherkin-lint']).toBeUndefined();
    expect(packageJson.devDependencies?.tsx).toBeDefined();
    expect(packageJson.scripts?.['lint:gherkin']).toBe('safeword lint-gherkin');
    expect(packageJson.scripts?.['test:bdd']).toContain('cucumber-js');
  });
});

describe('setup preserves existing package.json content (AC1)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory, {
      scripts: { test: 'vitest run', 'test:bdd': 'my-own-runner' },
    });
    await setupOrThrow(directory);
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('gherkin-setup.DEV1.AC1.existing_package_json_content_is_preserved', () => {
    const packageJson = readPackageJson(directory);
    expect(packageJson.scripts?.test).toBe('vitest run');
    expect(packageJson.devDependencies?.typescript).toBeDefined();
    // ...alongside the added lane entries.
    expect(packageJson.devDependencies?.['@cucumber/cucumber']).toBeDefined();
  });

  it('gherkin-setup.DEV1.AC1.existing_test_bdd_script_is_not_overwritten', () => {
    const packageJson = readPackageJson(directory);
    expect(packageJson.scripts?.['test:bdd']).toBe('my-own-runner');
  });
});

describe('setup hosts the lane in a pure Go repo (AC2)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createGoProject(directory);
    await setupOrThrow(directory, ['setup', '--yes'], { env: SKIP_SKILLS_ENV });
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('gherkin-setup.DEV1.AC2.pure_go_repo_gets_a_minimal_package_json', () => {
    expect(fileExists(directory, 'package.json')).toBe(true);
    expect(readPackageJson(directory).private).toBe(true);
  });

  it('gherkin-setup.DEV1.AC2.pure_go_repo_gets_the_lane_files', () => {
    for (const file of LANE_FILES) {
      expect(fileExists(directory, file), `${file} should exist`).toBe(true);
    }
  });
});

describe('setup merges into a polyglot repo (AC2)', () => {
  let directory: string;

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createGoProject(directory);
    // Name deliberately differs from the directory basename so wrongful
    // re-creation (which derives name from the basename) is observable.
    createTypeScriptPackageJson(directory, { name: 'my-custom-name' });
    await setupOrThrow(directory, ['setup', '--yes'], { env: SKIP_SKILLS_ENV });
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it(
    'gherkin-setup.DEV1.AC2.polyglot_repo_merges_into_its_existing_package_json',
    () => {
      const packageJson = readPackageJson(directory);
      expect(packageJson.name).toBe('my-custom-name');
      expect(packageJson.devDependencies?.['@cucumber/cucumber']).toBeDefined();
      expect(packageJson.scripts?.['test:bdd']).toContain('cucumber-js');
    },
    TIMEOUT_QUICK,
  );
});

describe('the lane working files belong to the customer after creation (AC1)', () => {
  let directory: string;
  const EDIT_MARKER = '// my custom step — do not clobber';

  beforeAll(async () => {
    directory = createTemporaryDirectory();
    createTypeScriptPackageJson(directory);
    await setupOrThrow(directory);
    // Anchor: the scaffolded working files exist before the customer edits.
    expect(fileExists(directory, 'steps/shared.steps.ts')).toBe(true);
    expect(fileExists(directory, 'features/safeword-lane.feature')).toBe(true);

    const edited = `${readTestFile(directory, 'steps/shared.steps.ts')}\n${EDIT_MARKER}\n`;
    writeTestFile(directory, 'steps/shared.steps.ts', edited);
    writeTestFile(directory, 'features/mine.feature', 'Feature: mine\n');

    const upgrade = await runCli(['upgrade'], { cwd: directory });
    expect(upgrade.exitCode, upgrade.stderr).toBe(0);
  }, TIMEOUT_BUN_INSTALL);

  afterAll(() => {
    removeTemporaryDirectory(directory);
  });

  it('gherkin-setup.DEV1.AC1.customer_edited_steps_survive_a_rerun', () => {
    expect(readTestFile(directory, 'steps/shared.steps.ts')).toContain(EDIT_MARKER);
  });

  it('gherkin-setup.DEV1.AC1.customer_feature_files_survive_a_rerun', () => {
    expect(readTestFile(directory, 'features/mine.feature')).toBe('Feature: mine\n');
  });
});
