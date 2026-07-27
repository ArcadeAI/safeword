/**
 * SLOW E2E Tests: Conditional Setup - Framework Detection
 *
 * These tests install real npm dependencies and are excluded from the default
 * test run. Run them explicitly with the slow Vitest configuration.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  createPackageJson,
  createTemporaryDirectory,
  initGitRepo,
  INSTALL_DEPENDENCIES_ENV,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
} from '../helpers';

const SETUP_TIMEOUT = 600_000;

describe('E2E: Conditional Setup - Slow Framework Detection', () => {
  let projectDirectory: string;

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it(
    'detects Astro project and uses safeword astro config',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createPackageJson(projectDirectory, {
        dependencies: { astro: '^4.0.0' },
        devDependencies: { typescript: '^5.0.0' },
      });
      initGitRepo(projectDirectory);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        env: INSTALL_DEPENDENCIES_ENV,
        timeout: SETUP_TIMEOUT,
      });

      const eslintConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
      expect(eslintConfig).toContain('safeword/eslint"');
      expect(eslintConfig).toContain('astro: [...configs.recommendedTypeScript, ...configs.astro]');
      expect(eslintConfig).toContain('baseConfigs[framework]');
      expect(eslintConfig).toContain('detect.getIgnores()');

      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies).toHaveProperty('safeword');
    },
    SETUP_TIMEOUT,
  );

  it(
    'detects Vitest project and uses safeword vitest config',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createPackageJson(projectDirectory, {
        devDependencies: {
          vitest: '^1.0.0',
          typescript: '^5.0.0',
        },
      });
      initGitRepo(projectDirectory);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        env: INSTALL_DEPENDENCIES_ENV,
        timeout: SETUP_TIMEOUT,
      });

      const eslintConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
      expect(eslintConfig).toContain('safeword/eslint"');
      expect(eslintConfig).toContain('...configs.vitest');
      expect(eslintConfig).toContain('baseConfigs[framework]');

      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies).toHaveProperty('safeword');
    },
    SETUP_TIMEOUT,
  );

  it(
    'detects Tailwind and includes Prettier plugin',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createPackageJson(projectDirectory, {
        devDependencies: {
          tailwindcss: '^3.0.0',
          typescript: '^5.0.0',
        },
      });
      initGitRepo(projectDirectory);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        env: INSTALL_DEPENDENCIES_ENV,
        timeout: SETUP_TIMEOUT,
      });

      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies).toHaveProperty('prettier-plugin-tailwindcss');
    },
    SETUP_TIMEOUT,
  );

  it(
    'detects publishable library and includes publint',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createPackageJson(projectDirectory, {
        // Entry points and the absence of private: true make this fixture publishable.
        main: './dist/index.js',
        exports: {
          '.': './dist/index.js',
        },
        devDependencies: { typescript: '^5.0.0' },
      });
      initGitRepo(projectDirectory);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        env: INSTALL_DEPENDENCIES_ENV,
        timeout: SETUP_TIMEOUT,
      });

      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies).toHaveProperty('publint');
      expect(pkg.scripts).toHaveProperty('publint');
    },
    SETUP_TIMEOUT,
  );
});
