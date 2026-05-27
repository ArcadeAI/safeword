/**
 * Test Suite 8: Health Check
 *
 * Tests for `safeword check` command.
 */

import { unlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  TIMEOUT_QUICK,
  writeSafewordConfig,
  writeTestFile,
} from '../helpers';

describe('Test Suite 8: Health Check', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 8.1: Shows CLI version', () => {
    it('should display CLI version', async () => {
      await createConfiguredProject(temporaryDirectory);

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/cli|safeword/i);
      expect(result.stdout).toMatch(/\d{1,4}\.\d{1,4}\.\d{1,4}/);
    });
  });

  describe('Test 8.2: Shows project config version', () => {
    it('should display version from .safeword/version', async () => {
      await createConfiguredProject(temporaryDirectory);

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/project|config/i);

      // Should show the version from .safeword/version
      const projectVersion = readTestFile(temporaryDirectory, '.safeword/version').trim();
      expect(result.stdout).toContain(projectVersion);
    });
  });

  describe('Test 8.3: Shows update available', () => {
    it('should indicate when update is available', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Write an older version
      writeTestFile(temporaryDirectory, '.safeword/version', '0.0.1');

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      // Should mention available update or version difference
      expect(result.stdout.toLowerCase()).toMatch(/update|available|upgrade|newer/i);
    });
  });

  describe('Test 8.4: Unconfigured project message', () => {
    it('should show not configured message', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      // No setup run

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toContain('not configured');
      expect(result.stdout.toLowerCase()).toContain('setup');
    });
  });

  describe('Test 8.5: Graceful timeout on version check', () => {
    it('should handle network timeout gracefully', async () => {
      await createConfiguredProject(temporaryDirectory);

      // This test verifies the check completes without hanging
      // Network mocking would be needed for full timeout simulation
      const result = await runCli(['check'], {
        cwd: temporaryDirectory,
        timeout: TIMEOUT_QUICK,
      });

      expect(result.exitCode).toBe(0);
      // Should either show version info or timeout message
    });
  });

  describe('Test 8.6: --offline skips version check', () => {
    it('should skip remote version check', async () => {
      await createConfiguredProject(temporaryDirectory);

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      // Should show local versions only
      expect(result.stdout).toMatch(/\d{1,4}\.\d{1,4}\.\d{1,4}/);
    });
  });

  describe('Test 8.7: Detects corrupted .safeword structure', () => {
    it('should detect missing critical files', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Delete a critical file
      unlinkSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'));

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(1); // Issues should cause non-zero exit
      expect(result.stdout.toLowerCase()).toMatch(/missing|issue|repair|upgrade/i);
    });
  });

  // ==========================================================================
  // Language Packs Detection (Feature: Language Packs)
  // Test Definitions: .safeword/planning/test-definitions/feature-language-packs.md
  // ==========================================================================

  describe('Warns when detected language has no installed pack', () => {
    it('should warn about missing Python pack', async () => {
      await createConfiguredProject(temporaryDirectory);
      // Add Python detection file
      writeTestFile(temporaryDirectory, 'pyproject.toml', `[project]\nname = "test"\n`);
      // TypeScript is installed (from setup), but Python is missing
      writeSafewordConfig(temporaryDirectory, {
        installedPacks: ['typescript'],
      });

      const result = await runCli(['check'], { cwd: temporaryDirectory });

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toMatch(/python.*pack.*not installed/i);
      expect(result.stdout).toMatch(/safeword upgrade/i);
    });
  });

  describe('Passes when all detected languages have packs', () => {
    it('should pass when Python pack is installed', async () => {
      await createConfiguredProject(temporaryDirectory);
      // Add Python detection file with existing tool configs to skip managed file generation
      writeTestFile(
        temporaryDirectory,
        'pyproject.toml',
        `[project]\nname = "test"\n\n[tool.ruff]\nline-length = 100\n\n[tool.mypy]\nstrict = true\n`,
      );
      // Add Python-specific owned file
      writeTestFile(temporaryDirectory, '.safeword/ruff.toml', '# Generated by safeword\n');
      // Both TypeScript and Python are installed
      writeSafewordConfig(temporaryDirectory, {
        installedPacks: ['typescript', 'python'],
      });

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toMatch(/pack.*not installed/i);
    });
  });

  describe('personas.md validation (ticket 7YN5QB)', () => {
    /**
     * Set up a configured project, write the given content to
     * `.safeword-project/personas.md`, run `safeword check --offline`, and
     * return the CLI result. Used by tests that exercise the validation
     * path against varying file contents.
     */
    async function runCheckWithPersonas(content: string) {
      await createConfiguredProject(temporaryDirectory);
      writeTestFile(temporaryDirectory, '.safeword-project/personas.md', content);
      return runCli(['check', '--offline'], { cwd: temporaryDirectory });
    }

    it('reports validation errors with line refs and exits non-zero', async () => {
      const result = await runCheckWithPersonas(
        ['## End User (EU)', '**Role:** A', '', '## Engineering Unit (EU)', '**Role:** B', ''].join(
          '\n',
        ),
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/personas\.md:\d+:.*duplicate persona code/);
    });

    it('reports single-character-name error with line ref', async () => {
      const result = await runCheckWithPersonas(['## A', '**Role:** Too short.', ''].join('\n'));

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/personas\.md:\d+:.*at least 2 characters/);
    });

    it('reports digit-first-name with explicit-override prompt', async () => {
      const result = await runCheckWithPersonas(
        ['## 3 Amigos', '**Role:** Pathological name.', ''].join('\n'),
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/non-conformant code/);
      expect(result.stderr).toMatch(/author explicit code/);
    });

    it('passes when personas.md is well-formed', async () => {
      const result = await runCheckWithPersonas(
        [
          '## Platform Operator (PO)',
          '**Role:** Owns infra.',
          '',
          '## End User (EU)',
          '**Role:** Signs in.',
          '',
        ].join('\n'),
      );

      expect(result.stderr).not.toMatch(/personas\.md:/);
    });

    it('scaffolded-but-empty personas.md (template comment only) produces no errors', async () => {
      await createConfiguredProject(temporaryDirectory);
      // createConfiguredProject scaffolds personas.md from the template;
      // it contains an HTML-commented example block but no real persona
      // entries. Should produce no validation errors.

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.stderr).not.toMatch(/personas\.md:/);
    });

    it('treats missing personas.md as absent (no error)', async () => {
      await createConfiguredProject(temporaryDirectory);
      // Delete the scaffolded personas.md to exercise the absent path.
      unlinkSync(nodePath.join(temporaryDirectory, '.safeword-project', 'personas.md'));

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.stderr).not.toMatch(/personas\.md:/);
    });
  });

  describe('configurable persona path (ticket K7N2QM)', () => {
    /**
     * Add a `paths.personas` override to the project's existing
     * `.safeword/config.json`. Preserves any other config keys (notably
     * `installedPacks`) that `createConfiguredProject` wrote during
     * setup — overwriting them would trigger spurious "missing pack"
     * reports that short-circuit the issues section.
     */
    function setPersonasOverride(personasPath: string): void {
      const existing = JSON.parse(readTestFile(temporaryDirectory, '.safeword/config.json')) as {
        installedPacks?: string[];
        [key: string]: unknown;
      };
      writeTestFile(
        temporaryDirectory,
        '.safeword/config.json',
        JSON.stringify({ ...existing, paths: { personas: personasPath } }),
      );
    }

    it('R2.3: reports loud failure when configured path is missing', async () => {
      await createConfiguredProject(temporaryDirectory);
      setPersonasOverride('docs/personas.md'); // file intentionally not created
      // Remove the scaffolded default so this test isolates the override branch.
      unlinkSync(nodePath.join(temporaryDirectory, '.safeword-project', 'personas.md'));

      const result = await runCli(['check', '--offline'], {
        cwd: temporaryDirectory,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/personas-path:.*docs\/personas\.md.*file not found/);
    });
  });
});
