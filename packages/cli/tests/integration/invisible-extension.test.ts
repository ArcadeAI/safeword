/**
 * E2E Test: Invisible Extension - Separate Human DX from LLM Enforcement
 *
 * Verifies that safeword's "invisible extension" architecture works correctly:
 * - Existing project configs are NOT modified (humans use their normal pre-commits)
 * - .safeword/ configs extend project configs with stricter rules (LLM enforcement)
 * - Hooks use explicit --config flags pointing to .safeword/ configs
 *
 * @see /Users/alex/.claude/plans/sunny-frolicking-pumpkin.md
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  createPackageJson,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

/** Setup timeout: 10 minutes - bun install can take time under load */
const SETUP_TIMEOUT = 600_000;

describe('E2E: Invisible Extension - Config Separation', () => {
  let projectDirectory: string;

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  describe('ESLint', () => {
    it(
      'creates .safeword/eslint.config.mjs that extends existing flat config',
      async () => {
        projectDirectory = createTemporaryDirectory();
        createTypeScriptPackageJson(projectDirectory);
        initGitRepo(projectDirectory);

        // Create existing ESLint flat config
        const existingConfig = `// My custom ESLint config
export default [
  { rules: { "no-console": "warn" } }
];
`;
        writeTestFile(projectDirectory, 'eslint.config.mjs', existingConfig);

        await runCli(['setup'], {
          cwd: projectDirectory,
          timeout: SETUP_TIMEOUT,
        });

        // Existing config should be preserved (not modified)
        const preservedConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
        expect(preservedConfig).toBe(existingConfig);

        // .safeword/eslint.config.mjs should exist and extend project config
        expect(fileExists(projectDirectory, '.safeword/eslint.config.mjs')).toBe(true);
        const safewordConfig = readTestFile(projectDirectory, '.safeword/eslint.config.mjs');

        // Should import and extend project config
        expect(safewordConfig).toContain('import("../eslint.config.mjs")');
        expect(safewordConfig).toContain('projectConfig');
        // Should have safeword strict rules
        expect(safewordConfig).toContain('safewordStrictRules');
        expect(safewordConfig).toContain('no-unused-vars');
      },
      SETUP_TIMEOUT,
    );

    it(
      'creates .safeword/eslint.config.mjs that extends legacy .eslintrc.json',
      async () => {
        projectDirectory = createTemporaryDirectory();
        createTypeScriptPackageJson(projectDirectory);
        initGitRepo(projectDirectory);

        // Create existing legacy ESLint config
        const legacyConfig = JSON.stringify(
          {
            extends: ['eslint:recommended'],
            rules: { 'no-debugger': 'error' },
          },
          undefined,
          2,
        );
        writeTestFile(projectDirectory, '.eslintrc.json', legacyConfig);

        await runCli(['setup'], {
          cwd: projectDirectory,
          timeout: SETUP_TIMEOUT,
        });

        // Legacy config should be preserved
        const preservedConfig = readTestFile(projectDirectory, '.eslintrc.json');
        expect(preservedConfig).toBe(legacyConfig);

        // .safeword/eslint.config.mjs should exist and use FlatCompat
        expect(fileExists(projectDirectory, '.safeword/eslint.config.mjs')).toBe(true);
        const safewordConfig = readTestFile(projectDirectory, '.safeword/eslint.config.mjs');

        // Should use FlatCompat for legacy configs
        expect(safewordConfig).toContain('FlatCompat');
        expect(safewordConfig).toContain('@eslint/eslintrc');
        // Should warn about legacy format
        expect(safewordConfig).toContain('Legacy .eslintrc.*');
      },
      SETUP_TIMEOUT,
    );

    it(
      'creates standalone .safeword/eslint.config.mjs when no existing config',
      async () => {
        projectDirectory = createTemporaryDirectory();
        createTypeScriptPackageJson(projectDirectory);
        initGitRepo(projectDirectory);

        await runCli(['setup'], {
          cwd: projectDirectory,
          timeout: SETUP_TIMEOUT,
        });

        // Project-level config should be created (since no existing)
        expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);

        // .safeword/eslint.config.mjs should also exist (standalone)
        expect(fileExists(projectDirectory, '.safeword/eslint.config.mjs')).toBe(true);
        const safewordConfig = readTestFile(projectDirectory, '.safeword/eslint.config.mjs');

        // Should be standalone (no import from project config)
        expect(safewordConfig).toContain('safeword/eslint');
        expect(safewordConfig).toContain('safewordStrictRules');
      },
      SETUP_TIMEOUT,
    );
  });

  describe('Ruff (Python)', () => {
    it(
      'creates .safeword/ruff.toml that extends existing [tool.ruff] in pyproject.toml',
      async () => {
        projectDirectory = createTemporaryDirectory();
        createPackageJson(projectDirectory);
        initGitRepo(projectDirectory);

        // Create pyproject.toml with existing Ruff config
        const pyprojectContent = `[project]
name = "my-project"
version = "1.0.0"

[tool.ruff]
line-length = 120
select = ["E", "F"]
`;
        writeTestFile(projectDirectory, 'pyproject.toml', pyprojectContent);

        await runCli(['setup'], {
          cwd: projectDirectory,
          timeout: SETUP_TIMEOUT,
        });

        // Original pyproject.toml should be preserved
        const preservedPyproject = readTestFile(projectDirectory, 'pyproject.toml');
        expect(preservedPyproject).toContain('[tool.ruff]');
        expect(preservedPyproject).toContain('line-length = 120');

        // .safeword/ruff.toml should exist and extend project config
        expect(fileExists(projectDirectory, '.safeword/ruff.toml')).toBe(true);
        const safewordRuff = readTestFile(projectDirectory, '.safeword/ruff.toml');

        // Should extend project's pyproject.toml
        expect(safewordRuff).toContain('extend = "../pyproject.toml"');
        // Should use additive rules (extend-select, not select) to preserve customer config
        expect(safewordRuff).toContain('extend-select');
        expect(safewordRuff).not.toContain('select = ["ALL"]');
      },
      SETUP_TIMEOUT,
    );

    it(
      'creates standalone .safeword/ruff.toml when no existing Ruff config',
      async () => {
        projectDirectory = createTemporaryDirectory();
        createPackageJson(projectDirectory);
        initGitRepo(projectDirectory);

        // Create pyproject.toml WITHOUT Ruff config
        const pyprojectContent = `[project]
name = "my-project"
version = "1.0.0"
`;
        writeTestFile(projectDirectory, 'pyproject.toml', pyprojectContent);

        await runCli(['setup'], {
          cwd: projectDirectory,
          timeout: SETUP_TIMEOUT,
        });

        // .safeword/ruff.toml should exist (standalone)
        expect(fileExists(projectDirectory, '.safeword/ruff.toml')).toBe(true);
        const safewordRuff = readTestFile(projectDirectory, '.safeword/ruff.toml');

        // Should NOT have extend directive (standalone)
        expect(safewordRuff).not.toContain('extend =');
        // Should have curated rules (not ALL)
        expect(safewordRuff).toContain('select = [');
        expect(safewordRuff).not.toContain('select = ["ALL"]');
      },
      SETUP_TIMEOUT,
    );
  });

  describe('golangci-lint (Go)', () => {
    it(
      'creates .safeword/.golangci.yml that merges existing config (v2 format)',
      async () => {
        projectDirectory = createTemporaryDirectory();
        createPackageJson(projectDirectory);
        initGitRepo(projectDirectory);

        // Create go.mod to mark as Go project
        writeTestFile(projectDirectory, 'go.mod', 'module example.com/myproject\n\ngo 1.21\n');

        // Create existing golangci-lint v2 config with custom enable, disable, and formatter
        const golangciConfig = `version: "2"

linters:
  default: standard
  enable:
    - gofmt
  disable:
    - govet

formatters:
  enable:
    - goimports
`;
        writeTestFile(projectDirectory, '.golangci.yml', golangciConfig);

        await runCli(['setup'], {
          cwd: projectDirectory,
          timeout: SETUP_TIMEOUT,
        });

        // Original config should be preserved
        const preservedConfig = readTestFile(projectDirectory, '.golangci.yml');
        expect(preservedConfig).toBe(golangciConfig);

        // .safeword/.golangci.yml should exist and merge project config
        expect(fileExists(projectDirectory, '.safeword/.golangci.yml')).toBe(true);
        const safewordConfig = readTestFile(projectDirectory, '.safeword/.golangci.yml');

        // Should be merged additively (customer choices preserved)
        expect(safewordConfig).toContain('version: "2"');
        // Customer's default: standard should be preserved (not overridden to all)
        expect(safewordConfig).toContain('default: standard');
        expect(safewordConfig).not.toContain('default: all');
        // Customer's enable (gofmt) should survive, safeword's linters added
        expect(safewordConfig).toContain('gofmt');
        expect(safewordConfig).toContain('gosec');
        expect(safewordConfig).toContain('cyclop');
        // Customer's disable (govet) should survive in union with safeword's
        expect(safewordConfig).toContain('govet');
        expect(safewordConfig).toContain('forbidigo');
        // Customer's formatter (goimports) preserved, gofumpt added
        expect(safewordConfig).toContain('goimports');
        expect(safewordConfig).toContain('gofumpt');
      },
      SETUP_TIMEOUT,
    );

    it(
      'creates standalone .safeword/.golangci.yml when no existing config',
      async () => {
        projectDirectory = createTemporaryDirectory();
        createPackageJson(projectDirectory);
        initGitRepo(projectDirectory);

        // Create go.mod to mark as Go project
        writeTestFile(projectDirectory, 'go.mod', 'module example.com/myproject\n\ngo 1.21\n');

        await runCli(['setup'], {
          cwd: projectDirectory,
          timeout: SETUP_TIMEOUT,
        });

        // Project-level config should be created (since no existing)
        expect(fileExists(projectDirectory, '.golangci.yml')).toBe(true);

        // .safeword/.golangci.yml should also exist (standalone)
        expect(fileExists(projectDirectory, '.safeword/.golangci.yml')).toBe(true);
        const safewordConfig = readTestFile(projectDirectory, '.safeword/.golangci.yml');

        // Should be standalone config with curated rules (not all)
        expect(safewordConfig).toContain('version: "2"');
        expect(safewordConfig).toContain('default: standard');
        expect(safewordConfig).not.toContain('default: all');
      },
      SETUP_TIMEOUT,
    );
  });

  describe('Hook Template', () => {
    it(
      'creates hook that uses explicit --config flags for safeword configs',
      async () => {
        projectDirectory = createTemporaryDirectory();
        createTypeScriptPackageJson(projectDirectory);
        initGitRepo(projectDirectory);

        await runCli(['setup'], {
          cwd: projectDirectory,
          timeout: SETUP_TIMEOUT,
        });

        // Check hook lib uses explicit config paths
        expect(fileExists(projectDirectory, '.safeword/hooks/lib/lint.ts')).toBe(true);
        const lintHook = readTestFile(projectDirectory, '.safeword/hooks/lib/lint.ts');

        // Should check for safeword configs
        expect(lintHook).toContain('.safeword/eslint.config.mjs');
        expect(lintHook).toContain('.safeword/ruff.toml');
        expect(lintHook).toContain('.safeword/.golangci.yml');

        // Should use --config flag when safeword configs exist
        expect(lintHook).toContain('--config');
        expect(lintHook).toContain('hasEslint');
      },
      SETUP_TIMEOUT,
    );
  });
});
