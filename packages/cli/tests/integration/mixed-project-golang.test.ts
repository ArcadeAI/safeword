/**
 * E2E Test: Mixed Project (TypeScript + Go)
 *
 * Verifies that a project with both TypeScript and Go works correctly:
 * - Both language packs are detected and installed
 * - ESLint runs on TypeScript files
 * - golangci-lint config (.golangci.yml) is created
 * - Lint hook routes files to correct linter
 *
 * Note: Tests requiring golangci-lint are skipped if not installed.
 * Uses a single project setup (expensive) shared across all tests.
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  fileExists,
  initGitRepo,
  isGolangciLintInstalled,
  readSafewordConfig,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  runLintHook,
  SAFEWORD_VERSION,
  writeTestFile,
} from '../helpers';

const GOLANGCI_LINT_AVAILABLE = isGolangciLintInstalled();

describe('E2E: Mixed Project (TypeScript + Go)', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();

    // Create a mixed package.json with TypeScript
    // Pre-install local safeword to ensure tests use the current build
    const packageJson = {
      name: 'mixed-ts-go-project',
      version: '1.0.0',
      devDependencies: {
        typescript: '^5.0.0',
        safeword: SAFEWORD_VERSION,
      },
    };
    writeTestFile(projectDirectory, 'package.json', JSON.stringify(packageJson, undefined, 2));

    // Also create go.mod to indicate Go
    writeTestFile(
      projectDirectory,
      'go.mod',
      `module example.com/mixed-project

go 1.22
`,
    );

    // Create a minimal main.go (lint-compliant)
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

    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('detects and installs both language packs', () => {
    const config = readSafewordConfig(projectDirectory);
    expect(config.installedPacks).toContain('typescript');
    expect(config.installedPacks).toContain('golang');
  });

  it('creates ESLint config', () => {
    expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);
    const eslintConfig = readTestFile(projectDirectory, 'eslint.config.mjs');
    expect(eslintConfig).toContain('eslint');
  });

  it('creates .golangci.yml config', () => {
    expect(fileExists(projectDirectory, '.golangci.yml')).toBe(true);
    const goConfig = readTestFile(projectDirectory, '.golangci.yml');
    expect(goConfig).toContain('version: "2"');
    expect(goConfig).toContain('linters:');
  });

  it('ESLint runs on TypeScript files', () => {
    writeTestFile(projectDirectory, 'src/valid.ts', 'export const x = 1;\n');

    // Should not throw
    const result = execSync('bunx eslint src/valid.ts', {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result).toBe('');
  });

  it('ESLint detects TypeScript violations', () => {
    writeTestFile(projectDirectory, 'src/bad.ts', 'var unused = 1;\n');

    expect(() => {
      execSync('bunx eslint src/bad.ts', {
        cwd: projectDirectory,
        encoding: 'utf8',
      });
    }).toThrow();
  });

  it.skipIf(!GOLANGCI_LINT_AVAILABLE)('golangci-lint runs on Go files', () => {
    // main.go should be valid
    const result = spawnSync('golangci-lint', ['run', 'main.go'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
  });

  it.skipIf(!GOLANGCI_LINT_AVAILABLE)('golangci-lint detects Go violations', () => {
    // Unused import will be caught by 'unused' linter in standard set
    writeTestFile(
      projectDirectory,
      'bad.go',
      `package main

import "os" // unused import

func bad() {
	println("not using os")
}
`,
    );

    const result = spawnSync('golangci-lint', ['run', 'bad.go'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
  });

  describe('Lint hook routes to correct linter', () => {
    it('routes .ts files to ESLint', () => {
      const filePath = nodePath.join(projectDirectory, 'src/lint-ts.ts');
      writeTestFile(projectDirectory, 'src/lint-ts.ts', 'const x=1\n');

      const result = runLintHook(projectDirectory, filePath);
      expect(result.status).toBe(0);

      // ESLint/Prettier should format
      const formatted = readTestFile(projectDirectory, 'src/lint-ts.ts');
      expect(formatted.trim()).toBe('const x = 1;');
    });

    it.skipIf(!GOLANGCI_LINT_AVAILABLE)('routes .go files to golangci-lint', () => {
      const filePath = nodePath.join(projectDirectory, 'lint-go.go');
      writeTestFile(
        projectDirectory,
        'lint-go.go',
        `package main
func lintGo(){println("test")}`,
      );

      const result = runLintHook(projectDirectory, filePath);
      expect(result.status).toBe(0);

      // golangci-lint fmt should format
      const formatted = readTestFile(projectDirectory, 'lint-go.go');
      expect(formatted).toContain('func lintGo() {');
    });
  });
});
