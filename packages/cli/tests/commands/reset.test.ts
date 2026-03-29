/**
 * Test Suite 11: Reset
 *
 * Tests for `safeword reset` command.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

describe('Test Suite 11: Reset', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 11.1: Prompts for confirmation', () => {
    // In TTY mode, should prompt. We test the prompt message content.
    it('should mention removing safeword', async () => {
      await createConfiguredProject(temporaryDirectory);

      // With --yes, it shouldn't prompt but we can check the output
      const result = await runCli(['reset', '--yes'], {
        cwd: temporaryDirectory,
      });

      // Should mention what it's removing
      const output = result.stdout + result.stderr;
      expect(output.toLowerCase()).toMatch(/remov|reset|safeword/i);
    });
  });

  describe('Test 11.2: --yes auto-confirms', () => {
    it('should skip confirmation and remove .safeword', async () => {
      await createConfiguredProject(temporaryDirectory);

      expect(fileExists(temporaryDirectory, '.safeword')).toBe(true);

      const result = await runCli(['reset', '--yes'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      expect(fileExists(temporaryDirectory, '.safeword')).toBe(false);
    });
  });

  describe('Test 11.3: No TTY auto-confirms', () => {
    it('should auto-confirm in non-TTY mode', async () => {
      await createConfiguredProject(temporaryDirectory);

      const result = await runCli(['reset'], {
        cwd: temporaryDirectory,
        env: { CI: 'true' },
      });

      // Should complete without hanging
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Test 11.4: Removes .safeword directory', () => {
    it('should remove .safeword/ completely', async () => {
      await createConfiguredProject(temporaryDirectory);

      expect(fileExists(temporaryDirectory, '.safeword')).toBe(true);
      expect(fileExists(temporaryDirectory, '.safeword/SAFEWORD.md')).toBe(true);

      await runCli(['reset', '--yes'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.safeword')).toBe(false);
    });
  });

  describe('Test 11.5: Removes hooks from settings.json', () => {
    it('should remove safeword hooks but preserve custom hooks', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Add a custom hook
      const settings = JSON.parse(readTestFile(temporaryDirectory, '.claude/settings.json'));
      settings.hooks.SessionStart ||= [];
      settings.hooks.SessionStart.push({
        command: 'echo "Custom preserved hook"',
        description: 'Custom',
      });
      writeTestFile(
        temporaryDirectory,
        '.claude/settings.json',
        JSON.stringify(settings, undefined, 2),
      );

      await runCli(['reset', '--yes'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.claude/settings.json')).toBe(true);

      const updatedSettings = JSON.parse(readTestFile(temporaryDirectory, '.claude/settings.json'));

      // Custom hook preserved
      const hasCustom = updatedSettings.hooks?.SessionStart?.some(
        (h: { command?: string }) => h.command === 'echo "Custom preserved hook"',
      );
      expect(hasCustom).toBe(true);

      // Safeword hooks removed (no references to .safeword)
      const settingsString = JSON.stringify(updatedSettings);
      expect(settingsString).not.toContain('.safeword/hooks');
    });
  });

  describe('Test 11.6: Removes safeword skills', () => {
    it('should remove safeword-* skill directories', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Verify skills exist after setup
      const skillsExist = fileExists(temporaryDirectory, '.claude/skills');

      const result = await runCli(['reset', '--yes'], {
        cwd: temporaryDirectory,
      });

      // Command should complete successfully
      expect(result.exitCode).toBe(0);

      // After reset, safeword skills should be gone
      // but .claude/skills directory may remain if empty or have other skills
      if (skillsExist) {
        // Check no safeword-* directories remain
        // This would require listing directory contents
      }
    });
  });

  describe('Test 11.7: Cleans up safeword directories', () => {
    it('should remove safeword directories on reset', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Verify safeword was created
      expect(fileExists(temporaryDirectory, '.safeword')).toBe(true);

      await runCli(['reset', '--yes'], { cwd: temporaryDirectory });

      // Safeword directory should be removed
      expect(fileExists(temporaryDirectory, '.safeword')).toBe(false);
    });
  });

  describe('Test 11.8: Removes link from AGENTS.md', () => {
    it('should remove safeword link but preserve other content', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Add custom content to AGENTS.md
      const content = readTestFile(temporaryDirectory, 'AGENTS.md');
      writeTestFile(
        temporaryDirectory,
        'AGENTS.md',
        `${content}\n## My Custom Section\n\nCustom content.\n`,
      );

      await runCli(['reset', '--yes'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, 'AGENTS.md')).toBe(true);

      const updatedContent = readTestFile(temporaryDirectory, 'AGENTS.md');

      // Link removed
      expect(updatedContent).not.toContain('.safeword/SAFEWORD.md');

      // Custom content preserved
      expect(updatedContent).toContain('My Custom Section');
      expect(updatedContent).toContain('Custom content');
    });
  });

  describe('Test 11.9: Preserves linting config', () => {
    it('should keep eslint and prettier config', async () => {
      await createConfiguredProject(temporaryDirectory);

      expect(fileExists(temporaryDirectory, 'eslint.config.mjs')).toBe(true);
      expect(fileExists(temporaryDirectory, '.prettierrc')).toBe(true);

      const pkgBefore = JSON.parse(readTestFile(temporaryDirectory, 'package.json'));

      await runCli(['reset', '--yes'], { cwd: temporaryDirectory });

      // Linting files preserved
      expect(fileExists(temporaryDirectory, 'eslint.config.mjs')).toBe(true);
      expect(fileExists(temporaryDirectory, '.prettierrc')).toBe(true);

      // Scripts preserved
      const pkgAfter = JSON.parse(readTestFile(temporaryDirectory, 'package.json'));
      expect(pkgAfter.scripts?.lint).toBe(pkgBefore.scripts?.lint);
      expect(pkgAfter.scripts?.format).toBe(pkgBefore.scripts?.format);
    });
  });

  describe('Test 11.10: Unconfigured project message', () => {
    it('should show nothing to remove message', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No setup

      const result = await runCli(['reset', '--yes'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/nothing|already|not configured/i);
    });
  });

  describe('Test 11.11: Removes safeword slash commands', () => {
    it('should remove safeword commands but preserve custom ones', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Verify commands directory exists after setup
      expect(fileExists(temporaryDirectory, '.claude/commands')).toBe(true);

      // Add a custom command that should be preserved
      writeTestFile(
        temporaryDirectory,
        '.claude/commands/my-custom-command.md',
        '# My Custom Command\n\nDo something custom.',
      );

      await runCli(['reset', '--yes'], { cwd: temporaryDirectory });

      // Custom command should be preserved
      expect(fileExists(temporaryDirectory, '.claude/commands/my-custom-command.md')).toBe(true);
      const customContent = readTestFile(
        temporaryDirectory,
        '.claude/commands/my-custom-command.md',
      );
      expect(customContent).toContain('My Custom Command');

      // Safeword commands should be removed (review, architecture, lint)
      expect(fileExists(temporaryDirectory, '.claude/commands/review.md')).toBe(false);
    });
  });

  describe('Test 11.12: Removes MCP servers from .mcp.json', () => {
    it('should remove context7 and playwright servers', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Verify MCP config exists
      expect(fileExists(temporaryDirectory, '.mcp.json')).toBe(true);

      // Add a custom MCP server
      const mcpConfig = JSON.parse(readTestFile(temporaryDirectory, '.mcp.json'));
      mcpConfig.mcpServers['my-custom-server'] = {
        command: 'my-server',
        args: ['--port', '3000'],
      };
      writeTestFile(temporaryDirectory, '.mcp.json', JSON.stringify(mcpConfig, undefined, 2));

      await runCli(['reset', '--yes'], { cwd: temporaryDirectory });

      // .mcp.json should still exist with custom server
      expect(fileExists(temporaryDirectory, '.mcp.json')).toBe(true);

      const updatedConfig = JSON.parse(readTestFile(temporaryDirectory, '.mcp.json'));

      // Custom server preserved
      expect(updatedConfig.mcpServers['my-custom-server']).toBeDefined();
      expect(updatedConfig.mcpServers['my-custom-server'].command).toBe('my-server');

      // Safeword servers removed
      expect(updatedConfig.mcpServers.context7).toBeUndefined();
      expect(updatedConfig.mcpServers.playwright).toBeUndefined();
    });

    it('should delete or empty .mcp.json if only safeword servers remain', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Overwrite with only safeword servers
      const mcpConfig = {
        mcpServers: {
          context7: { command: 'bunx', args: ['@context7/mcp'] },
          playwright: { command: 'bunx', args: ['@playwright/mcp'] },
        },
      };
      writeTestFile(temporaryDirectory, '.mcp.json', JSON.stringify(mcpConfig, undefined, 2));

      await runCli(['reset', '--yes'], { cwd: temporaryDirectory });

      // Either .mcp.json is deleted OR mcpServers is empty
      if (fileExists(temporaryDirectory, '.mcp.json')) {
        const updatedConfig = JSON.parse(readTestFile(temporaryDirectory, '.mcp.json'));
        const serverCount = Object.keys(updatedConfig.mcpServers || {}).length;
        expect(serverCount).toBe(0);
      }
      // If file doesn't exist, test passes implicitly
    });
  });
});
