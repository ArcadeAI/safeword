/**
 * Test Suite: Reset Command (Reconcile-based)
 *
 * Tests that the reset command uses reconcile() with mode='uninstall' or 'uninstall-full'
 * to remove safeword configuration.
 *
 * TDD RED phase - these tests verify reconcile integration.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ESLINT_PACKAGE } from '../../src/packs/typescript/files.js';
import {
  createTemporaryDirectory,
  getReconcileTestUtilities,
  removeTemporaryDirectory,
} from '../helpers';

const __dirname = import.meta.dirname;

describe('Reset Command - Reconcile Integration', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  // Helper to create a configured project for uninstall testing
  function createConfiguredProject() {
    // package.json
    writeFileSync(
      nodePath.join(temporaryDirectory, 'package.json'),
      JSON.stringify(
        {
          name: 'test',
          version: '1.0.0',
          scripts: {
            lint: 'eslint .',
            format: 'prettier --write .',
          },
        },
        undefined,
        2,
      ),
    );

    // .safeword directory
    mkdirSync(nodePath.join(temporaryDirectory, '.safeword/hooks'), {
      recursive: true,
    });
    mkdirSync(nodePath.join(temporaryDirectory, '.safeword/guides'), {
      recursive: true,
    });
    mkdirSync(nodePath.join(temporaryDirectory, '.safeword-project/tickets/completed'), {
      recursive: true,
    });
    writeFileSync(nodePath.join(temporaryDirectory, '.safeword/version'), '0.6.3');
    writeFileSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'), '# Test');

    // .claude directory
    mkdirSync(nodePath.join(temporaryDirectory, '.claude/commands'), {
      recursive: true,
    });
    mkdirSync(nodePath.join(temporaryDirectory, '.claude/skills/quality-review'), {
      recursive: true,
    });
    writeFileSync(
      nodePath.join(temporaryDirectory, '.claude/settings.json'),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                hooks: [{ type: 'command', command: '.safeword/hooks/test.sh' }],
              },
              { command: 'echo custom', description: 'Custom' },
            ],
          },
        },
        undefined,
        2,
      ),
    );
    // Note: .claude/commands/ no longer has owned files (all moved to skills)
    writeFileSync(
      nodePath.join(temporaryDirectory, '.claude/skills/quality-review/SKILL.md'),
      '# Skill',
    );

    // .mcp.json
    writeFileSync(
      nodePath.join(temporaryDirectory, '.mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            context7: { command: 'bunx' },
            playwright: { command: 'bunx' },
            custom: { command: 'echo' },
          },
        },
        undefined,
        2,
      ),
    );

    // AGENTS.md
    writeFileSync(
      nodePath.join(temporaryDirectory, 'AGENTS.md'),
      '.safeword/SAFEWORD.md\n\n# My Project',
    );

    // Linting config
    writeFileSync(nodePath.join(temporaryDirectory, 'eslint.config.mjs'), '// eslint config');
    writeFileSync(nodePath.join(temporaryDirectory, '.prettierrc'), '{}');
  }

  describe('reconcile mode=uninstall', () => {
    it('should remove .claude owned files', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } =
        await getReconcileTestUtilities(temporaryDirectory);

      createConfiguredProject();

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // .claude/commands/ should be empty (all commands moved to skills)
      const commandsDirectory = nodePath.join(temporaryDirectory, '.claude/commands');
      const commandFiles = existsSync(commandsDirectory)
        ? readdirSync(commandsDirectory).filter(f => f.endsWith('.md'))
        : [];
      expect(commandFiles.length).toBe(0);

      // .claude/skills/* should be removed
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude/skills/quality-review'))).toBe(
        false,
      );
    });

    it('should unmerge JSON settings (remove safeword hooks, keep custom)', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } =
        await getReconcileTestUtilities(temporaryDirectory);

      createConfiguredProject();

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // Settings should still exist with custom hooks
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude/settings.json'))).toBe(true);
      const settings = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, '.claude/settings.json'), 'utf8'),
      );

      // Custom hook should be preserved
      const hasCustom = settings.hooks?.SessionStart?.some(
        (h: { command?: string }) => h.command === 'echo custom',
      );
      expect(hasCustom).toBe(true);
    });

    it('should remove safeword link from AGENTS.md via text-unpatch', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } =
        await getReconcileTestUtilities(temporaryDirectory);

      createConfiguredProject();

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // AGENTS.md should no longer have the safeword link
      const content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');
      expect(content).not.toContain('.safeword/SAFEWORD.md');
      expect(content).toContain('My Project'); // Original content preserved
    });

    it('should clean up safeword-owned directories', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } =
        await getReconcileTestUtilities(temporaryDirectory);

      createConfiguredProject();

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // Safeword-owned directories should be removed
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/hooks'))).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/guides'))).toBe(false);
    });

    it('should remove owned directories (except preserved)', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } =
        await getReconcileTestUtilities(temporaryDirectory);

      createConfiguredProject();

      // Add a user file to tickets/completed (preserved dir)
      writeFileSync(
        nodePath.join(temporaryDirectory, '.safeword-project/tickets/completed/001-done.md'),
        '# Done ticket',
      );

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // .safeword owned dirs should be removed
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/hooks'))).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/guides'))).toBe(false);

      // .safeword-project/tickets/completed is a preservedDir, should still exist if it has user content
      expect(
        existsSync(
          nodePath.join(temporaryDirectory, '.safeword-project/tickets/completed/001-done.md'),
        ),
      ).toBe(true);
    });

    it('should unmerge MCP servers', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } =
        await getReconcileTestUtilities(temporaryDirectory);

      createConfiguredProject();

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // .mcp.json should exist with custom server
      expect(existsSync(nodePath.join(temporaryDirectory, '.mcp.json'))).toBe(true);
      const mcp = JSON.parse(readFileSync(nodePath.join(temporaryDirectory, '.mcp.json'), 'utf8'));
      expect(mcp.mcpServers?.context7).toBeUndefined();
      expect(mcp.mcpServers?.playwright).toBeUndefined();
      expect(mcp.mcpServers?.custom).toBeDefined();
    });

    it('should preserve managed files (eslint, prettier)', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } =
        await getReconcileTestUtilities(temporaryDirectory);

      createConfiguredProject();

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // Managed files should still exist
      expect(existsSync(nodePath.join(temporaryDirectory, 'eslint.config.mjs'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.prettierrc'))).toBe(true);
    });
  });

  describe('reconcile mode=uninstall-full', () => {
    it('should also remove managed files', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } =
        await getReconcileTestUtilities(temporaryDirectory);

      createConfiguredProject();

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', ctx);

      // Managed files should be removed (if they match template)
      expect(existsSync(nodePath.join(temporaryDirectory, 'eslint.config.mjs'))).toBe(false);
      // .prettierrc is removed if it matches our template (no customizations)
      expect(existsSync(nodePath.join(temporaryDirectory, '.prettierrc'))).toBe(false);
    });

    it('should compute packages to remove', async () => {
      const { reconcile, SAFEWORD_SCHEMA, createProjectContext } =
        await getReconcileTestUtilities(temporaryDirectory);

      createConfiguredProject();

      // Remove .prettierrc so existingFormatter detection is false
      // (otherwise prettier won't be included in packages to remove)
      rmSync(nodePath.join(temporaryDirectory, '.prettierrc'), { force: true });

      // Add devDependencies to check removal
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify(
          {
            name: 'test',
            version: '1.0.0',
            devDependencies: {
              eslint: '^8.0.0',
              prettier: '^3.0.0',
              knip: '^5.0.0',
            },
          },
          undefined,
          2,
        ),
      );

      const ctx = createProjectContext(temporaryDirectory);
      const result = await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', ctx, {
        dryRun: true,
      });

      // Should report packages to remove
      expect(result.packagesToRemove.length).toBeGreaterThan(0);
      expect(result.packagesToRemove).toContain(ESLINT_PACKAGE);
      expect(result.packagesToRemove).toContain('prettier');
    });
  });

  describe('reset command integration', () => {
    it('should run reset successfully via CLI', async () => {
      createConfiguredProject();

      const cliPath = nodePath.resolve(__dirname, '../../src/cli.ts');
      try {
        const result = execSync(`bunx tsx ${cliPath} reset --yes`, {
          cwd: temporaryDirectory,
          encoding: 'utf8',
          timeout: 30_000,
        });

        expect(result).toContain('Reset');

        // .safeword should be removed
        expect(existsSync(nodePath.join(temporaryDirectory, '.safeword'))).toBe(false);
      } catch (error) {
        const stdout = (error as { stdout?: string }).stdout || '';
        // If reset ran, check the output
        if (stdout.includes('Reset') || stdout.includes('Removed')) {
          expect(existsSync(nodePath.join(temporaryDirectory, '.safeword'))).toBe(false);
        } else {
          throw error;
        }
      }
    });

    it('should do nothing on unconfigured project', async () => {
      // Just package.json, no .safeword
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, undefined, 2),
      );

      const cliPath = nodePath.resolve(__dirname, '../../src/cli.ts');
      const result = execSync(`bunx tsx ${cliPath} reset --yes`, {
        cwd: temporaryDirectory,
        encoding: 'utf8',
        timeout: 30_000,
      });

      expect(result.toLowerCase()).toContain('nothing to remove');
    });
  });
});
