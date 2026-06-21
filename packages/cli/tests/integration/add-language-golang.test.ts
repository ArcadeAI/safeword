/**
 * E2E Test: Add Go to Existing Project
 *
 * Verifies incremental language adoption:
 * - Setup with TypeScript only
 * - Add Go files to the project
 * - Run upgrade
 * - Go pack gets installed and .golangci.yml is created
 *
 * Tests the upgrade path for adding Go after initial setup.
 * Note: Tests requiring golangci-lint are skipped if not installed.
 */

import { spawnSync } from 'node:child_process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  isGolangciLintInstalled,
  readSafewordConfig,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  setupOrThrow,
  writeTestFile,
} from '../helpers';

const IS_GOLANGCI_LINT_AVAILABLE = isGolangciLintInstalled();

describe('E2E: Add Go to Existing TypeScript Project', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(projectDirectory);
    initGitRepo(projectDirectory);
    // Initial setup with TypeScript only
    await setupOrThrow(projectDirectory, ['setup']);
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('starts with only TypeScript pack installed', () => {
    const config = readSafewordConfig(projectDirectory);
    expect(config.installedPacks).toContain('typescript');
    expect(config.installedPacks).not.toContain('golang');
  });

  it('does not have go.mod initially', () => {
    expect(fileExists(projectDirectory, 'go.mod')).toBe(false);
  });

  it('does not have .golangci.yml initially', () => {
    expect(fileExists(projectDirectory, '.golangci.yml')).toBe(false);
  });

  describe('after adding Go and running upgrade', () => {
    beforeAll(async () => {
      // Add Go to the project
      writeTestFile(
        projectDirectory,
        'go.mod',
        `module example.com/test-project

go 1.22
`,
      );

      writeTestFile(
        projectDirectory,
        'main.go',
        `// Package main is the entry point.
package main

import "fmt"

func main() {
	fmt.Println("hello")
}
`,
      );

      // Run upgrade to detect and install Go pack
      await runCli(['upgrade'], { cwd: projectDirectory });
    }, 60_000);

    it('installs Go pack', () => {
      const config = readSafewordConfig(projectDirectory);
      expect(config.installedPacks).toContain('typescript');
      expect(config.installedPacks).toContain('golang');
    });

    it('creates .golangci.yml config', () => {
      expect(fileExists(projectDirectory, '.golangci.yml')).toBe(true);

      const goConfig = readTestFile(projectDirectory, '.golangci.yml');
      expect(goConfig).toContain('version: "2"');
      expect(goConfig).toContain('linters:');
    });

    it.skipIf(!IS_GOLANGCI_LINT_AVAILABLE)('golangci-lint works on Go files', () => {
      const result = spawnSync('golangci-lint', ['run', 'main.go'], {
        cwd: projectDirectory,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
    });

    it('ESLint still works on TypeScript files', () => {
      writeTestFile(projectDirectory, 'test.ts', 'export const x = 1;\n');

      const result = spawnSync('bunx', ['eslint', 'test.ts'], {
        cwd: projectDirectory,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
    });
  });
});
