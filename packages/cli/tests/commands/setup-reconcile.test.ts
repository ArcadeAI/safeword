/**
 * Test Suite: Setup Command (Reconcile-based)
 *
 * Tests that the setup command uses reconcile() with mode='install'
 * to create all managed files and directories.
 *
 * TDD RED phase - these tests verify reconcile integration.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ESLINT_PACKAGE } from '../../src/packs/typescript/files.js';
import {
  createTemporaryDirectory,
  createTypeScriptProjectReadyForSetup,
  getReconcileTestUtilities,
  removeTemporaryDirectory,
  runCli,
  runCommandSync,
  setupReconcileTest,
} from '../helpers';

const __dirname = import.meta.dirname;

describe('Setup Command - Reconcile Integration', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('reconcile mode=install', () => {
    it('should compute all install actions correctly', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } = await getReconcileTestUtilities(
        temporaryDirectory,
        {
          packageJson: { name: 'test', version: '1.0.0' },
        },
      );

      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx, {
        dryRun: true,
      });

      // dryRun should compute actions without applying
      expect(result.applied).toBe(false);

      // Should have mkdir actions for directories
      const mkdirActions = result.actions.filter(a => a.type === 'mkdir');
      expect(mkdirActions.length).toBeGreaterThan(0);

      // Should have write actions for files
      const writeActions = result.actions.filter(a => a.type === 'write');
      expect(writeActions.length).toBeGreaterThan(0);

      // Should have SAFEWORD.md write action
      const hasSafewordMd = writeActions.some(
        a => a.type === 'write' && a.path.includes('SAFEWORD.md'),
      );
      expect(hasSafewordMd).toBe(true);

      // Should have version file write action
      const hasVersion = writeActions.some(
        a => a.type === 'write' && a.path === '.safeword/version',
      );
      expect(hasVersion).toBe(true);

      // Should have JSON merge for settings.json
      const jsonMergeActions = result.actions.filter(a => a.type === 'json-merge');
      expect(jsonMergeActions.length).toBeGreaterThan(0);

      // Should compute packages to install
      expect(result.packagesToInstall.length).toBeGreaterThan(0);
      expect(result.packagesToInstall).toContain(ESLINT_PACKAGE);
    });

    it('should create all directories when applied', async () => {
      await setupReconcileTest(temporaryDirectory);

      // Check directories created
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/hooks'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/guides'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.project/learnings'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.project/tickets'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.project/tickets/completed'))).toBe(
        true,
      );
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude/commands'))).toBe(true);
    });

    it('should create all owned files when applied', async () => {
      await setupReconcileTest(temporaryDirectory);

      // Check core files
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/version'))).toBe(true);

      // Check hook files
      expect(
        existsSync(
          nodePath.join(temporaryDirectory, '.safeword/hooks/session-safeword-context.ts'),
        ),
      ).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/hooks/stop-quality.ts'))).toBe(
        true,
      );

      // Check guides
      expect(
        existsSync(nodePath.join(temporaryDirectory, '.safeword/guides/architecture-guide.md')),
      ).toBe(true);
      expect(
        existsSync(nodePath.join(temporaryDirectory, '.safeword/guides/planning-guide.md')),
      ).toBe(true);
      expect(
        existsSync(nodePath.join(temporaryDirectory, '.safeword/guides/testing-guide.md')),
      ).toBe(true);

      // Check claude skills (commands moved to skills)
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude/skills'))).toBe(true);
    });

    it('should create managed files only if missing', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } = await getReconcileTestUtilities(
        temporaryDirectory,
        {
          packageJson: { name: 'test', version: '1.0.0' },
        },
      );

      // Create existing eslint config with custom content
      writeFileSync(
        nodePath.join(temporaryDirectory, 'eslint.config.mjs'),
        '// Custom ESLint config',
      );

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Existing eslint config should NOT be overwritten
      const eslintContent = readFileSync(
        nodePath.join(temporaryDirectory, 'eslint.config.mjs'),
        'utf8',
      );
      expect(eslintContent).toBe('// Custom ESLint config');

      // But prettierrc should be created if missing
      expect(existsSync(nodePath.join(temporaryDirectory, '.prettierrc'))).toBe(true);
    });

    it('should apply JSON merges for settings.json', async () => {
      await setupReconcileTest(temporaryDirectory);

      // Settings should be created with hooks
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude/settings.json'))).toBe(true);
      const settings = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, '.claude/settings.json'), 'utf8'),
      );
      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.SessionStart).toBeDefined();
    });

    it('should apply JSON merges for package.json scripts', async () => {
      // Real JS source so the project is a JS project (gets the knip script — BE7C7B
      // gates knip on real JS source, not on the stub package.json).
      mkdirSync(nodePath.join(temporaryDirectory, 'src'), { recursive: true });
      writeFileSync(nodePath.join(temporaryDirectory, 'src/index.ts'), 'export const x = 1;\n');
      await setupReconcileTest(temporaryDirectory);

      // Package.json should have scripts added
      const packageJson = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, 'package.json'), 'utf8'),
      );
      expect(packageJson.scripts?.lint).toBeDefined();
      expect(packageJson.scripts?.format).toBeDefined();
      expect(packageJson.scripts?.knip).toBeDefined();
    });

    it('should not create AGENTS.md via text patch', async () => {
      await setupReconcileTest(temporaryDirectory);

      expect(existsSync(nodePath.join(temporaryDirectory, 'AGENTS.md'))).toBe(false);
    });

    it('does not create Codex project assets', async () => {
      await setupReconcileTest(temporaryDirectory);

      expect(existsSync(nodePath.join(temporaryDirectory, '.codex/config.toml'))).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.codex'))).toBe(false);
    });

    it('tells users how to install the Codex plugin after setup', async () => {
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, undefined, 2),
      );

      const result = await runCli(['setup', '--yes', '--no-modify'], {
        cwd: temporaryDirectory,
        env: { SAFEWORD_SKIP_INSTALL: '1' },
      });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain('codex install');
    });

    it('should preserve existing AGENTS.md without prepending safeword text', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } = await getReconcileTestUtilities(
        temporaryDirectory,
        {
          packageJson: { name: 'test', version: '1.0.0' },
        },
      );

      // Create existing AGENTS.md
      writeFileSync(
        nodePath.join(temporaryDirectory, 'AGENTS.md'),
        '# My Project\n\nCustom content here.',
      );

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');
      expect(content).toBe('# My Project\n\nCustom content here.');
    });

    it('should detect framework-specific packages', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } = await getReconcileTestUtilities(
        temporaryDirectory,
        {
          packageJson: {
            name: 'test',
            version: '1.0.0',
            devDependencies: { astro: '^4.0.0' },
          },
        },
      );

      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx, {
        dryRun: true,
      });

      // Should include Astro prettier plugin (NOT bundled in safeword/eslint)
      expect(result.packagesToInstall).toContain('prettier-plugin-astro');
    });
  });

  describe('setup command integration', () => {
    it('should run setup successfully via CLI', async () => {
      createTypeScriptProjectReadyForSetup(temporaryDirectory);

      const result = await runCli(['setup'], { cwd: temporaryDirectory });

      expect(result.exitCode, result.stderr).toBe(0);
      expect(result.stdout).toContain('Setup');
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.codex/config.toml'))).toBe(false);
    });

    it('should error on already configured project', () => {
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, undefined, 2),
      );

      // Create .safeword dir
      mkdirSync(nodePath.join(temporaryDirectory, '.safeword'), {
        recursive: true,
      });

      const cliPath = nodePath.resolve(__dirname, '../../src/cli.ts');
      const result = runCommandSync(`bunx tsx ${cliPath} setup`, {
        cwd: temporaryDirectory,
        timeout: 30_000,
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toLowerCase()).toContain('already configured');
    });
  });
});
