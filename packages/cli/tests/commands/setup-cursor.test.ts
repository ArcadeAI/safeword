/**
 * Test Suite: Setup - Cursor IDE Support
 *
 * Tests for Cursor IDE configuration (rules, commands, hooks, MCP).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
} from '../helpers';

describe('Test Suite: Setup - Cursor IDE Support', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Cursor Rules', () => {
    it('should create .cursor/rules/safeword-core.mdc', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup', '--yes'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.cursor/rules/safeword-core.mdc')).toBe(true);

      const content = readTestFile(temporaryDirectory, '.cursor/rules/safeword-core.mdc');
      expect(content).toContain('alwaysApply: true');
      expect(content).toContain('@.safeword/SAFEWORD.md');
    });
  });

  describe('Cursor Commands', () => {
    it('should create .cursor/commands/ directory with command files', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup', '--yes'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.cursor/commands')).toBe(true);
      expect(fileExists(temporaryDirectory, '.cursor/commands/lint.md')).toBe(true);
      expect(fileExists(temporaryDirectory, '.cursor/commands/quality-review.md')).toBe(true);
    });

    it('should install cursor commands from templates', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup', '--yes'], { cwd: temporaryDirectory });

      // Cursor commands are installed (Claude commands moved to skills)
      expect(fileExists(temporaryDirectory, '.cursor/commands')).toBe(true);
    });
  });

  describe('Cursor Hooks', () => {
    it('should create .cursor/hooks.json with version and hooks', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup', '--yes'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.cursor/hooks.json')).toBe(true);

      const hooksConfig = JSON.parse(readTestFile(temporaryDirectory, '.cursor/hooks.json'));
      expect(hooksConfig.version).toBe(1);
      expect(hooksConfig.hooks).toBeDefined();
      expect(hooksConfig.hooks.sessionStart).toBeDefined();
      expect(hooksConfig.hooks.afterFileEdit).toBeDefined();
      expect(hooksConfig.hooks.stop).toBeDefined();
    });

    it('should create Cursor hook scripts in .safeword/hooks/cursor/', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup', '--yes'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.safeword/hooks/cursor/after-file-edit.ts')).toBe(
        true,
      );
      expect(fileExists(temporaryDirectory, '.safeword/hooks/cursor/stop.ts')).toBe(true);
      expect(fileExists(temporaryDirectory, '.safeword/hooks/cursor/gate-adapter.ts')).toBe(true);
      expect(fileExists(temporaryDirectory, '.safeword/hooks/session-cursor-auto-upgrade.ts')).toBe(
        true,
      );
      expect(fileExists(temporaryDirectory, '.safeword/hooks/cursor/pre-tool-quality.ts')).toBe(
        true,
      );
      expect(
        fileExists(temporaryDirectory, '.safeword/hooks/cursor/before-shell-execution.ts'),
      ).toBe(true);
      expect(fileExists(temporaryDirectory, '.safeword/hooks/cursor/post-tool-quality.ts')).toBe(
        true,
      );
    });

    it('should reference correct hook script paths in hooks.json', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup', '--yes'], { cwd: temporaryDirectory });

      // Cursor runs hooks from workspace root, so paths use ./ prefix
      const hooksConfig = JSON.parse(readTestFile(temporaryDirectory, '.cursor/hooks.json'));
      expect(hooksConfig.hooks.sessionStart[0].command).toBe(
        'bun ./.safeword/hooks/session-safeword-context.ts --agent=cursor',
      );
      expect(hooksConfig.hooks.sessionStart[1].command).toBe(
        'bun ./.safeword/hooks/session-cursor-auto-upgrade.ts',
      );
      expect(hooksConfig.hooks.afterFileEdit[0].command).toBe(
        'bun ./.safeword/hooks/cursor/after-file-edit.ts',
      );
      expect(hooksConfig.hooks.stop[0].command).toBe('bun ./.safeword/hooks/cursor/stop.ts');
      // F2TKR3: no beforeSubmitPrompt gate — the phase gate lives at preToolUse
      // (path-aware, session-bound) to avoid the prompt-send catch-22.
      expect(hooksConfig.hooks.beforeSubmitPrompt).toBeUndefined();
      expect(hooksConfig.hooks.preToolUse[0].command).toBe(
        'bun ./.safeword/hooks/cursor/pre-tool-quality.ts',
      );
      // preToolUse is scoped to the edit tool so it never spawns on reads/searches.
      expect(hooksConfig.hooks.preToolUse[0].matcher).toBe('Write');
      // AKNWZK: the done gate runs the suite on the close edit, so the preToolUse
      // timeout is raised, and the stop nudge is capped at one auto-continue.
      expect(hooksConfig.hooks.preToolUse[0].timeout).toBe(90);
      expect(hooksConfig.hooks.stop[0].loop_limit).toBe(1);
      expect(hooksConfig.hooks.beforeShellExecution[0].command).toBe(
        'bun ./.safeword/hooks/cursor/before-shell-execution.ts',
      );
      expect(hooksConfig.hooks.postToolUse[0].command).toBe(
        'bun ./.safeword/hooks/cursor/post-tool-quality.ts',
      );
      expect(hooksConfig.hooks.postToolUse[0].matcher).toBe('Write|Shell');
    });

    it('should set failClosed only on the blocking gate hooks (ANAXG4)', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup', '--yes'], { cwd: temporaryDirectory });

      const hooksConfig = JSON.parse(readTestFile(temporaryDirectory, '.cursor/hooks.json'));

      // Blocking gates deny on crash/timeout/invalid-JSON instead of failing open.
      expect(hooksConfig.hooks.preToolUse[0].failClosed).toBe(true);
      expect(hooksConfig.hooks.beforeShellExecution[0].failClosed).toBe(true);

      // Observational hooks stay fail-open (default) — a crashing lint/state/nudge
      // hook must never block legitimate work.
      expect(hooksConfig.hooks.sessionStart[0].failClosed).toBeUndefined();
      expect(hooksConfig.hooks.sessionStart[1].failClosed).toBeUndefined();
      expect(hooksConfig.hooks.afterFileEdit[0].failClosed).toBeUndefined();
      expect(hooksConfig.hooks.postToolUse[0].failClosed).toBeUndefined();
      expect(hooksConfig.hooks.stop[0].failClosed).toBeUndefined();
    });
  });

  describe('Cursor MCP Configuration', () => {
    it('should create .cursor/mcp.json with same servers as .mcp.json', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup', '--yes'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.cursor/mcp.json')).toBe(true);

      const cursorMcp = JSON.parse(readTestFile(temporaryDirectory, '.cursor/mcp.json'));
      const claudeMcp = JSON.parse(readTestFile(temporaryDirectory, '.mcp.json'));

      expect(cursorMcp.mcpServers.context7).toEqual(claudeMcp.mcpServers.context7);
      expect(cursorMcp.mcpServers.playwright).toEqual(claudeMcp.mcpServers.playwright);
    });
  });

  describe('Reset removes Cursor files', () => {
    it('should remove .cursor directory on reset', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup', '--yes'], { cwd: temporaryDirectory });
      expect(fileExists(temporaryDirectory, '.cursor')).toBe(true);

      await runCli(['reset', '--yes'], { cwd: temporaryDirectory });
      expect(fileExists(temporaryDirectory, '.cursor')).toBe(false);
    });

    it('should remove .safeword/hooks/cursor/ on reset', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup', '--yes'], { cwd: temporaryDirectory });
      expect(fileExists(temporaryDirectory, '.safeword/hooks/cursor')).toBe(true);

      await runCli(['reset', '--yes'], { cwd: temporaryDirectory });
      expect(fileExists(temporaryDirectory, '.safeword/hooks/cursor')).toBe(false);
    });
  });
});
