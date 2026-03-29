/**
 * E2E Test: Conditional Setup Logic
 *
 * Verifies that safeword setup adapts to different project types:
 * - TypeScript vs JavaScript projects
 * - React/Next.js/Astro detection
 * - Existing config preservation (doesn't overwrite)
 * - Git vs non-git projects
 * - Publishable library detection
 *
 * Each test creates a fresh project to test specific conditions.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  createNextJsPackageJson,
  createPackageJson,
  createReactPackageJson,
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

describe('E2E: Conditional Setup - Project Type Detection', () => {
  let projectDirectory: string;

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it(
    'detects TypeScript project and uses safeword recommendedTypeScript config',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createTypeScriptPackageJson(projectDirectory);
      initGitRepo(projectDirectory);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        timeout: SETUP_TIMEOUT,
      });

      // Check ESLint config uses safeword plugin with dynamic framework detection
      const eslintConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
      expect(eslintConfig).toContain('safeword/eslint"');
      // Config is now dynamic - detects framework at runtime
      expect(eslintConfig).toContain('configs.recommendedTypeScript');
      expect(eslintConfig).toContain('baseConfigs[framework]');

      // Check package.json has safeword (bundles typescript-eslint)
      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies).toHaveProperty('safeword');
    },
    SETUP_TIMEOUT,
  );

  it(
    'detects JavaScript-only project and uses safeword recommended config',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createPackageJson(projectDirectory); // No TypeScript
      initGitRepo(projectDirectory);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        timeout: SETUP_TIMEOUT,
      });

      // ESLint config is dynamic - uses configs.recommended for JS
      const eslintConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
      expect(eslintConfig).toContain('safeword/eslint"');
      // Config is now dynamic - detects framework at runtime

      // eslint-disable-next-line sonarjs/code-eval -- false positive: asserting generated config content, not eval
      expect(eslintConfig).toContain('javascript: configs.recommended');
      expect(eslintConfig).toContain('baseConfigs[framework]');

      // safeword is installed (bundles everything)
      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies).toHaveProperty('safeword');
    },
    SETUP_TIMEOUT,
  );

  it(
    'detects React project and uses safeword recommendedTypeScriptReact config',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createReactPackageJson(projectDirectory, {
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
      // Config is now dynamic - detects framework at runtime
      expect(eslintConfig).toContain('react: configs.recommendedTypeScriptReact');
      expect(eslintConfig).toContain('baseConfigs[framework]');

      // Check package.json has safeword (bundles React plugins)
      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies).toHaveProperty('safeword');
    },
    SETUP_TIMEOUT,
  );

  it(
    'detects Next.js project and uses safeword recommendedTypeScriptNext config',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createNextJsPackageJson(projectDirectory, {
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
      // Config is now dynamic - detects framework at runtime with monorepo support
      expect(eslintConfig).toContain(
        'nextPaths ? configs.recommendedTypeScriptReact : configs.recommendedTypeScriptNext',
      );
      expect(eslintConfig).toContain('baseConfigs[framework]');

      // Check standard ignores (detect.getIgnores includes .next/, .astro/, .venv/, etc.)
      expect(eslintConfig).toContain('detect.getIgnores()');

      // Check package.json has safeword (bundles Next.js plugin)
      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies).toHaveProperty('safeword');
    },
    SETUP_TIMEOUT,
  );

  // Astro, Vitest, and Tailwind tests moved to conditional-setup.slow.test.ts
  // They require real npm installs that routinely exceed timeout limits.
  // Run explicitly: bun vitest run --config vitest.slow.config.ts

  // Skip: This test hangs intermittently during npm install (45min+ timeouts)
  // The functionality is tested in project-detector.test.ts unit tests
  it.skip(
    'detects publishable library and includes publint',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createPackageJson(projectDirectory, {
        // Publishable: has main/exports, not private
        main: './dist/index.js',
        exports: {
          '.': './dist/index.js',
        },
        devDependencies: { typescript: '^5.0.0' },
      });
      initGitRepo(projectDirectory);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        timeout: SETUP_TIMEOUT,
      });

      // Check package.json has publint installed
      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies).toHaveProperty('publint');
      expect(pkg.scripts).toHaveProperty('publint');
    },
    SETUP_TIMEOUT,
  );
});

describe('E2E: Conditional Setup - Existing Config Preservation', () => {
  let projectDirectory: string;

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it(
    'preserves existing ESLint config (does not overwrite)',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createTypeScriptPackageJson(projectDirectory);
      initGitRepo(projectDirectory);

      // Create existing ESLint config
      const existingConfig = '// My custom ESLint config\nexport default [];\n';
      writeTestFile(projectDirectory, 'eslint.config.mjs', existingConfig);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        timeout: SETUP_TIMEOUT,
      });

      // Existing config should be preserved
      const eslintConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
      expect(eslintConfig).toBe(existingConfig);
    },
    SETUP_TIMEOUT,
  );

  it(
    'preserves existing Prettier config values while adding defaults',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createTypeScriptPackageJson(projectDirectory);
      initGitRepo(projectDirectory);

      // Create existing Prettier config with custom values
      const existingConfig = '{ "semi": false, "singleQuote": true }';
      writeTestFile(projectDirectory, '.prettierrc', existingConfig);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        timeout: SETUP_TIMEOUT,
      });

      // User's custom values should be preserved, defaults added for missing options
      const prettierConfig = JSON.parse(readTestFile(projectDirectory, '.prettierrc'));
      expect(prettierConfig.semi).toBe(false); // User's value preserved
      expect(prettierConfig.singleQuote).toBe(true); // User's value preserved
      expect(prettierConfig.tabWidth).toBe(2); // Default added
      expect(prettierConfig.printWidth).toBe(100); // Default added
    },
    SETUP_TIMEOUT,
  );

  it(
    'preserves existing lint scripts in package.json',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createPackageJson(projectDirectory, {
        scripts: {
          lint: 'custom-lint-command',
          format: 'custom-format-command',
        },
        devDependencies: { typescript: '^5.0.0' },
      });
      initGitRepo(projectDirectory);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        timeout: SETUP_TIMEOUT,
      });

      // Custom scripts should be preserved
      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.scripts.lint).toBe('custom-lint-command');
      expect(pkg.scripts.format).toBe('custom-format-command');
    },
    SETUP_TIMEOUT,
  );

  it(
    'merges hooks with existing non-safeword hooks',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createTypeScriptPackageJson(projectDirectory);
      initGitRepo(projectDirectory);

      // Create existing Claude settings with custom hooks
      writeTestFile(
        projectDirectory,
        '.claude/settings.json',
        JSON.stringify(
          {
            hooks: {
              SessionStart: [
                {
                  hooks: [
                    {
                      type: 'command',
                      command: 'echo "My custom hook"',
                    },
                  ],
                },
              ],
            },
          },
          undefined,
          2,
        ),
      );

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        timeout: SETUP_TIMEOUT,
      });

      // Both custom and safeword hooks should exist
      const settings = JSON.parse(readTestFile(projectDirectory, '.claude/settings.json'));
      const sessionStartHooks = settings.hooks.SessionStart;

      // Should have at least 4 hooks (1 custom + 3 safeword)
      expect(sessionStartHooks.length).toBeGreaterThanOrEqual(4);

      // Custom hook should be first (preserved)
      expect(sessionStartHooks[0]?.hooks[0]?.command).toBe('echo "My custom hook"');

      // Safeword hooks should be present
      const commands = sessionStartHooks.map(
        (h: { hooks: { command: string }[] }) => h.hooks[0]?.command,
      );
      expect(commands).toContain(
        'bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-verify-agents.ts',
      );
      expect(commands).toContain('bun "$CLAUDE_PROJECT_DIR"/.safeword/hooks/session-version.ts');
    },
    SETUP_TIMEOUT,
  );
});

describe('E2E: Conditional Setup - Git Integration', () => {
  let projectDirectory: string;

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  // Note: Husky/lint-staged are no longer managed by safeword (v0.9.0+)
  // Users set up their own pre-commit hooks if desired
  it(
    'does not install husky or lint-staged (removed in v0.9.0)',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createTypeScriptPackageJson(projectDirectory);
      initGitRepo(projectDirectory);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        timeout: SETUP_TIMEOUT,
      });

      // Husky should NOT be configured by safeword
      expect(fileExists(projectDirectory, '.husky')).toBe(false);

      // husky and lint-staged should NOT be installed
      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies?.husky).toBeUndefined();
      expect(pkg.devDependencies?.['lint-staged']).toBeUndefined();

      // But safeword should be installed
      expect(pkg.devDependencies).toHaveProperty('safeword');
    },
    SETUP_TIMEOUT,
  );

  it(
    'works in non-git directory',
    async () => {
      projectDirectory = createTemporaryDirectory();
      createTypeScriptPackageJson(projectDirectory);
      // Note: NOT calling initGitRepo

      const result = await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        timeout: SETUP_TIMEOUT,
      });

      // Setup should complete successfully
      expect(result.exitCode).toBe(0);

      // Base packages should be installed
      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg.devDependencies?.eslint).toBeDefined();
      expect(pkg.devDependencies).toHaveProperty('safeword');
    },
    SETUP_TIMEOUT,
  );

  // Note: pre-commit hooks are no longer managed by safeword (v0.9.0+)
  // Users can set up their own husky + lint-staged if desired
});

describe('E2E: Conditional Setup - Package.json Creation', () => {
  let projectDirectory: string;

  afterEach(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it(
    'creates package.json if missing',
    async () => {
      projectDirectory = createTemporaryDirectory();
      // Note: NOT creating package.json
      initGitRepo(projectDirectory);

      await runCli(['setup', '--yes'], {
        cwd: projectDirectory,
        timeout: SETUP_TIMEOUT,
      });

      // package.json should be created
      expect(fileExists(projectDirectory, 'package.json')).toBe(true);

      const pkg = JSON.parse(readTestFile(projectDirectory, 'package.json'));
      expect(pkg).toHaveProperty('name');
      expect(pkg).toHaveProperty('version');
    },
    SETUP_TIMEOUT,
  );
});

// Note: Architecture boundaries are now project-specific (not generated by CLI).
// Users who want boundaries should configure them in their own eslint.config.mjs.
