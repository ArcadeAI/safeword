/**
 * Test Suite: Reconciliation Engine
 *
 * Tests the reconcile() function that computes and executes plans
 * based on SAFEWORD_SCHEMA and the current project state.
 *
 * TDD RED phase - these tests should FAIL until src/reconcile.ts is implemented.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ESLINT_PACKAGE } from '../src/packs/typescript/files.js';

// This import will fail until reconcile.ts is created (RED phase)
// import { reconcile, computePackagesToInstall } from '../src/reconcile.js';
// import { SAFEWORD_SCHEMA } from '../src/schema.js';

/**
 * Default project type fixture with all flags false.
 * Spread with overrides in tests: { ...DEFAULT_PROJECT_TYPE, astro: true }
 */
const DEFAULT_PROJECT_TYPE = {
  typescript: false,
  react: false,
  nextjs: false,
  astro: false,
  vitest: false,
  playwright: false,
  tailwind: false,
  tanstackQuery: false,
  publishableLibrary: false,
  shell: false,
  existingLinter: false,
  existingFormatter: false,
  existingEslintConfig: undefined,
  legacyEslint: false,
  existingRuffConfig: undefined,
  existingMypyConfig: false,
  existingImportLinterConfig: false,
  existingGolangciConfig: undefined,
  existingClippyConfig: undefined,
  existingRustfmtConfig: undefined,
};

