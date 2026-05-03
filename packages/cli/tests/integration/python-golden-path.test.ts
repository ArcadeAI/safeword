/**
 * E2E Test: Python Golden Path
 *
 * Verifies that a Python project with safeword works correctly:
 * - Ruff config is created via extend pattern (ruff.toml → .safeword/ruff.toml)
 * - Ruff runs and catches issues (when installed)
 * - Ruff formats Python files (when installed)
 * - Post-tool lint hook processes Python files (when Ruff installed)
 * - Lint hook handles edge cases gracefully (syntax errors, missing files)
 *
 * Also includes idempotency and fallback tests (separate project setups).
 * Note: Tests requiring Ruff are skipped if Ruff is not installed.
 */

import { execSync, spawnSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPythonProject,
  createTemporaryDirectory,
  fileExists,
  initGitRepo,
  isRuffInstalled,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  runLintHook,
  writeTestFile,
} from '../helpers';

const RUFF_AVAILABLE = isRuffInstalled();

describe('E2E: Python Golden Path', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createPythonProject(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });
  }, 180_000); // 3 min timeout for setup

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('creates Ruff config via extend pattern', () => {
    const ruffToml = readTestFile(projectDirectory, 'ruff.toml');
    const safewordRuff = readTestFile(projectDirectory, '.safeword/ruff.toml');

    // Ticket 138 unified extend direction: .safeword/ruff.toml extends customer's ruff.toml
    // (previously the reverse, which bypassed customer overrides when the hook used --config).
    expect(safewordRuff).toContain('extend = "../ruff.toml"');

    // Customer's ruff.toml is now a bare, customer-owned file (safeword doesn't inject rules into it).
    // Safeword's additive rules live in .safeword/ruff.toml.
    expect(safewordRuff).toContain('line-length');
    expect(safewordRuff).toContain('[lint]');
    expect(safewordRuff).toContain('extend-select');
    // And customer's file is just theirs — the commented hint is evidence of the template
    expect(ruffToml).toContain('customer-owned');
  });

  it.skipIf(!RUFF_AVAILABLE)('ruff config is valid and runs', () => {
    writeTestFile(projectDirectory, 'src/valid.py', 'x = 1\n');

    // Should not throw - ruff check runs successfully
    const result = spawnSync('ruff', ['check', 'src/valid.py'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    // Exit 0 means no errors
    expect(result.status).toBe(0);
  });

  it.skipIf(!RUFF_AVAILABLE)('ruff detects violations', () => {
    // Unused import, which is flagged by Ruff
    writeTestFile(projectDirectory, 'src/bad.py', 'import os\nx = 1\n');

    const result = spawnSync('ruff', ['check', 'src/bad.py'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    // Should fail because of unused import
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('F401'); // unused import
  });

  it.skipIf(!RUFF_AVAILABLE)('ruff formats files', () => {
    // Badly formatted Python - extra spaces, missing newline
    writeTestFile(projectDirectory, 'src/ugly.py', 'x=1;y=2');

    execSync('ruff format src/ugly.py', { cwd: projectDirectory });

    const formatted = readTestFile(projectDirectory, 'src/ugly.py');
    // Ruff format adds spaces around = and newlines
    expect(formatted).toContain('x = 1');
    expect(formatted).toContain('y = 2');
  });

  it.skipIf(!RUFF_AVAILABLE)('post-tool-lint hook processes Python files', () => {
    const filePath = nodePath.join(projectDirectory, 'src/hook-test.py');
    // Intentionally badly formatted
    writeTestFile(projectDirectory, 'src/hook-test.py', 'x=1;y=2');

    // Run the lint hook
    runLintHook(projectDirectory, filePath);

    // File should be formatted by Ruff
    const result = readTestFile(projectDirectory, 'src/hook-test.py');
    expect(result).toContain('x = 1');
    expect(result).toContain('y = 2');
  });

  describe('Lint Hook Graceful Handling', () => {
    it('hook completes without crashing on syntax error file', () => {
      writeTestFile(projectDirectory, 'src/syntax-error.py', 'def broken( invalid syntax');
      const filePath = nodePath.join(projectDirectory, 'src/syntax-error.py');

      // Should not throw - hook uses .nothrow()
      expect(() => runLintHook(projectDirectory, filePath)).not.toThrow();
    });

    it('hook completes without crashing on non-existent file', () => {
      const filePath = nodePath.join(projectDirectory, 'src/does-not-exist.py');

      // Should not throw - hook uses .nothrow()
      expect(() => runLintHook(projectDirectory, filePath)).not.toThrow();
    });
  });
});

// =============================================================================
// Idempotency Test - Setup twice should be safe
// =============================================================================

describe('E2E: Python Setup Idempotency', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createPythonProject(projectDirectory);
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

  it('ruff.toml is valid after running setup twice', () => {
    const ruffToml = readTestFile(projectDirectory, 'ruff.toml');
    // Ticket 138: customer's ruff.toml is bare/customer-owned; extend now lives in .safeword/ruff.toml.
    expect(ruffToml).toContain('customer-owned');
  });

  it.skipIf(!RUFF_AVAILABLE)('Ruff still works after running setup twice', () => {
    writeTestFile(projectDirectory, 'src/idempotent.py', 'x = 1\n');

    const result = spawnSync('ruff', ['check', 'src/idempotent.py'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
  });

  it('config files remain valid', () => {
    expect(fileExists(projectDirectory, 'ruff.toml')).toBe(true);
    expect(fileExists(projectDirectory, '.safeword/ruff.toml')).toBe(true);
  });
});

// =============================================================================
// Fallback Test - Hook works without .safeword/ config
// =============================================================================

describe('E2E: Python Lint Hook Fallback', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createPythonProject(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup', '--yes'], { cwd: projectDirectory });

    // Delete BOTH configs to test fallback path
    // Python uses extend pattern (ruff.toml → .safeword/ruff.toml), so we must delete both
    // Otherwise ruff fails trying to load the missing extended config
    if (fileExists(projectDirectory, '.safeword/ruff.toml')) {
      unlinkSync(nodePath.join(projectDirectory, '.safeword/ruff.toml'));
    }
    if (fileExists(projectDirectory, 'ruff.toml')) {
      unlinkSync(nodePath.join(projectDirectory, 'ruff.toml'));
    }
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it.skipIf(!RUFF_AVAILABLE)('lint hook formats files without safeword Ruff config', () => {
    writeTestFile(projectDirectory, 'src/fallback.py', 'x=1;y=2');
    const filePath = nodePath.join(projectDirectory, 'src/fallback.py');

    // Hook should use fallback path (Ruff without --config)
    runLintHook(projectDirectory, filePath);

    // File should still be formatted by Ruff
    const result = readTestFile(projectDirectory, 'src/fallback.py');
    expect(result).toContain('x = 1');
  });
});
