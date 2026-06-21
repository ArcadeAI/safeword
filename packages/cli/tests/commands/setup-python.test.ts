/**
 * Test Suite 3: Conditional Setup for Python Projects
 * Tests for Story 3 - setup behavior for Python-only projects.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createPythonProject,
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

/**
 * Helper to create a polyglot project (JS + Python)
 */
function createPolyglotProject(dir: string): void {
  // Create package.json
  writeTestFile(
    dir,
    'package.json',
    JSON.stringify(
      {
        name: 'test-polyglot',
        version: '1.0.0',
        devDependencies: {
          typescript: '^5.0.0',
        },
      },
      undefined,
      2,
    ),
  );

  // Create pyproject.toml
  createPythonProject(dir);
}

describe('Test Suite 3: Conditional Setup for Python Projects', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  describe('Test 3.1: Installs the JS toolchain for Python-only projects (BDD lane, ticket 102b)', () => {
    it.skipIf(process.env.SAFEWORD_RUN_INSTALL_TESTS !== '1')(
      'should install eslint and cucumber for Python-only project (the lane ships TS step files)',
      async () => {
        createPythonProject(projectDirectory);
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

  describe('Test 3.2: Creates a lane-host package.json for Python-only', () => {
    it(
      'should create a minimal private package.json for pure Python project',
      async () => {
        createPythonProject(projectDirectory);
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

  describe('Test 3.3: Shows Python-appropriate next steps', () => {
    it(
      'should mention pip/ruff in output instead of npm/eslint',
      async () => {
        createPythonProject(projectDirectory);
        initGitRepo(projectDirectory);

        const result = await runCli(['setup'], {
          cwd: projectDirectory,
          env: SKIP_INSTALL_ENV,
        });

        // Should mention Python tooling (JS toolchain now also installs — BDD lane, 102b)
        expect(result.stdout).toMatch(/pip install|ruff|mypy/i);
      },
      TIMEOUT_SETUP,
    );
  });

  describe('Test 3.4: Still creates .safeword directory', () => {
    it(
      'should create .safeword with guides for Python project',
      async () => {
        createPythonProject(projectDirectory);
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

  describe('Test 3.5: Still creates Claude hooks', () => {
    it(
      'should create hooks for Python project',
      async () => {
        createPythonProject(projectDirectory);
        initGitRepo(projectDirectory);

        await runCli(['setup'], { cwd: projectDirectory, env: SKIP_INSTALL_ENV });

        // Hooks should exist
        expect(fileExists(projectDirectory, '.safeword/hooks')).toBe(true);
      },
      TIMEOUT_SETUP,
    );
  });

  describe('Test 3.6: Installs both toolchains for polyglot projects', () => {
    it(
      'should configure ESLint and mention Ruff for polyglot project',
      async () => {
        createPolyglotProject(projectDirectory);
        initGitRepo(projectDirectory);

        const result = await runCli(['setup'], {
          cwd: projectDirectory,
          env: SKIP_INSTALL_ENV,
        });

        // Should have ESLint configured
        expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);

        // Should mention Python tooling guidance
        expect(result.stdout).toMatch(/ruff|python/i);
      },
      TIMEOUT_BUN_INSTALL,
    );
  });
});