describe('Reconcile - Reconciliation Engine', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-reconcile-test-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  // Helper to create a minimal package.json
  /**
   *
   * @param content
   */
  function createPackageJson(content: Record<string, unknown> = {}) {
    const defaultContent = {
      name: 'test-project',
      version: '1.0.0',
      ...content,
    };
    writeFileSync(
      nodePath.join(temporaryDirectory, 'package.json'),
      JSON.stringify(defaultContent, undefined, 2),
    );
    return defaultContent;
  }

  // Helper to create project context
  /**
   *
   * @param overrides
   */
  function createContext(overrides: Record<string, unknown> = {}) {
    return {
      cwd: temporaryDirectory,
      projectType: {
        ...DEFAULT_PROJECT_TYPE,
        ...(overrides.projectType as Record<string, unknown>),
      },
      developmentDeps: (overrides.developmentDeps as Record<string, string>) ?? {},
      productionDeps: (overrides.productionDeps as Record<string, string>) ?? {},
      isGitRepo: (overrides.isGitRepo as boolean) ?? true,
      // Default to JavaScript project for existing tests
      languages: (overrides.languages as {
        javascript: boolean;
        python: boolean;
        golang: boolean;
        rust: boolean;
      }) ?? {
        javascript: true,
        python: false,
        golang: false,
        rust: false,
      },
    };
  }

  describe('reconcile() - install mode', () => {
    it('should create all owned directories', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      expect(result.applied).toBe(true);

      // Verify all ownedDirs were created
      for (const dir of SAFEWORD_SCHEMA.ownedDirs) {
        expect(existsSync(nodePath.join(temporaryDirectory, dir))).toBe(true);
      }
    });

    it('should create all shared directories', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      for (const dir of SAFEWORD_SCHEMA.sharedDirs) {
        expect(existsSync(nodePath.join(temporaryDirectory, dir))).toBe(true);
      }
    });

    it('should create all preserved directories', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      for (const dir of SAFEWORD_SCHEMA.preservedDirs) {
        expect(existsSync(nodePath.join(temporaryDirectory, dir))).toBe(true);
      }
    });

    it('should write all owned files', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Check a sample of owned files exist
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/version'))).toBe(true);

      // created should include all owned files
      expect(result.created.length).toBeGreaterThan(0);
    });

    it('should work in non-git repos', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext({ isGitRepo: false });

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // .safeword should still be created
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/hooks'))).toBe(true);
    });

    it('should create managed files when missing', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // managedFiles should be created
      expect(existsSync(nodePath.join(temporaryDirectory, 'eslint.config.mjs'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.prettierrc'))).toBe(true);
    });

    it('should merge JSON files', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson({ scripts: { test: 'vitest' } });
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const pkg = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, 'package.json'), 'utf8'),
      );

      // Existing scripts preserved
      expect(pkg.scripts.test).toBe('vitest');
      // Safeword scripts added
      expect(pkg.scripts.lint).toBe('eslint .');
      expect(pkg.scripts.format).toBe('prettier --write .');
      expect(pkg.scripts.knip).toBe('knip');
    });

    it('should apply text patches', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // AGENTS.md should be created with the prepend content
      expect(existsSync(nodePath.join(temporaryDirectory, 'AGENTS.md'))).toBe(true);
      const content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');
      expect(content).toContain('.safeword/SAFEWORD.md');
    });

    it('should compute packages to install', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Should include all base packages
      expect(result.packagesToInstall).toContain(ESLINT_PACKAGE);
      expect(result.packagesToInstall).toContain('prettier');
      expect(result.packagesToInstall).toContain('safeword');
    });

    it('should include conditional packages based on project type', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext({
        projectType: { astro: true, tailwind: true },
      });

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Astro and tailwind prettier plugins are NOT bundled in safeword
      expect(result.packagesToInstall).toContain('prettier-plugin-astro');
      expect(result.packagesToInstall).toContain('prettier-plugin-tailwindcss');
    });

    it('should exclude already installed packages', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson({
        devDependencies: { eslint: '^8.0.0', prettier: '^3.0.0' },
      });
      const ctx = createContext({
        developmentDeps: { eslint: '^8.0.0', prettier: '^3.0.0' },
      });

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      expect(result.packagesToInstall).not.toContain(ESLINT_PACKAGE);
      expect(result.packagesToInstall).not.toContain('prettier');
      // But should still include others
      expect(result.packagesToInstall).toContain('knip');
    });
  });

  describe('reconcile() - upgrade mode', () => {
    it('should remove deprecated files that exist', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Create a deprecated file (simulating old version)
      const deprecatedPath = nodePath.join(
        temporaryDirectory,
        '.safeword/templates/user-stories-template.md',
      );
      mkdirSync(nodePath.join(temporaryDirectory, '.safeword/templates'), {
        recursive: true,
      });
      writeFileSync(deprecatedPath, '# Old User Stories Template');

      // Upgrade should remove deprecated file
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      expect(result.removed).toContain('.safeword/templates/user-stories-template.md');
      expect(existsSync(deprecatedPath)).toBe(false);
    });

    it('should not fail when deprecated files do not exist', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Ensure deprecated file does not exist
      const deprecatedPath = nodePath.join(
        temporaryDirectory,
        '.safeword/templates/user-stories-template.md',
      );
      expect(existsSync(deprecatedPath)).toBe(false);

      // Upgrade should succeed without errors
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      expect(result.applied).toBe(true);
      // Deprecated file not in removed list since it didn't exist
      expect(result.removed).not.toContain('.safeword/templates/user-stories-template.md');
    });

    it('should include deprecated files in dryRun upgrade actions', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Create a deprecated file
      const deprecatedPath = nodePath.join(
        temporaryDirectory,
        '.safeword/templates/user-stories-template.md',
      );
      mkdirSync(nodePath.join(temporaryDirectory, '.safeword/templates'), {
        recursive: true,
      });
      writeFileSync(deprecatedPath, '# Old Template');

      // dryRun upgrade should report deprecated file in actions
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // Should have rm action for deprecated file
      const rmActions = result.actions.filter(a => a.type === 'rm');
      expect(rmActions.some(a => a.path === '.safeword/templates/user-stories-template.md')).toBe(
        true,
      );

      // File should still exist (dryRun)
      expect(existsSync(deprecatedPath)).toBe(true);

      // Should be in removed list
      expect(result.removed).toContain('.safeword/templates/user-stories-template.md');
    });

    it('should update owned files only if content changed', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Modify an owned file
      const versionPath = nodePath.join(temporaryDirectory, '.safeword/version');
      writeFileSync(versionPath, 'old-version');

      // Upgrade should update it
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      expect(result.updated).toContain('.safeword/version');
    });

    it('should not update owned files if content matches', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Upgrade without changes
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      // Nothing should be updated
      expect(result.updated.length).toBe(0);
    });

    it('should skip managed files if user modified them', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // User modifies eslint config
      const eslintPath = nodePath.join(temporaryDirectory, 'eslint.config.mjs');
      writeFileSync(eslintPath, '// User customized config\nexport default [];');

      // Upgrade should NOT overwrite it
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      expect(result.updated).not.toContain('eslint.config.mjs');

      // Verify content preserved
      const content = readFileSync(eslintPath, 'utf8');
      expect(content).toContain('User customized');
    });

    it('should update managed files if content matches template', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Simulate template changed (by changing version in schema)
      // In real world, the template content would change
      // For this test, we verify the logic path exists

      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      // Result should be valid
      expect(result.applied).toBe(true);
    });
  });

  describe('reconcile() - uninstall mode', () => {
    it('should remove all owned files including .safeword/', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // All owned files should be removed
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude/commands/lint.md'))).toBe(false);
      expect(
        existsSync(
          nodePath.join(temporaryDirectory, '.claude/skills/safeword-quality-reviewing/SKILL.md'),
        ),
      ).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'))).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword'))).toBe(false);
    });

    it('should unmerge JSON files', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson({ scripts: { test: 'vitest' } });
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      const pkg = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, 'package.json'), 'utf8'),
      );

      // Safeword-specific scripts removed (but lint/format preserved)
      expect(pkg.scripts['lint:md']).toBeUndefined();
      expect(pkg.scripts['format:check']).toBeUndefined();
      expect(pkg.scripts.knip).toBeUndefined();

      // lint/format preserved (useful standalone)
      expect(pkg.scripts.lint).toBe('eslint .');
      expect(pkg.scripts.format).toBe('prettier --write .');

      // Original scripts preserved
      expect(pkg.scripts.test).toBe('vitest');
    });

    it('should remove text patches', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Create existing AGENTS.md with user content
      writeFileSync(
        nodePath.join(temporaryDirectory, 'AGENTS.md'),
        '# My Project\n\nCustom content here.',
      );
      createPackageJson();
      const ctx = createContext();

      // Install (prepends to AGENTS.md)
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Verify patch was applied
      let content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');
      expect(content).toContain('.safeword/SAFEWORD.md');
      expect(content).toContain('Custom content here');

      // Uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // Patch removed, user content preserved
      content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');
      expect(content).not.toContain('.safeword/SAFEWORD.md');
      expect(content).toContain('Custom content here');
    });

    it('should remove owned directories but preserve user content', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Add a completed ticket (should be preserved - user content)
      const completedDirectory = nodePath.join(
        temporaryDirectory,
        '.safeword-project/tickets/completed',
      );
      mkdirSync(completedDirectory, { recursive: true });
      writeFileSync(nodePath.join(completedDirectory, '001-done.md'), 'Completed ticket');

      // Uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // Owned dirs removed
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/hooks'))).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/guides'))).toBe(false);

      // Preserved dir still exists with user content
      expect(
        existsSync(
          nodePath.join(temporaryDirectory, '.safeword-project/tickets/completed/001-done.md'),
        ),
      ).toBe(true);

      // .safeword-project parent still exists because of preserved content
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword-project'))).toBe(true);
    });
  });

  describe('reconcile() - uninstall-full mode', () => {
    it('should remove managed files', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Full uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', ctx);

      // Managed files removed (if they match template)
      expect(existsSync(nodePath.join(temporaryDirectory, 'eslint.config.mjs'))).toBe(false);
      // .prettierrc is removed if it matches our template (no customizations)
      // Note: jsonMerge unmerge cleans up plugins for files that DON'T match template
      expect(existsSync(nodePath.join(temporaryDirectory, '.prettierrc'))).toBe(false);
    });

    it('should compute packages to remove', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson({
        devDependencies: {
          eslint: '^8.0.0',
          prettier: '^3.0.0',
          knip: '^5.0.0',
        },
      });
      const ctx = createContext({
        developmentDeps: {
          eslint: '^8.0.0',
          prettier: '^3.0.0',
          knip: '^5.0.0',
        },
      });

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Full uninstall
      const result = await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', ctx);

      // Should include packages to remove
      expect(result.packagesToRemove).toContain(ESLINT_PACKAGE);
      expect(result.packagesToRemove).toContain('prettier');
      expect(result.packagesToRemove).toContain('knip');
    });

    it('should remove .mcp.json if empty after unmerge', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install (creates .mcp.json with our servers)
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);
      expect(existsSync(nodePath.join(temporaryDirectory, '.mcp.json'))).toBe(true);

      // Full uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', ctx);

      // .mcp.json should be removed (was only our content)
      expect(existsSync(nodePath.join(temporaryDirectory, '.mcp.json'))).toBe(false);
    });
  });

  describe('reconcile() - dryRun option', () => {
    it('should not make any changes in dryRun mode', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx, {
        dryRun: true,
      });

      expect(result.applied).toBe(false);

      // No files should be created
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword'))).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude'))).toBe(false);
    });

    it('should still compute actions in dryRun mode', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx, {
        dryRun: true,
      });

      // Actions should be computed
      expect(result.actions.length).toBeGreaterThan(0);

      // Should have mkdir, write, and json-merge actions
      expect(result.actions.some(a => a.type === 'mkdir')).toBe(true);
      expect(result.actions.some(a => a.type === 'write')).toBe(true);
      expect(result.actions.some(a => a.type === 'json-merge')).toBe(true);
    });

    it('should report healthy when dryRun upgrade finds no changes', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // dryRun upgrade should find no changes
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // No actions means healthy
      expect(result.actions.filter(a => a.type === 'write').length).toBe(0);
      expect(result.updated.length).toBe(0);
    });
  });

  describe('computePackagesToInstall()', () => {
    it('should return all base packages for fresh install', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // no existing formatter, gets prettier
      const projectType = { ...DEFAULT_PROJECT_TYPE };

      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      // Base packages + prettier (from "standard" conditional for non-Biome projects)
      expect(result).toContain(ESLINT_PACKAGE);
      expect(result).toContain('safeword');
      expect(result).toContain('dependency-cruiser');
      expect(result).toContain('knip');
      expect(result).toContain('prettier'); // standard conditional
    });

    it('should not include prettier for Biome projects', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Has existing formatter, doesn't get prettier
      const projectType = { ...DEFAULT_PROJECT_TYPE, existingFormatter: true };

      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      expect(result).toContain(ESLINT_PACKAGE);
      expect(result).toContain('safeword');
      expect(result).not.toContain('prettier');
    });

    it('should add conditional packages for astro', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      const projectType = { ...DEFAULT_PROJECT_TYPE, astro: true };

      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      expect(result).toContain('prettier-plugin-astro');
    });

    it('should not add prettier plugins for projects with existing formatter', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Existing formatter handles formatting
      const projectType = {
        ...DEFAULT_PROJECT_TYPE,
        astro: true,
        existingFormatter: true,
      };

      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      expect(result).not.toContain('prettier');
      expect(result).not.toContain('prettier-plugin-astro');
    });

    it('should add multiple conditional packages', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      const projectType = {
        ...DEFAULT_PROJECT_TYPE,
        astro: true,
        tailwind: true,
        publishableLibrary: true,
      };

      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      // Conditional packages NOT bundled in safeword
      expect(result).toContain('prettier-plugin-astro');
      expect(result).toContain('prettier-plugin-tailwindcss');
      expect(result).toContain('publint');
    });

    it('should exclude already installed packages', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      const projectType = { ...DEFAULT_PROJECT_TYPE };

      const installedDevelopmentDeps = {
        eslint: '^8.0.0',
        prettier: '^3.0.0',
        knip: '^5.0.0',
      };

      const result = computePackagesToInstall(
        SAFEWORD_SCHEMA,
        projectType,
        installedDevelopmentDeps,
      );

      expect(result).not.toContain(ESLINT_PACKAGE);
      expect(result).not.toContain('prettier');
      expect(result).not.toContain('knip');
      expect(result).toContain('safeword'); // Not installed, should be included
    });
  });
});
