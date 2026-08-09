/**
 * Test Suite 1: Version and Help
 *
 * Tests for CLI entry point, version display, and help output.
 */

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli, runCliSync } from '../helpers';
import {
  installEmptyClaudeRuntime,
  installFakeCodexRuntime,
} from '../helpers/fake-codex-runtime.js';

describe('Test Suite 1: Version and Help', () => {
  describe('Test 1.1: --version flag shows CLI version', () => {
    it('should output version matching semver pattern', async () => {
      const result = await runCli(['--version']);

      expect(result.exitCode).toBe(0);
      // Matches semver: X.Y.Z with optional prerelease/build metadata.

      expect(result.stdout.trim()).toMatch(/^\d{1,4}\.\d{1,4}\.\d{1,4}[-+\w.]{0,80}$/);
    });

    it('should return exit code 0', () => {
      const result = runCliSync(['--version']);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Test 1.2: --help flag shows help text', () => {
    it('should display comprehensive help with all commands', async () => {
      const result = await runCli(['--help']);

      expect(result.exitCode).toBe(0);

      const output = result.stdout;
      const quickPath = output.split('Compatibility routes (retained indefinitely):', 1)[0] ?? '';

      // Canonical commands are listed; retained aliases stay hidden.
      expect(quickPath).toContain('install');
      expect(quickPath).toContain('status');
      expect(quickPath).toContain('plan');
      expect(quickPath).not.toContain('  setup');
      expect(quickPath).not.toContain('  check');
      expect(quickPath).not.toContain('  upgrade');
      expect(quickPath).not.toContain('  diff');
      expect(quickPath).not.toContain('  reset');
      expect(output).toContain('setup -> install');
    });

    it('should display all global flags', async () => {
      const result = await runCli(['--help']);

      expect(result.exitCode).toBe(0);

      const output = result.stdout;

      // Global flags
      expect(output).toMatch(/--version|-V/);
      expect(output).toMatch(/--help|-h/);
    });

    it('should display command-specific flags in command help', async () => {
      // Check diff --help for --verbose flag
      const diffHelp = await runCli(['diff', '--help']);
      expect(diffHelp.stdout).toMatch(/--verbose|-v/);

      // Check check --help for --offline flag
      const checkHelp = await runCli(['check', '--help']);
      expect(checkHelp.stdout).toContain('--offline');

      // Check reset --help for --yes flag
      const resetHelp = await runCli(['reset', '--help']);
      expect(resetHelp.stdout).toMatch(/--yes|-y/);
    });
  });

  describe('Test 1.3: Bare command reports status', () => {
    it('should report an actionable status when run with no arguments', async () => {
      const directory = createTemporaryDirectory();
      const runtime = installFakeCodexRuntime(createTemporaryDirectory(), {
        pluginEnabled: false,
        pluginInitiallyInstalled: false,
      });
      installEmptyClaudeRuntime(runtime.bin);
      const bareResult = await runCli([], {
        cwd: directory,
        env: {
          CODEX_HOME: runtime.codexHome,
          SAFEWORD_CODEX_LOG: runtime.logPath,
          PATH: `${runtime.bin}:${process.env.PATH ?? ''}`,
        },
      });

      expect(bareResult.exitCode).toBe(2);
      expect(bareResult.stdout).toContain('Needs attention');
      expect(bareResult.stdout).toContain('safeword install');
    });
  });
});
