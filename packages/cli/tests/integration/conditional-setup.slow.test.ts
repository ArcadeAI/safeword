/**
 * SLOW E2E Tests: Conditional Setup - Framework Detection
 *
 * These tests install real npm dependencies (Astro, Vitest, Tailwind) and
 * routinely exceed the standard test timeout. Run them explicitly:
 *
 *   bun vitest run --config vitest.slow.config.ts
 *
 * They are excluded from the default test run via vitest.config.ts.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  createPackageJson,
  createTemporaryDirectory,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
} from '../helpers';

/** Setup timeout: 10 minutes - bun install can take time under load */
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
        timeout: SETUP_TIMEOUT,
      });

      // Check ESLint config uses safeword plugin with dynamic framework detection
      const eslintConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
      expect(eslintConfig).toContain('safeword/eslint"');
      // Config is now dynamic - Astro gets both TypeScript and Astro configs
      expect(eslintConfig).toContain('astro: [...configs.recommendedTypeScript, ...configs.astro]');
      expect(eslintConfig).toContain('baseConfigs[framework]');

      // Check dynamic ignores (detect.getIgnores adds .astro/ for Astro projects)
      expect(eslintConfig).toContain('detect.getIgnores(deps)');

      // Check package.json has safeword (bundles Astro plugin)
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
        timeout: SETUP_TIMEOUT,
      });

      // Check ESLint config uses safeword plugin
      const eslintConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
      expect(eslintConfig).toContain('safeword/eslint"');
      // Vitest/Playwright configs are always included (file-scoped, no false positives)
      expect(eslintConfig).toContain('...configs.vitest');
      expect(eslintConfig).toContain('baseConfigs[framework]');

      // Check package.json has safeword (bundles Vitest plugin)
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
        timeout: SETUP_TIMEOUT,
      });

      // Check package.json has Tailwind Prettier plugin installed
      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies).toHaveProperty('prettier-plugin-tailwindcss');
    },
    SETUP_TIMEOUT,
  );
});
