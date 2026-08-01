/**
 * Test Suite 1: Version and Help
 *
 * Tests for CLI entry point, version display, and help output.
 */

import { describe, expect, it } from 'vitest';

import { runCli, runCliSync } from '../helpers';

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

      // Canonical commands are listed; retained aliases stay hidden.
      expect(output).toContain('setup');
      expect(output).toContain('status');
      expect(output).toContain('plan');
      expect(output).not.toContain('  check');
      expect(output).not.toContain('  upgrade');
      expect(output).not.toContain('  diff');
      expect(output).not.toContain('  reset');
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
      const bareResult = await runCli([]);

      expect(bareResult.exitCode).toBe(2);
      expect(bareResult.stdout).toContain('Needs attention');
      expect(bareResult.stdout).toContain('safeword setup');
    });
  });
});
