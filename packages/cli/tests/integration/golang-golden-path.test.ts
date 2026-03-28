/**
 * E2E Test: Go Golden Path
 *
 * Verifies that a Go project with safeword works correctly:
 * - golangci-lint config (.golangci.yml) is created
 * - golangci-lint runs and catches issues (when installed)
 * - golangci-lint fmt formats Go files (when installed)
 * - Post-tool lint hook processes Go files (when golangci-lint installed)
 * - Lint hook handles edge cases gracefully (syntax errors, missing files)
 *
 * Also includes idempotency and fallback tests (separate project setups).
 * Note: Tests requiring golangci-lint are skipped if not installed.
 */

import { execSync, spawnSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createGoProject,
  createTemporaryDirectory,
  fileExists,
  initGitRepo,
  isGolangciLintInstalled,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  runLintHook,
  writeTestFile,
} from '../helpers';

const GOLANGCI_LINT_AVAILABLE = isGolangciLintInstalled();

describe('E2E: Go Golden Path', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createGoProject(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000); // 3 min timeout for setup

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('creates .golangci.yml config', () => {
    expect(fileExists(projectDirectory, '.golangci.yml')).toBe(true);

    const config = readTestFile(projectDirectory, '.golangci.yml');

    // Check essential golangci-lint v2 settings
    expect(config).toContain('version: "2"');
    expect(config).toContain('linters:');
    expect(config).toContain('default: standard'); // Curated enable list, not default:all
    expect(config).toContain('gosec'); // Safeword's curated linters present
    expect(config).toContain('formatters:');
    expect(config).toContain('gofumpt');
  });

  it.skipIf(!GOLANGCI_LINT_AVAILABLE)('golangci-lint runs on valid code', () => {
    // main.go from createGoProject should be valid
    const result = spawnSync('golangci-lint', ['run', 'main.go'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
  });

  it.skipIf(!GOLANGCI_LINT_AVAILABLE)('golangci-lint detects violations', () => {
    // Create a file with an unused import (caught by 'unused' linter in standard set)
    writeTestFile(
      projectDirectory,
      'bad.go',
      `package main

import "fmt" // unused import - will trigger unused linter

func bad() {
	println("not using fmt")
}
`,
    );

    const result = spawnSync('golangci-lint', ['run', 'bad.go'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    // Should fail due to unused import
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/unused|import/i);
  });

  it.skipIf(!GOLANGCI_LINT_AVAILABLE)('golangci-lint fmt formats files', () => {
    // Create a badly formatted Go file
    writeTestFile(
      projectDirectory,
      'ugly.go',
      `package main
func main(){println("no spaces")}`,
    );

    // Run golangci-lint fmt
    execSync('golangci-lint fmt ugly.go', { cwd: projectDirectory });

    const formatted = readTestFile(projectDirectory, 'ugly.go');
    // gofumpt adds proper spacing
    expect(formatted).toContain('func main() {');
  });

  it.skipIf(!GOLANGCI_LINT_AVAILABLE)('post-tool-lint hook processes Go files', () => {
    const filePath = nodePath.join(projectDirectory, 'hook-test.go');
    // Intentionally badly formatted
    writeTestFile(
      projectDirectory,
      'hook-test.go',
      `package main
func hookTest(){println("test")}`,
    );

    // Run the lint hook
    runLintHook(projectDirectory, filePath);

    // File should be formatted by golangci-lint fmt
    const result = readTestFile(projectDirectory, 'hook-test.go');
    expect(result).toContain('func hookTest() {');
  });

  describe('Lint Hook Graceful Handling', () => {
    it('hook completes without crashing on syntax error file', () => {
      writeTestFile(projectDirectory, 'syntax-error.go', 'package main\nfunc broken({{{{ invalid');
      const filePath = nodePath.join(projectDirectory, 'syntax-error.go');

      // Should not throw - hook uses .nothrow()
      expect(() => runLintHook(projectDirectory, filePath)).not.toThrow();
    });

    it('hook completes without crashing on non-existent file', () => {
      const filePath = nodePath.join(projectDirectory, 'does-not-exist.go');

      // Should not throw - hook uses .nothrow()
      expect(() => runLintHook(projectDirectory, filePath)).not.toThrow();
    });
  });
});

// =============================================================================
// Idempotency Test - Setup twice should be safe
// =============================================================================

describe('E2E: Go Setup Idempotency', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createGoProject(projectDirectory);
    initGitRepo(projectDirectory);
    // Run setup TWICE
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('.golangci.yml is valid after running setup twice', () => {
    const config = readTestFile(projectDirectory, '.golangci.yml');
    expect(config).toContain('version: "2"');
    expect(config).toContain('linters:');
  });

  it.skipIf(!GOLANGCI_LINT_AVAILABLE)('golangci-lint still works after running setup twice', () => {
    // main.go from createGoProject should still be valid
    const result = spawnSync('golangci-lint', ['run', 'main.go'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
  });

  it('config files remain valid', () => {
    expect(fileExists(projectDirectory, '.golangci.yml')).toBe(true);
    expect(fileExists(projectDirectory, '.safeword/.golangci.yml')).toBe(true);
  });
});

// =============================================================================
// Fallback Test - Hook works without .safeword/ config
// =============================================================================

describe('E2E: Go Lint Hook Fallback', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createGoProject(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });

    // Delete .safeword/.golangci.yml AFTER setup to test fallback path
    const golangciConfig = nodePath.join(projectDirectory, '.safeword/.golangci.yml');
    if (fileExists(projectDirectory, '.safeword/.golangci.yml')) {
      unlinkSync(golangciConfig);
    }
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it.skipIf(!GOLANGCI_LINT_AVAILABLE)('lint hook formats files without safeword config', () => {
    writeTestFile(
      projectDirectory,
      'fallback.go',
      `package main
func fallback(){println("test")}`,
    );
    const filePath = nodePath.join(projectDirectory, 'fallback.go');

    // Hook should use fallback path (golangci-lint without --config)
    runLintHook(projectDirectory, filePath);

    // File should still be formatted by golangci-lint fmt
    const result = readTestFile(projectDirectory, 'fallback.go');
    expect(result).toContain('func fallback() {');
  });
});
