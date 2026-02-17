/**
 * Test Suite: Check Command (Reconcile-based)
 *
 * Tests that the check command uses reconcile() with dryRun
 * to detect issues in the project configuration.
 *
 * TDD RED phase - these tests verify reconcile integration.
 */

import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

describe('Check Command - Reconcile Integration', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-check-reconcile-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  // Helper to create a minimal configured project
  /**
   *
   */
  function createConfiguredProject() {
    // package.json
    writeFileSync(
      nodePath.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' }, undefined, 2),
    );

    // .safeword directory with minimal files
    mkdirSync(nodePath.join(temporaryDirectory, '.safeword'), {
      recursive: true,
    });
    writeFileSync(nodePath.join(temporaryDirectory, '.safeword/version'), '0.6.3');
    writeFileSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'), '# Test');

    // .claude directory
    mkdirSync(nodePath.join(temporaryDirectory, '.claude'), {
      recursive: true,
    });
    writeFileSync(
      nodePath.join(temporaryDirectory, '.claude/settings.json'),
      JSON.stringify({ hooks: {} }, undefined, 2),
    );

    // AGENTS.md
    writeFileSync(
      nodePath.join(temporaryDirectory, 'AGENTS.md'),
      '.safeword/SAFEWORD.md\n\n# Agents',
    );
  }

  describe('checkHealth using reconcile dryRun', () => {
    it('should detect missing files via reconcile dryRun', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject();

      // Delete a file that should exist
      unlinkSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'));

      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // dryRun should detect the missing file as needing to be created
      expect(result.applied).toBe(false);

      // Should have actions to fix the missing file
      const writeActions = result.actions.filter(a => a.type === 'write');
      const hasSafewordMd = writeActions.some(
        a => a.type === 'write' && a.path.includes('SAFEWORD.md'),
      );
      expect(hasSafewordMd).toBe(true);
    });

    it('should report healthy when no changes needed', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      // Full setup to create complete configuration
      const { execSync } = await import('node:child_process');

      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, undefined, 2),
      );

      // Run actual setup (this is an integration test)
      const cliPath = nodePath.resolve(__dirname, '../../src/cli.ts');
      try {
        execSync(`bunx tsx ${cliPath} setup`, {
          cwd: temporaryDirectory,
          stdio: 'pipe',
          timeout: 60_000,
        });
      } catch {
        // May fail due to bun install timeout, but files should be created
      }

      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // After fresh setup, upgrade dryRun should find minimal/no changes
      // (only version file if CLI version differs from project version)
      expect(result.applied).toBe(false);

      // Write actions for owned files should be empty or only version update
      const ownedFileWrites = result.actions.filter(
        a => a.type === 'write' && !a.path.includes('version'),
      );

      // Most files should match (no write actions needed)
      expect(ownedFileWrites.length).toBeLessThan(5);
    });

    it('should detect missing AGENTS.md link', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject();

      // Create AGENTS.md without the safeword link
      writeFileSync(
        nodePath.join(temporaryDirectory, 'AGENTS.md'),
        '# My Project\n\nSome content.',
      );

      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // Should have a text-patch action for AGENTS.md
      const textPatchActions = result.actions.filter(a => a.type === 'text-patch');
      const hasAgentsPatch = textPatchActions.some(
        a => a.type === 'text-patch' && a.path === 'AGENTS.md',
      );
      expect(hasAgentsPatch).toBe(true);
    });

    it('should compute missing packages', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject();

      // No dev dependencies installed
      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // Should report packages to install
      expect(result.packagesToInstall.length).toBeGreaterThan(0);
      expect(result.packagesToInstall).toContain('eslint@^9');
      expect(result.packagesToInstall).toContain('prettier');
    });

    it('should not report installed packages as missing', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');

      createConfiguredProject();

      // Add some packages to devDependencies
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify(
          {
            name: 'test',
            version: '1.0.0',
            devDependencies: {
              eslint: '^8.0.0',
              prettier: '^3.0.0',
              husky: '^9.0.0',
            },
          },
          undefined,
          2,
        ),
      );

      const { createProjectContext } = await import('../../src/utils/context.js');
      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // Installed packages should not be in packagesToInstall
      expect(result.packagesToInstall).not.toContain('eslint@^9');
      expect(result.packagesToInstall).not.toContain('prettier');
      expect(result.packagesToInstall).not.toContain('husky');
    });
  });
});
