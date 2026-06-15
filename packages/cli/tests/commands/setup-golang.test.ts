/**
 * Test Suite: Conditional Setup for Go Projects
 * Tests for setup behavior for Go-only projects.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createGoProject,
  createTemporaryDirectory,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  SKIP_INSTALL_ENV,
  TIMEOUT_BUN_INSTALL,
  TIMEOUT_SETUP,
  writeTestFile,
} from '../helpers';

let projectDirectory: string;

beforeEach(() => {
  projectDirectory = createTemporaryDirectory();
});

afterEach(() => {
  if (projectDirectory) {
    removeTemporaryDirectory(projectDirectory);
  }
});

/**
 * Helper to create a polyglot project (JS + Go)
 */
function createJsGoProject(dir: string): void {
  // Create package.json
  writeTestFile(
    dir,
    'package.json',
    JSON.stringify(
      {
        name: 'test-js-go',
        version: '1.0.0',
        devDependencies: {
          typescript: '^5.0.0',
        },
      },
      undefined,
      2,
    ),
  );

  // Create go.mod
  createGoProject(dir);
}

describe('Test Suite: Conditional Setup for Go Projects', () => {
  describe('Test: Installs the JS toolchain for Go-only projects (BDD lane, ticket 102b)', () => {
    it.skipIf(process.env.SAFEWORD_RUN_INSTALL_TESTS !== '1')(
      'should install eslint and cucumber for Go-only project (the lane ships TS step files)',
      async () => {
        createGoProject(projectDirectory);
        initGitRepo(projectDirectory);

        await runCli(['setup'], { cwd: projectDirectory });

        // BDD is core (Option A): the lane's step files are TypeScript, so the
        // TS toolchain comes along even in non-JS repos.
        expect(fileExists(projectDirectory, 'node_modules/eslint')).toBe(true);
        expect(fileExists(projectDirectory, 'node_modules/@cucumber/cucumber')).toBe(true);
      },
      TIMEOUT_BUN_INSTALL,
    );
  });

  describe('Test: Creates a lane-host package.json for Go-only', () => {
    it(
      'should create a minimal private package.json for pure Go project',
      async () => {
        createGoProject(projectDirectory);
        initGitRepo(projectDirectory);

        await runCli(['setup'], { cwd: projectDirectory, env: SKIP_INSTALL_ENV });

        // Created to host the BDD acceptance lane (ticket 102b).
        expect(fileExists(projectDirectory, 'package.json')).toBe(true);
        const packageJson = JSON.parse(readTestFile(projectDirectory, 'package.json')) as {
          private?: boolean;
        };
        expect(packageJson.private).toBe(true);
      },
      TIMEOUT_SETUP,
    );
  });

  describe('Test: Creates .golangci.yml for Go project', () => {
    it(
      'should create golangci-lint config for Go project',
      async () => {
        createGoProject(projectDirectory);
        initGitRepo(projectDirectory);

        await runCli(['setup'], { cwd: projectDirectory, env: SKIP_INSTALL_ENV });

        // .golangci.yml should be created
        expect(fileExists(projectDirectory, '.golangci.yml')).toBe(true);

        const config = readTestFile(projectDirectory, '.golangci.yml');
        expect(config).toContain('version: "2"');
        expect(config).toContain('linters:');
      },
      TIMEOUT_SETUP,
    );
  });

  describe('Test: Shows Go-appropriate next steps', () => {
    it(
      'should mention golangci-lint in output instead of npm/eslint',
      async () => {
        createGoProject(projectDirectory);
        initGitRepo(projectDirectory);

        const result = await runCli(['setup'], {
          cwd: projectDirectory,
          env: SKIP_INSTALL_ENV,
        });

        // Should mention Go tooling (JS toolchain now also installs — BDD lane, 102b)
        expect(result.stdout).toMatch(/golangci-lint/i);
      },
      TIMEOUT_SETUP,
    );
  });

  describe('Test: Still creates .safeword directory', () => {
    it(
      'should create .safeword with guides for Go project',
      async () => {
        createGoProject(projectDirectory);
        initGitRepo(projectDirectory);

        await runCli(['setup'], { cwd: projectDirectory, env: SKIP_INSTALL_ENV });

        // .safeword directory should exist
        expect(fileExists(projectDirectory, '.safeword')).toBe(true);
        expect(fileExists(projectDirectory, '.safeword/SAFEWORD.md')).toBe(true);
        expect(fileExists(projectDirectory, '.safeword/guides')).toBe(true);
      },
      TIMEOUT_SETUP,
    );
  });

  describe('Test: Still creates Claude hooks', () => {
    it(
      'should create hooks for Go project',
      async () => {
        createGoProject(projectDirectory);
        initGitRepo(projectDirectory);

        await runCli(['setup'], { cwd: projectDirectory, env: SKIP_INSTALL_ENV });

        // Hooks should exist
        expect(fileExists(projectDirectory, '.safeword/hooks')).toBe(true);
        expect(fileExists(projectDirectory, '.safeword/hooks/post-tool-lint.ts')).toBe(true);
      },
      TIMEOUT_SETUP,
    );
  });

  describe('Test: Installs both toolchains for polyglot projects', () => {
    it(
      'should configure ESLint AND create .golangci.yml for JS+Go project',
      async () => {
        createJsGoProject(projectDirectory);
        initGitRepo(projectDirectory);

        await runCli(['setup'], { cwd: projectDirectory, env: SKIP_INSTALL_ENV });

        // Should have ESLint configured (JS tooling)
        expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);

        // Should have golangci-lint configured (Go tooling)
        expect(fileExists(projectDirectory, '.golangci.yml')).toBe(true);
      },
      TIMEOUT_BUN_INSTALL,
    );
  });

  describe('Test: Preserves existing .golangci.yml', () => {
    it(
      'should not overwrite existing golangci-lint config',
      async () => {
        createGoProject(projectDirectory);
        initGitRepo(projectDirectory);

        // Create custom config before setup
        const customConfig = `# My custom config
version: "2"
linters:
  enable:
    - customlinter
`;
        writeTestFile(projectDirectory, '.golangci.yml', customConfig);

        await runCli(['setup'], { cwd: projectDirectory, env: SKIP_INSTALL_ENV });

        // Should preserve custom config
        const config = readTestFile(projectDirectory, '.golangci.yml');
        expect(config).toContain('customlinter');
        expect(config).not.toContain('Generated by safeword');
      },
      TIMEOUT_SETUP,
    );
  });
});
