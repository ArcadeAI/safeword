/**
 * E2E Tests: Tooling Validation
 *
 * Verifies that configured tools actually catch violations:
 * - Pure Python projects (no package.json) work end-to-end
 * - mypy catches type errors
 * - React ESLint rules catch hook violations
 *
 * These tests validate that configuration leads to working enforcement.
 */

import { execSync, spawnSync } from 'node:child_process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPythonProject,
  createTemporaryDirectory,
  fileExists,
  initGitRepo,
  isMypyInstalled,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  runEslint,
  SAFEWORD_VERSION,
  TIMEOUT_SETUP,
  writeTestFile,
} from '../helpers';

// =============================================================================
// Suite 1: Pure Python Project (No package.json)
// =============================================================================

describe('E2E: Pure Python Project', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    // Create Python project WITHOUT calling any JS helpers that create package.json
    writeTestFile(
      projectDirectory,
      'pyproject.toml',
      `[project]
name = "pure-python-app"
version = "0.1.0"
requires-python = ">=3.10"
`,
    );
    writeTestFile(projectDirectory, 'src/__init__.py', '');
    writeTestFile(projectDirectory, 'src/main.py', 'print("hello")\n');
    initGitRepo(projectDirectory);
    await runCli(['setup'], {
      cwd: projectDirectory,
      timeout: TIMEOUT_SETUP,
    });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('does NOT create package.json', () => {
    expect(fileExists(projectDirectory, 'package.json')).toBe(false);
  });

  it('creates .safeword directory', () => {
    expect(fileExists(projectDirectory, '.safeword')).toBe(true);
  });

  it('adds Ruff config via extend pattern', () => {
    const ruffToml = readTestFile(projectDirectory, 'ruff.toml');
    // Ticket 138: customer's ruff.toml is bare/customer-owned.
    expect(ruffToml).toContain('customer-owned');

    // Safeword's rules + extend live in .safeword/ruff.toml
    const safewordRuff = readTestFile(projectDirectory, '.safeword/ruff.toml');
    expect(safewordRuff).toContain('[lint]');
    expect(safewordRuff).toContain('extend = "../ruff.toml"');
  });

  it('adds mypy config file', () => {
    const mypyConfig = readTestFile(projectDirectory, 'mypy.ini');
    expect(mypyConfig).toContain('[mypy]');
  });

  it('does NOT create eslint.config.mjs (no JS tooling)', () => {
    // Pure Python projects should not have JS linting configured
    expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(false);
  });
});

// =============================================================================
// Suite 2: mypy Type Error Detection
// =============================================================================

const MYPY_AVAILABLE = isMypyInstalled();

describe('E2E: mypy Type Error Detection', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createPythonProject(projectDirectory);
    initGitRepo(projectDirectory);
    await runCli(['setup'], {
      cwd: projectDirectory,
      timeout: TIMEOUT_SETUP,
    });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('generates mypy config with correct settings', () => {
    const config = readTestFile(projectDirectory, 'mypy.ini');
    expect(config).toContain('[mypy]');
    expect(config).toContain('ignore_missing_imports = True');
    expect(config).toContain('show_error_codes = True');
  });

  it.skipIf(!MYPY_AVAILABLE)('mypy runs without error on valid code', () => {
    writeTestFile(
      projectDirectory,
      'src/valid_types.py',
      `def greet(name: str) -> str:
    return f"Hello, {name}"

result: str = greet("world")
`,
    );

    const result = spawnSync('mypy', ['src/valid_types.py'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
  });

  it.skipIf(!MYPY_AVAILABLE)('mypy catches type errors', () => {
    writeTestFile(
      projectDirectory,
      'src/bad_types.py',
      `def add_numbers(a: int, b: int) -> int:
    return a + b

# Type error: passing string to int parameter
result: int = add_numbers("hello", 42)
`,
    );

    const result = spawnSync('mypy', ['src/bad_types.py'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    // Should fail with type error
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('error');
    // Should mention the incompatible type
    expect(result.stdout).toMatch(/str|incompatible/i);
  });

  it.skipIf(!MYPY_AVAILABLE)('mypy catches return type errors', () => {
    writeTestFile(
      projectDirectory,
      'src/bad_return.py',
      `def get_count() -> int:
    return "not a number"  # Wrong return type
`,
    );

    const result = spawnSync('mypy', ['src/bad_return.py'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain('error');
  });
});

// =============================================================================
// Suite 3: React ESLint Violation Detection
// =============================================================================

describe('E2E: React ESLint Violation Detection', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    // Create React package.json with @types/react for proper TypeScript checking
    // Include local safeword to ensure tests use the current build
    writeTestFile(
      projectDirectory,
      'package.json',
      JSON.stringify(
        {
          name: 'test-react-project',
          version: '1.0.0',
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
          },
          devDependencies: {
            '@types/react': '^18.0.0',
            '@types/react-dom': '^18.0.0',
            typescript: '^5.0.0',
            safeword: SAFEWORD_VERSION,
          },
        },
        undefined,
        2,
      ),
    );
    // Create tsconfig.json for TypeScript ESLint parsing
    writeTestFile(
      projectDirectory,
      'tsconfig.json',
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
          include: ['src'],
        },
        undefined,
        2,
      ),
    );
    // Create src directory
    writeTestFile(projectDirectory, 'src/.gitkeep', '');
    initGitRepo(projectDirectory);
    await runCli(['setup'], {
      cwd: projectDirectory,
      timeout: TIMEOUT_SETUP,
    });

    // Install dependencies so ESLint can run
    execSync('bun install', { cwd: projectDirectory, stdio: 'pipe' });
  }, 180_000);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('creates eslint.config.mjs with React plugins', () => {
    const config = readTestFile(projectDirectory, 'eslint.config.mjs');
    expect(config).toContain('react');
  });

  it('ESLint catches rules of hooks violation (conditional hook call)', () => {
    // This is the key React-specific rule we want to verify works
    writeTestFile(
      projectDirectory,
      'src/conditional-hook.tsx',
      `import { useState } from 'react';

export function ConditionalHook({ enabled }: { enabled: boolean }) {
  if (enabled) {
    useState(0); // Hook inside conditional - violates rules-of-hooks
  }
  return null;
}
`,
    );

    const result = runEslint(projectDirectory, 'src/conditional-hook.tsx', [
      '--rule',
      '{"react-hooks/rules-of-hooks": "error"}',
    ]);

    // Should fail due to rules-of-hooks violation
    expect(result.status).not.toBe(0);
    // Check for any indication of the hooks rule firing
    expect(result.stdout).toMatch(/rules-of-hooks|conditionally|rendered/i);
  });
});
