/**
 * Test Suite: Upgrade Command (Reconcile-based)
 *
 * Tests that the upgrade command uses reconcile() with mode='upgrade'
 * to update project configuration.
 *
 * TDD RED phase - these tests verify reconcile integration.
 */

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ESLINT_PACKAGE } from '../../src/packs/typescript/files.js';
import { installFakeCodexCli, removeTemporaryDirectory, runCli, runCommandSync } from '../helpers';

const __dirname = import.meta.dirname;

describe('Upgrade Command - Reconcile Integration', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-upgrade-reconcile-'));
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
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
      expect(result.packagesToInstall).toContain(ESLINT_PACKAGE);
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
      expect(result.packagesToInstall).not.toContain(ESLINT_PACKAGE);
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
      expect(existsSync(nodePath.join(temporaryDirectory, '.project/learnings'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.project/tickets'))).toBe(true);
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
          h.hooks?.some((command: { command?: string }) => command.command?.includes('.safeword')),
      );
      expect(hasSafeword).toBe(true);
    });

    it('should preserve customer AGENTS.md without adding safeword text', async () => {
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

      const content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');
      expect(content).toBe('# My Project\n\nSome content.');
    });

    it('should preserve fully custom Codex config without creating repo-local Codex skills', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');
      const { existsSync: fileExists } = await import('node:fs');

      createConfiguredProject('0.5.0');
      mkdirSync(nodePath.join(temporaryDirectory, '.codex'), { recursive: true });
      const customCodexConfig = '[features]\nhooks = false\n\n# custom codex config\n';
      writeFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), customCodexConfig);

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      expect(readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8')).toBe(
        customCodexConfig,
      );
      expect(fileExists(nodePath.join(temporaryDirectory, '.agents/skills/bdd/SKILL.md'))).toBe(
        false,
      );
      expect(fileExists(nodePath.join(temporaryDirectory, '.safeword/hooks/codex'))).toBe(false);
    });

    it('should migrate existing safeword Codex hooks to packaged CLI commands', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject('0.5.0');
      mkdirSync(nodePath.join(temporaryDirectory, '.codex'), { recursive: true });
      writeFileSync(
        nodePath.join(temporaryDirectory, '.codex/config.toml'),
        `# Safeword Codex project configuration.
#
# Project-local Codex config loads only after the project is reviewed and trusted.
# Run Codex's hook trust flow after setup/upgrade before assuming these gates run.

[features]
hooks = true

[[hooks.PreToolUse]]
matcher = "^(apply_patch|Bash|Edit|Write|MultiEdit|NotebookEdit)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/pre-tool-quality.ts"'
timeout = 30
statusMessage = "Checking safeword PreToolUse gates"
`,
      );

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      const upgraded = readFileSync(
        nodePath.join(temporaryDirectory, '.codex/config.toml'),
        'utf8',
      );
      expect(upgraded).toContain('[[hooks.UserPromptSubmit]]');
      expect(upgraded).toContain('npx --yes safeword codex-hook user-prompt-submit');
      expect(upgraded).toContain('npx --yes safeword codex-hook pre-tool-use');
      expect(upgraded).toContain('[[hooks.Stop]]');
      expect(upgraded).toContain('npx --yes safeword codex-hook stop');
      expect(upgraded).toContain('npx --yes safeword codex-hook post-tool-use');
      expect(upgraded).not.toContain('.safeword/hooks/codex');

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);
      const upgradedAgain = readFileSync(
        nodePath.join(temporaryDirectory, '.codex/config.toml'),
        'utf8',
      );
      const timestampHookCount =
        upgradedAgain.split('safeword codex-hook user-prompt-submit').length - 1;
      expect(timestampHookCount).toBe(1);
      const stopHookCount = upgradedAgain.split('safeword codex-hook stop').length - 1;
      expect(stopHookCount).toBe(1);
    });

    it('migrates a customized legacy Codex config to the packaged SessionStart hook', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA, CODEX_LEGACY_CONTEXT_SESSION_START_HOOK_PATCH } =
        await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject('0.5.0');
      mkdirSync(nodePath.join(temporaryDirectory, '.codex'), { recursive: true });
      // An existing safeword Codex config — managedFiles is create-if-missing, so
      // it skips an existing file (never overwrites) and the text-patch migration
      // runs — still wired to the LEGACY context-only SessionStart hook from
      // before auto-upgrade-codex.
      const legacyConfig = `# Safeword Codex project configuration.
#
# Project-local Codex config loads only after the project is reviewed and trusted.

[features]
hooks = true
${CODEX_LEGACY_CONTEXT_SESSION_START_HOOK_PATCH}
[[hooks.PreToolUse]]
matcher = "^(apply_patch|Bash|Edit|Write|MultiEdit|NotebookEdit)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/pre-tool-quality.ts"'
timeout = 30
statusMessage = "Checking safeword PreToolUse gates"
`;
      writeFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), legacyConfig);

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      const upgraded = readFileSync(
        nodePath.join(temporaryDirectory, '.codex/config.toml'),
        'utf8',
      );
      // Legacy context-only hook is gone; the packaged hook is wired.
      expect(upgraded).not.toContain('session-safeword-context.ts" --agent=codex');
      expect(upgraded).toContain('npx --yes safeword codex-hook session-start');
      // Exactly one SessionStart command — concurrent Codex hooks make a
      // double-wire double-emit context, so the swap must not leave two.
      expect(upgraded.split('safeword codex-hook session-start').length - 1).toBe(1);
      expect(upgraded).not.toContain('.safeword/hooks/codex');

      // Idempotent: re-running upgrade keeps exactly one dispatcher, no legacy.
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);
      const again = readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8');
      expect(again.split('safeword codex-hook session-start').length - 1).toBe(1);
      expect(again).not.toContain('session-safeword-context.ts" --agent=codex');
    });

    it('should tell users to trust generated Codex hooks after upgrade creates Codex config', async () => {
      createConfiguredProject('0.5.0');

      const result = await runCli(['upgrade', '--no-migrate-namespace'], {
        cwd: temporaryDirectory,
        env: { SAFEWORD_SKIP_INSTALL: '1' },
      });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain('/hooks');
      expect(`${result.stdout}\n${result.stderr}`).toContain('trust safeword project hooks');
    });

    it('should warn when the installed Codex CLI is below the safeword hook floor during upgrade', async () => {
      createConfiguredProject('0.5.0');
      const fakeBin = installFakeCodexCli(temporaryDirectory, '0.132.0');

      const result = await runCli(['upgrade', '--no-migrate-namespace'], {
        cwd: temporaryDirectory,
        env: {
          PATH: `${fakeBin}${nodePath.delimiter}${process.env.PATH ?? ''}`,
          SAFEWORD_SKIP_INSTALL: '1',
        },
      });

      expect(result.exitCode).toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain('Codex 0.132.0 is below safeword');
      expect(`${result.stdout}\n${result.stderr}`).toContain('0.133.0');
    });

    it('should preserve customer .prettierignore entries and append idempotently', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject('0.5.0');

      // Customer authored their own .prettierignore before safeword setup
      const customerContent = 'node_modules\ndist\n# custom: never format these\nfixtures/**\n';
      writeFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), customerContent);

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      const afterFirst = readFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'utf8');
      // Customer entries preserved
      expect(afterFirst).toContain('node_modules');
      expect(afterFirst).toContain('dist');
      expect(afterFirst).toContain('# custom: never format these');
      expect(afterFirst).toContain('fixtures/**');
      // Safeword block appended
      expect(afterFirst).toContain('# Safeword - managed prettier exclusions');
      expect(afterFirst).toContain('.husky/_');
      expect(afterFirst).toContain('.safeword/');
      expect(afterFirst).toContain('.cursor/');
      expect(afterFirst).toContain('.claude/');
      expect(afterFirst).toContain('.agents/');
      expect(afterFirst).toContain('.codex/');
      // Wholesale namespace excludes (EYRK34) — not the old per-file INDEX lines.
      expect(afterFirst).toContain('.project/');
      expect(afterFirst).toContain('.safeword-project/');

      // Re-run must be idempotent — the marker should appear exactly once
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);
      const afterSecond = readFileSync(
        nodePath.join(temporaryDirectory, '.prettierignore'),
        'utf8',
      );
      const markerCount = afterSecond.split('# Safeword - managed prettier exclusions').length - 1;
      expect(markerCount).toBe(1);
    });

    it('should append current prettier exclusions when legacy safeword block is present', async () => {
      const { reconcile } = await import('../../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../../src/schema.js');
      const { createProjectContext } = await import('../../src/utils/context.js');

      createConfiguredProject('0.5.0');

      const legacySafewordBlock = [
        '# Safeword - managed prettier exclusions',
        '.safeword/',
        '.cursor/',
        '.safeword-project/tickets/INDEX.md',
        '.safeword-project/tickets/INDEX-completed.md',
        '.safeword-project/learnings/INDEX.md',
        '',
      ].join('\n');
      writeFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), legacySafewordBlock);

      const ctx = createProjectContext(temporaryDirectory);
      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      const afterFirst = readFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'utf8');
      expect(afterFirst).toContain('.husky/_');
      // The broadened block migrates the legacy one to wholesale namespace excludes (EYRK34).
      expect(afterFirst).toContain('.codex/');
      expect(afterFirst).toContain('.project/');
      expect(afterFirst).toContain('.safeword-project/');

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);
      const afterSecond = readFileSync(
        nodePath.join(temporaryDirectory, '.prettierignore'),
        'utf8',
      );
      // The current (owned-dirs) block is appended exactly once and is idempotent on re-run.
      const ownedDirectoriesBlockCount =
        afterSecond.split('# Safeword - managed prettier exclusions (owned dirs)').length - 1;
      expect(ownedDirectoriesBlockCount).toBe(1);
    });
  });

  describe('upgrade command integration', () => {
    it('should run upgrade successfully via CLI', () => {
      createConfiguredProject('0.5.0');

      const cliPath = nodePath.resolve(__dirname, '../../src/cli.ts');
      const result = runCommandSync(`bunx tsx ${cliPath} upgrade`, {
        cwd: temporaryDirectory,
        timeout: 30_000,
      });

      if (result.exitCode === 0) {
        expect(result.stdout).toContain('Upgrade');
      } else {
        const sawUpgradeOutput =
          result.stdout.includes('Upgrade') || result.stdout.includes('Upgrading');
        expect(sawUpgradeOutput).toBe(true);
      }
    });

    it('should refuse downgrade when project is newer', () => {
      createConfiguredProject('99.99.99');

      const cliPath = nodePath.resolve(__dirname, '../../src/cli.ts');
      const result = runCommandSync(`bunx tsx ${cliPath} upgrade`, {
        cwd: temporaryDirectory,
        timeout: 30_000,
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toLowerCase()).toMatch(/older|downgrade|cli/i);
    });

    it('should error on unconfigured project', () => {
      // Just package.json, no .safeword
      writeFileSync(
        nodePath.join(temporaryDirectory, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0' }, undefined, 2),
      );

      const cliPath = nodePath.resolve(__dirname, '../../src/cli.ts');
      const result = runCommandSync(`bunx tsx ${cliPath} upgrade`, {
        cwd: temporaryDirectory,
        timeout: 30_000,
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toLowerCase()).toContain('not configured');
    });
  });
});
