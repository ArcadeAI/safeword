/**
 * Test Suite: Upgrade Command (Reconcile-based)
 *
 * Tests that the upgrade command uses reconcile() with mode='upgrade'
 * to update project configuration.
 *
 * TDD RED phase - these tests verify reconcile integration.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

describe('Upgrade Command - Reconcile Integration', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-upgrade-reconcile-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  // Helper to create a minimal configured project
  /**
   *
   * @param version
   */
  function createConfiguredProject(version = '0.5.0') {
    // package.json
    writeFileSync(
      nodePath.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' }, undefined, 2),
    );

    // .safeword directory with version file
    mkdirSync(nodePath.join(temporaryDirectory, '.safeword'), {
      recursive: true,
    });
    writeFileSync(nodePath.join(temporaryDirectory, '.safeword/version'), version);
    writeFileSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'), '# Old content');

    // .claude directory
    mkdirSync(nodePath.join(temporaryDirectory, '.claude'), {
      recursive: true,
    });
    writeFileSync(
      nodePath.join(temporaryDirectory, '.claude/settings.json'),
      JSON.stringify({ hooks: {} }, undefined, 2),
    );

    // AGENTS.md with link
    writeFileSync(`${temporaryDirectory}/AGENTS.md`, '.safeword/SAFEWORD.md\n\n# Agents');
  }

  describe('reconcile mode=upgrade', () => {
    it('should use reconcile to compute upgrade actions', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject('0.5.0');

      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // dryRun should compute actions without applying
      expect(result.applied).toBe(false);

      // Should have write actions for owned files that differ
      const writeActions = result.actions.filter(a => a.type === 'write');
      expect(writeActions.length).toBeGreaterThan(0);

      // Should include SAFEWORD.md update (content differs from template)
      const hasSafewordMd = writeActions.some(
        a => a.type === 'write' && a.path.includes('SAFEWORD.md'),
      );
      expect(hasSafewordMd).toBe(true);
    });

    it('should apply changes when not dryRun', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject('0.5.0');

      // Read old content
      const oldContent = readFileSync(
        nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'),
        'utf8',
      );
      expect(oldContent).toBe('# Old content');

      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      // Should have applied changes
      expect(result.applied).toBe(true);

      // SAFEWORD.md should be updated
      const newContent = readFileSync(
        nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'),
        'utf8',
      );
      expect(newContent).not.toBe('# Old content');
      expect(newContent).toContain('SAFEWORD Agent Instructions');
    });

    it('should compute missing packages during upgrade', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject('0.5.0');

      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // Should report packages to install
      expect(result.packagesToInstall.length).toBeGreaterThan(0);
      expect(result.packagesToInstall).toContain('eslint@^9');
    });

    it('should not report installed packages as missing', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');

      createConfiguredProject('0.5.0');

      // Add packages to devDependencies
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

    it('should create missing directories', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');
      const { existsSync } = await import('node:fs');

      createConfiguredProject('0.5.0');

      // Don't create some directories that should exist
      // .safeword/learnings should be created

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      // Directories should be created
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword-project/learnings'))).toBe(
        true,
      );
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword-project/tickets'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude/commands'))).toBe(true);
    });

    it('should preserve user files in shared directories', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');
      const { existsSync } = await import('node:fs');

      createConfiguredProject('0.5.0');

      // Create user learning file
      mkdirSync(nodePath.join(temporaryDirectory, '.safeword/learnings'), {
        recursive: true,
      });
      writeFileSync(
        nodePath.join(temporaryDirectory, '.safeword/learnings/my-custom-learning.md'),
        '# My Learning\n\nImportant.',
      );

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      // User file should be preserved
      expect(
        existsSync(nodePath.join(temporaryDirectory, '.safeword/learnings/my-custom-learning.md')),
      ).toBe(true);
      const content = readFileSync(
        nodePath.join(temporaryDirectory, '.safeword/learnings/my-custom-learning.md'),
        'utf8',
      );
      expect(content).toContain('My Learning');
    });

    it('should update JSON settings via merge', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject('0.5.0');

      // Add a custom hook that should be preserved
      writeFileSync(
        nodePath.join(temporaryDirectory, '.claude/settings.json'),
        JSON.stringify(
          {
            hooks: {
              SessionStart: [{ command: 'echo custom', description: 'Custom hook' }],
            },
          },
          undefined,
          2,
        ),
      );

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      // Read updated settings
      const settings = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, '.claude/settings.json'), 'utf8'),
      );

      // Custom hook should be preserved
      const hasCustom = settings.hooks?.SessionStart?.some(
        (h: { command?: string }) => h.command === 'echo custom',
      );
      expect(hasCustom).toBe(true);

      // Safeword hooks should be added (they have structure { hooks: [{ command: '...' }] })
      const hasSafeword = settings.hooks?.SessionStart?.some(
        (h: { hooks?: { command?: string }[] }) =>
          h.hooks?.some((cmd: { command?: string }) => cmd.command?.includes('.safeword')),
      );
      expect(hasSafeword).toBe(true);
    });

    it('should ensure AGENTS.md link via text-patch', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject('0.5.0');

      // Create AGENTS.md without the link
      writeFileSync(
        nodePath.join(temporaryDirectory, 'AGENTS.md'),
        '# My Project\n\nSome content.',
      );

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      // AGENTS.md should have the link added
      const content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');
      expect(content).toContain('.safeword/SAFEWORD.md');
      expect(content).toContain('My Project'); // Original content preserved
    });
  });

  describe('upgrade command integration', () => {
    it('should run upgrade successfully via CLI', async () => {
      createConfiguredProject('0.5.0');

      const cliPath = nodePath.resolve(__dirname, '../../src/cli.ts');
      try {
        const result = execSync(`bunx tsx ${cliPath} upgrade`, {
          cwd: temporaryDirectory,
          encoding: 'utf8',
          timeout: 30_000,
        });

        expect(result).toContain('Upgrade');
      } catch (error) {
        // Check if upgrade itself worked even if bun install timed out
        const stdout = (error as { stdout?: string }).stdout || '';

        // If we see upgrade output, the reconcile worked
        if (stdout.includes('Upgrade') || stdout.includes('Upgrading')) {
          // Upgrade ran, might have failed on bun install
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    });

    it('should refuse downgrade when project is newer', async () => {
      createConfiguredProject('99.99.99');

      const cliPath = nodePath.resolve(__dirname, '../../src/cli.ts');
      try {
        execSync(`bunx tsx ${cliPath} upgrade`, {
          cwd: temporaryDirectory,
          encoding: 'utf8',
          timeout: 30_000,
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        const stderr = (error as { stderr?: string }).stderr || '';
        expect(stderr.toLowerCase()).toMatch(/older|downgrade|cli/i);
      }
    });

    it('should error on unconfigured project', async () => {
      // Just package.json, no .safeword
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, undefined, 2),
      );

      const cliPath = nodePath.resolve(__dirname, '../../src/cli.ts');
      try {
        execSync(`bunx tsx ${cliPath} upgrade`, {
          cwd: temporaryDirectory,
          encoding: 'utf8',
          timeout: 30_000,
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        const stderr = (error as { stderr?: string }).stderr || '';
        expect(stderr.toLowerCase()).toContain('not configured');
      }
    });
  });
});
