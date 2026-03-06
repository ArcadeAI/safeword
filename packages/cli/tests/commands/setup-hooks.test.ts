/**
 * Test Suite 3: Setup - Hooks and Skills
 *
 * Tests for Claude Code hook registration and skill copying.
 */

import { chmodSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_BUN_INSTALL,
  writeTestFile,
} from '../helpers';

interface HookCommand {
  command?: string;
}

interface HookEntry {
  hooks?: HookCommand[];
}

/**
 * Check if hook entry contains command matching pattern
 * @param entry
 * @param pattern
 */
function hasHookCommand(entry: HookEntry, pattern: string): boolean {
  return entry.hooks?.some(h => h.command?.includes(pattern)) ?? false;
}

describe('Test Suite 3: Setup - Hooks and Skills', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 3.1: Registers hooks in settings.json', () => {
    it(
      'should create .claude/settings.json with hooks',
      async () => {
        createTypeScriptPackageJson(temporaryDirectory);
        initGitRepo(temporaryDirectory);

        await runCli(['setup'], { cwd: temporaryDirectory });

        expect(fileExists(temporaryDirectory, '.claude/settings.json')).toBe(true);

        const settings = JSON.parse(readTestFile(temporaryDirectory, '.claude/settings.json'));

        expect(settings.hooks).toBeDefined();
        expect(settings.hooks.SessionStart).toBeDefined();
        expect(Array.isArray(settings.hooks.SessionStart)).toBe(true);
        expect(settings.hooks.UserPromptSubmit).toBeDefined();
        expect(Array.isArray(settings.hooks.UserPromptSubmit)).toBe(true);
        expect(settings.hooks.PostToolUse).toBeDefined();
        expect(Array.isArray(settings.hooks.PostToolUse)).toBe(true);
      },
      TIMEOUT_BUN_INSTALL,
    );

    it('should reference .safeword/hooks paths', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const settings = JSON.parse(readTestFile(temporaryDirectory, '.claude/settings.json'));
      const settingsString = JSON.stringify(settings);

      // At least one hook should reference .safeword/hooks
      expect(settingsString).toContain('.safeword/hooks');
    });
  });

  describe('Test 3.2: Copies skills to .claude/skills', () => {
    it('should create skills directory with safeword skills', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.claude/skills')).toBe(true);

      // Check for skill directory (short names, no safeword- prefix)
      expect(fileExists(temporaryDirectory, '.claude/skills/quality-review')).toBe(true);

      // The skill should contain a SKILL.md file
      expect(fileExists(temporaryDirectory, '.claude/skills/quality-review/SKILL.md')).toBe(true);

      const skillContent = readTestFile(
        temporaryDirectory,
        '.claude/skills/quality-review/SKILL.md',
      );
      expect(skillContent).toContain('Quality Review');
    });
  });

  describe('Test 3.3: Preserves existing hooks', () => {
    it('should append to existing hooks without replacing', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      // Create existing settings with custom hook
      const existingSettings = {
        hooks: {
          SessionStart: [
            {
              command: 'echo "My custom hook"',
              description: 'Custom SessionStart hook',
            },
          ],
        },
      };
      writeTestFile(
        temporaryDirectory,
        '.claude/settings.json',
        JSON.stringify(existingSettings, undefined, 2),
      );

      await runCli(['setup'], { cwd: temporaryDirectory });

      const settings = JSON.parse(readTestFile(temporaryDirectory, '.claude/settings.json'));

      // Custom hook should still be present
      const hasCustomHook = settings.hooks.SessionStart.some(
        (hook: { command?: string }) => hook.command === 'echo "My custom hook"',
      );
      expect(hasCustomHook).toBe(true);

      // Safeword hooks should be added
      expect(settings.hooks.SessionStart.length).toBeGreaterThan(1);
    });
  });

  describe('Test 3.4: Includes SessionStart hook for AGENTS.md', () => {
    it('should include AGENTS.md verification hook', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const settings = JSON.parse(readTestFile(temporaryDirectory, '.claude/settings.json'));

      // Find hook entry that references AGENTS.md check (new nested format)
      const agentsHookEntry = settings.hooks.SessionStart.find(
        (entry: HookEntry) => hasHookCommand(entry, 'AGENTS') || hasHookCommand(entry, 'agents'),
      );

      expect(agentsHookEntry).toBeDefined();

      // Hook script should exist
      const agentsCommand = agentsHookEntry?.hooks?.[0]?.command;
      if (agentsCommand) {
        // Extract script path from command if it's a bash script
        const scriptMatch = agentsCommand.match(/bash\s+(\S+)/);
        if (scriptMatch) {
          expect(fileExists(temporaryDirectory, scriptMatch[1])).toBe(true);
        }
      }
    });
  });

  describe('Test 3.6: Includes UserPromptSubmit hook for timestamp injection', () => {
    it('should include timestamp injection hook', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const settings = JSON.parse(readTestFile(temporaryDirectory, '.claude/settings.json'));

      // Find hook entry that references timestamp injection (new nested format)
      const timestampHookEntry = settings.hooks.UserPromptSubmit.find((entry: HookEntry) =>
        hasHookCommand(entry, 'prompt-timestamp'),
      );

      expect(timestampHookEntry).toBeDefined();

      // Hook script should exist
      expect(fileExists(temporaryDirectory, '.safeword/hooks/prompt-timestamp.ts')).toBe(true);

      // Script should contain timestamp output
      const scriptContent = readTestFile(temporaryDirectory, '.safeword/hooks/prompt-timestamp.ts');
      expect(scriptContent).toContain('Date');
    });
  });

  describe('Test 3.5: Exit 1 if hook registration fails', () => {
    it('should fail with exit 1 when settings.json is not writable', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      // Create .claude directory with read-only settings.json
      writeTestFile(temporaryDirectory, '.claude/settings.json', '{}');
      chmodSync(nodePath.join(temporaryDirectory, '.claude/settings.json'), 0o444);

      const result = await runCli(['setup'], {
        cwd: temporaryDirectory,
      });

      // Restore permissions for cleanup
      chmodSync(nodePath.join(temporaryDirectory, '.claude/settings.json'), 0o644);

      expect(result.exitCode).toBe(1);
      expect(result.stderr.toLowerCase()).toMatch(/hook|permission|write|failed/i);
    });
  });

  describe('Test 3.7: Installs lib scripts', () => {
    it('should install shared library scripts to .safeword/hooks/lib/', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      // Lib directory should exist with TypeScript modules
      expect(fileExists(temporaryDirectory, '.safeword/hooks/lib')).toBe(true);

      const libraryDirectory = nodePath.join(temporaryDirectory, '.safeword/hooks/lib');
      const tsFiles = readdirSync(libraryDirectory).filter(f => f.endsWith('.ts'));
      expect(tsFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Test 3.8: Sets up MCP servers', () => {
    it('should create .mcp.json with context7 and playwright', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.mcp.json')).toBe(true);

      const mcpConfig = JSON.parse(readTestFile(temporaryDirectory, '.mcp.json'));
      expect(mcpConfig.mcpServers).toBeDefined();
      expect(mcpConfig.mcpServers.context7).toBeDefined();
      expect(mcpConfig.mcpServers.playwright).toBeDefined();
    });
  });

  describe('Test 3.9: Preserves existing MCP servers', () => {
    it(
      'should preserve user MCP servers when adding safeword servers',
      async () => {
        createTypeScriptPackageJson(temporaryDirectory);
        initGitRepo(temporaryDirectory);

        // Create existing .mcp.json with custom server
        const existingMcp = {
          mcpServers: {
            'my-custom-server': {
              command: 'my-server',
              args: ['--port', '3000'],
            },
          },
        };
        writeTestFile(temporaryDirectory, '.mcp.json', JSON.stringify(existingMcp, undefined, 2));

        await runCli(['setup'], { cwd: temporaryDirectory });

        const mcpConfig = JSON.parse(readTestFile(temporaryDirectory, '.mcp.json'));

        // Custom server should be preserved
        expect(mcpConfig.mcpServers['my-custom-server']).toBeDefined();
        expect(mcpConfig.mcpServers['my-custom-server'].command).toBe('my-server');

        // Safeword servers should be added
        expect(mcpConfig.mcpServers.context7).toBeDefined();
        expect(mcpConfig.mcpServers.playwright).toBeDefined();
      },
      TIMEOUT_BUN_INSTALL,
    );
  });

  describe('Test 3.10: Installs slash commands', () => {
    it('should install slash commands to .claude/commands/', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      // Commands directory should exist
      expect(fileExists(temporaryDirectory, '.claude/commands')).toBe(true);

      // Should contain markdown command files
      const commandsDirectory = nodePath.join(temporaryDirectory, '.claude/commands');
      const mdFiles = readdirSync(commandsDirectory).filter(f => f.endsWith('.md'));
      expect(mdFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Test 3.11: MCP servers work out of the box', () => {
    it('should configure context7 with correct bunx command', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.mcp.json')).toBe(true);

      const mcpConfig = JSON.parse(readTestFile(temporaryDirectory, '.mcp.json'));

      // Context7 should use bunx with the correct package
      expect(mcpConfig.mcpServers.context7).toBeDefined();
      expect(mcpConfig.mcpServers.context7.command).toBe('bunx');
      expect(mcpConfig.mcpServers.context7.args).toContain('@upstash/context7-mcp@latest');
    });

    it('should configure playwright with correct bunx command', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      await runCli(['setup'], { cwd: temporaryDirectory });

      const mcpConfig = JSON.parse(readTestFile(temporaryDirectory, '.mcp.json'));

      // Playwright should use bunx with the correct package
      expect(mcpConfig.mcpServers.playwright).toBeDefined();
      expect(mcpConfig.mcpServers.playwright.command).toBe('bunx');
      expect(mcpConfig.mcpServers.playwright.args).toEqual(
        expect.arrayContaining([expect.stringContaining('@playwright/mcp')]),
      );
    });

    it('should have MCP packages that can be resolved by bunx', async () => {
      // Verify the packages exist on npm registry (lightweight HTTP check)
      const packages = ['@upstash/context7-mcp', '@playwright/mcp'];

      for (const pkg of packages) {
        const response = await fetch(`https://registry.npmjs.org/${pkg}`, {
          signal: AbortSignal.timeout(10_000),
        });
        expect(response.ok, `${pkg} package not found on npm registry`).toBe(true);
      }
    });
  });
});
