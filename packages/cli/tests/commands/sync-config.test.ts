/**
 * Test Suite: Sync Config Command
 *
 * Tests for `safeword sync-config` command.
 * See: .safeword/planning/test-definitions/feature-architecture-audit.md
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createConfiguredProject,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

describe('Sync Config Command', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(temporaryDirectory);
  });

  describe('Test 2.1: Fails if .safeword directory missing', () => {
    it('should fail with error message when not configured', async () => {
      createTypeScriptPackageJson(temporaryDirectory);
      initGitRepo(temporaryDirectory);

      const result = await runCli(['sync-config'], { cwd: temporaryDirectory });

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(/setup/i);
    });
  });

  describe('Test 2.2: Writes generated config to .safeword/', () => {
    it('should create depcruise-config.cjs in .safeword directory', async () => {
      await createConfiguredProject(temporaryDirectory);

      const result = await runCli(['sync-config'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(fileExists(temporaryDirectory, '.safeword/depcruise-config.cjs')).toBe(true);

      const config = readTestFile(temporaryDirectory, '.safeword/depcruise-config.cjs');
      expect(config).toContain('module.exports');
      expect(config).toContain('forbidden');
    });
  });

  describe('Test 2.3: Creates main config if not exists', () => {
    it('should create .dependency-cruiser.cjs at project root if missing', async () => {
      await createConfiguredProject(temporaryDirectory);

      const result = await runCli(['sync-config'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      expect(fileExists(temporaryDirectory, '.dependency-cruiser.cjs')).toBe(true);

      const config = readTestFile(temporaryDirectory, '.dependency-cruiser.cjs');
      expect(config).toContain('.safeword/depcruise-config.cjs');
    });
  });

  describe('Test 2.4: Does not overwrite existing main config', () => {
    it('should preserve user customizations in .dependency-cruiser.cjs', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Create custom main config
      const customContent = `// Custom config\nmodule.exports = { custom: true };`;
      writeTestFile(temporaryDirectory, '.dependency-cruiser.cjs', customContent);

      const result = await runCli(['sync-config'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);

      // Main config should be unchanged
      const config = readTestFile(temporaryDirectory, '.dependency-cruiser.cjs');
      expect(config).toBe(customContent);

      // But generated config should exist
      expect(fileExists(temporaryDirectory, '.safeword/depcruise-config.cjs')).toBe(true);
    });
  });

  describe('Test 2.5: Uses detectArchitecture from boundaries.ts', () => {
    it('should generate rules based on detected project structure', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Create architecture directories
      writeTestFile(temporaryDirectory, 'src/utils/helper.ts', 'export const x = 1;');
      writeTestFile(
        temporaryDirectory,
        'src/components/Button.tsx',
        'export const Button = () => null;',
      );

      const result = await runCli(['sync-config'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);

      // Generated config should reflect detected architecture
      const config = readTestFile(temporaryDirectory, '.safeword/depcruise-config.cjs');
      expect(config).toContain('forbidden');
      // Should always have no-circular rule
      expect(config).toContain('no-circular');
    });
  });

  describe('Test 2.6: Reads workspaces from package.json for monorepo rules', () => {
    it('should generate monorepo layer rules from package.json workspaces', async () => {
      await createConfiguredProject(temporaryDirectory);

      // Update package.json with workspaces
      const packageJson = JSON.parse(readTestFile(temporaryDirectory, 'package.json'));
      packageJson.workspaces = ['packages/*', 'apps/*', 'libs/*'];
      writeTestFile(temporaryDirectory, 'package.json', JSON.stringify(packageJson, undefined, 2));

      const result = await runCli(['sync-config'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);

      // Generated config should have monorepo hierarchy rules
      const config = readTestFile(temporaryDirectory, '.safeword/depcruise-config.cjs');
      expect(config).toContain('libs-cannot-import-packages-or-apps');
      expect(config).toContain('packages-cannot-import-apps');
    });
  });

  describe('Test 2.7: --check exits 0 and writes nothing when in sync', () => {
    it('should not modify .safeword/depcruise-config.cjs when on-disk matches generated', async () => {
      await createConfiguredProject(temporaryDirectory);
      await runCli(['sync-config'], { cwd: temporaryDirectory });

      const before = readTestFile(temporaryDirectory, '.safeword/depcruise-config.cjs');

      const result = await runCli(['sync-config', '--check'], { cwd: temporaryDirectory });

      expect(result.exitCode).toBe(0);
      const after = readTestFile(temporaryDirectory, '.safeword/depcruise-config.cjs');
      expect(after).toBe(before);
    });
  });

  describe('Test 2.8: --check exits non-zero and writes nothing when drifted', () => {
    it('should report drift and leave the existing file untouched', async () => {
      await createConfiguredProject(temporaryDirectory);
      await runCli(['sync-config'], { cwd: temporaryDirectory });

      // Simulate drift: customer's committed config diverged from what would be generated
      const driftedContent = '// drifted - not what generator would produce\nmodule.exports = {};';
      writeTestFile(temporaryDirectory, '.safeword/depcruise-config.cjs', driftedContent);

      const result = await runCli(['sync-config', '--check'], { cwd: temporaryDirectory });

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(/sync-config/);
      const after = readTestFile(temporaryDirectory, '.safeword/depcruise-config.cjs');
      expect(after).toBe(driftedContent);
    });
  });

  describe('Test 2.9: --check exits non-zero and writes nothing when on-disk missing', () => {
    it('should report drift without creating the file', async () => {
      await createConfiguredProject(temporaryDirectory);
      // createConfiguredProject doesn't trigger setup's arch-gated write,
      // so the generated config doesn't exist yet
      expect(fileExists(temporaryDirectory, '.safeword/depcruise-config.cjs')).toBe(false);

      const result = await runCli(['sync-config', '--check'], { cwd: temporaryDirectory });

      expect(result.exitCode).not.toBe(0);
      expect(fileExists(temporaryDirectory, '.safeword/depcruise-config.cjs')).toBe(false);
    });
  });

  describe('Test 2.10: --check does not create .dependency-cruiser.cjs even when missing', () => {
    it('should leave the wrapper file alone in check mode', async () => {
      await createConfiguredProject(temporaryDirectory);
      expect(fileExists(temporaryDirectory, '.dependency-cruiser.cjs')).toBe(false);

      await runCli(['sync-config', '--check'], { cwd: temporaryDirectory });

      expect(fileExists(temporaryDirectory, '.dependency-cruiser.cjs')).toBe(false);
    });
  });
});
