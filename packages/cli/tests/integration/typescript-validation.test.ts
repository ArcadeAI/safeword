/**
 * E2E Tests: TypeScript Tooling Validation
 *
 * Verifies that TypeScript tooling actually works:
 * - tsconfig.json is created for TypeScript projects and the TypeScript BDD lane
 * - Type-checked ESLint rules catch real errors
 * - JavaScript-only projects don't get TypeScript tooling
 *
 * These tests validate that configuration leads to working enforcement.
 */

import { execSync, spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPackageJson,
  createTemporaryDirectory,
  createTypeScriptPackageJson,
  fileExists,
  initGitRepo,
  INSTALL_DEPENDENCIES_ENV,
  readTestFile,
  removeTemporaryDirectory,
  runEslint,
  setupOrThrow,
  TIMEOUT_SETUP,
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
  });

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
  });

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

  it('passes its own lint across the whole fresh install (#6966)', () => {
    const result = runEslint(projectDirectory, '.');

    expect(result.stdout).toBe('');
    expect(result.status).toBe(0);
  });

  it('type-checks the fresh install, including the scaffolded BDD steps (#6966)', () => {
    const result = spawnSync('bunx', ['tsc', '--noEmit', '-p', '.'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    expect(result.stdout).toBe('');
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
    // Real installs: the claims below are about what install adds to package.json.
    await setupOrThrow(projectDirectory, ['setup'], {
      env: INSTALL_DEPENDENCIES_ENV,
      timeout: TIMEOUT_SETUP,
    });
    execSync('bun install', { cwd: projectDirectory, stdio: 'pipe' });
  });

  afterAll(() => {
    if (projectDirectory) {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('creates tsconfig.json for the BDD lane steps even in JS-only projects (#6966)', () => {
    // The scaffolded steps/*.ts need a compiler and project for type-aware lint.
    expect(fileExists(projectDirectory, 'tsconfig.json')).toBe(true);
  });

  it('still creates eslint.config.mjs', () => {
    expect(fileExists(projectDirectory, 'eslint.config.mjs')).toBe(true);
  });

  it('ESLint works on JavaScript files', () => {
    const result = runEslint(projectDirectory, 'src/index.js');

    // Should run without crashing: 0=success, 1=lint errors, 2=fatal, null=spawn failed
    expect(result.status === 0 || result.status === 1).toBe(true);
  });

  it('installs a compiler for the TypeScript BDD steps (#6966)', () => {
    const manifest = JSON.parse(readTestFile(projectDirectory, 'package.json')) as {
      devDependencies: Record<string, string>;
    };
    expect(manifest.devDependencies.typescript).toBe('~6.0.0');
  });

  it('reports no lint findings in any file safeword scaffolded (#6966)', () => {
    const result = runEslint(projectDirectory, '.', ['--format', 'json']);
    const root = realpathSync(projectDirectory);
    const findings = (
      JSON.parse(result.stdout) as { filePath: string; messages: { ruleId: string | null }[] }[]
    )
      .map(report => ({
        file: nodePath.relative(root, report.filePath),
        rules: report.messages.map(message => message.ruleId ?? 'parse'),
      }))
      // src/ is the fixture's own code; everything else came from safeword.
      .filter(report => !report.file.startsWith('src/') && report.rules.length > 0);

    expect(findings).toEqual([]);
  });
});
