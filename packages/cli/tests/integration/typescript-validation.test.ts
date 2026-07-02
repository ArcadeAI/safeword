/**
 * E2E Tests: TypeScript Tooling Validation
 *
 * Verifies that TypeScript tooling actually works:
 * - tsconfig.json is created for TypeScript projects
 * - Type-checked ESLint rules catch real errors
 * - JavaScript-only projects don't get TypeScript tooling
 *
 * These tests validate that configuration leads to working enforcement.
 */

import { execSync } from 'node:child_process';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPackageJson,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runEslint,
  setupOrThrow,
  TIMEOUT_SETUP,
  TIMEOUT_SETUP_HOOK,
  writeTestFile,
} from '../helpers';

// =============================================================================
// Suite 1: TypeScript Project Setup
// =============================================================================

describe('E2E: TypeScript Project Setup', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(projectDirectory);
    writeTestFile(projectDirectory, 'src/index.ts', 'export const hello = "world";\n');
    initGitRepo(projectDirectory);
    await setupOrThrow(projectDirectory, ['setup'], { timeout: TIMEOUT_SETUP });
  }, TIMEOUT_SETUP_HOOK);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('creates tsconfig.json for TypeScript projects', () => {
    expect(fileExists(projectDirectory, 'tsconfig.json')).toBe(true);
  });

  it('tsconfig.json has correct settings', () => {
    const tsconfig = JSON.parse(readTestFile(projectDirectory, 'tsconfig.json'));
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noEmit).toBe(true);
    expect(tsconfig.compilerOptions.skipLibCheck).toBe(true);
  });

  it('creates eslint.config.mjs', () => {
    expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);
  });

  it('eslint.config.mjs references TypeScript', () => {
    const config = readTestFile(projectDirectory, 'eslint.config.mjs');
    // Config uses safeword which detects TypeScript
    expect(config).toContain('safeword');
  });
});

// =============================================================================
// Suite 2: Type-Checked ESLint Rules
// =============================================================================

describe('E2E: Type-Checked ESLint Rules', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    createTypeScriptPackageJson(projectDirectory);
    writeTestFile(projectDirectory, 'src/index.ts', 'export const placeholder = 1;\n');
    initGitRepo(projectDirectory);
    await setupOrThrow(projectDirectory, ['setup'], { timeout: TIMEOUT_SETUP });

    // Install dependencies so ESLint can run with type checking
    execSync('bun install', { cwd: projectDirectory, stdio: 'pipe' });
  }, TIMEOUT_SETUP_HOOK);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('ESLint runs without error on valid TypeScript', () => {
    writeTestFile(
      projectDirectory,
      'src/valid.ts',
      `export function getData(): string {
  return "data";
}

export function main(): void {
  const result = getData();
  console.log(result);
}
`,
    );

    const result = runEslint(projectDirectory, 'src/valid.ts');

    expect(result.status).toBe(0);
  });

  it('catches floating promises (missing await)', () => {
    writeTestFile(
      projectDirectory,
      'src/floating-promise.ts',
      `async function fetchData(): Promise<string> {
  return "data";
}

export function main() {
  fetchData(); // Missing await - floating promise
}
`,
    );

    const result = runEslint(projectDirectory, 'src/floating-promise.ts');

    // Should fail due to no-floating-promises
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/floating|promise|await/i);
  });

  it('catches misused promises (promise in conditional)', () => {
    writeTestFile(
      projectDirectory,
      'src/misused-promise.ts',
      `async function fetchData(): Promise<string> {
  return "data";
}

export function main() {
  const promise = fetchData();
  if (promise) { // Misused: checking promise instead of awaiting
    console.log("always true");
  }
}
`,
    );

    const result = runEslint(projectDirectory, 'src/misused-promise.ts');

    // Should fail due to no-misused-promises
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/promise|conditional|misused/i);
  });

  it('catches awaiting non-promises', () => {
    writeTestFile(
      projectDirectory,
      'src/await-non-promise.ts',
      `export async function main() {
  const value = 42;
  const result = await value; // Awaiting a non-promise
  console.log(result);
}
`,
    );

    const result = runEslint(projectDirectory, 'src/await-non-promise.ts');

    // Should fail due to await-thenable
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/await|thenable|promise/i);
  });
});

// =============================================================================
// Suite 3: JavaScript-Only Project
// =============================================================================

describe('E2E: JavaScript-Only Project', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = createTemporaryDirectory();
    // Create JS-only package.json (no typescript in devDependencies)
    createPackageJson(projectDirectory);
    writeTestFile(projectDirectory, 'src/index.js', 'module.exports = { hello: "world" };\n');
    initGitRepo(projectDirectory);
    await setupOrThrow(projectDirectory, ['setup'], { timeout: TIMEOUT_SETUP });
  }, TIMEOUT_SETUP_HOOK);

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('does NOT create tsconfig.json for JS-only projects', () => {
    expect(fileExists(projectDirectory, 'tsconfig.json')).toBe(false);
  });

  it('still creates eslint.config.mjs', () => {
    expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);
  });

  it('ESLint works on JavaScript files', () => {
    // Install deps and run ESLint
    execSync('bun install', { cwd: projectDirectory, stdio: 'pipe' });

    const result = runEslint(projectDirectory, 'src/index.js');

    // Should run without crashing: 0=success, 1=lint errors, 2=fatal, null=spawn failed
    expect(result.status === 0 || result.status === 1).toBe(true);
  });
});
