/**
 * Hook-integration nudges for non-husky worlds (ZJMZ50, #810 child 2).
 * Maps to features/host-repo-boundary-install.feature rules TB1.R1
 * (conflict rejection), TB1.R3 (snippets, never edits) and SM1.R2
 * (never-fire guards). Real CLI runs; stdout+stderr and file bytes as
 * the oracle.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  createTypeScriptProjectReadyForSetup,
  fileExists,
  initGitRepo,
  readTestFile,
  removeTemporaryDirectory,
  runCli,
  writeTestFile,
} from '../helpers';

const BOUNDARY_INVOCATION = 'safeword boundary --at commit';
const LEFTHOOK_CONFIG = 'pre-commit:\n  commands:\n    lint:\n      run: npm run lint\n';

describe('setup: hook-integration nudges (ZJMZ50 slice 4)', () => {
  let dir: string;

  beforeEach(() => {
    dir = createTemporaryDirectory();
    createTypeScriptProjectReadyForSetup(dir);
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
  });

  const output = (result: { stdout: string; stderr: string }) =>
    `${result.stdout}\n${result.stderr}`;

  it('lefthook host gets a verbatim snippet and an untouched config (TB1.R3)', async () => {
    initGitRepo(dir);
    writeTestFile(dir, 'lefthook.yml', LEFTHOOK_CONFIG);

    const result = await runCli(['setup'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(output(result)).toContain(BOUNDARY_INVOCATION);
    expect(output(result)).toContain('lefthook');
    expect(readTestFile(dir, 'lefthook.yml')).toBe(LEFTHOOK_CONFIG);
    expect(fileExists(dir, '.husky/pre-commit')).toBe(false);
  });

  it('pre-commit-framework host gets a snippet and an untouched config (TB1.R3)', async () => {
    initGitRepo(dir);
    writeTestFile(dir, '.pre-commit-config.yaml', 'repos: []\n');

    const result = await runCli(['setup'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(output(result)).toContain(BOUNDARY_INVOCATION);
    expect(readTestFile(dir, '.pre-commit-config.yaml')).toBe('repos: []\n');
    expect(fileExists(dir, '.husky/pre-commit')).toBe(false);
  });

  it('bare host is pointed at husky without any hook writes (TB1.R3)', async () => {
    initGitRepo(dir);

    const result = await runCli(['setup'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(output(result)).toContain('husky');
    expect(fileExists(dir, '.husky')).toBe(false);
    expect(fileExists(dir, '.git/hooks/pre-commit')).toBe(false);
  });

  it('husky-installed-but-uninitialized host is nudged, not shimmed (TB1.R3)', async () => {
    initGitRepo(dir);
    const packageJson = JSON.parse(readTestFile(dir, 'package.json')) as {
      devDependencies?: Record<string, string>;
    };
    packageJson.devDependencies = { ...packageJson.devDependencies, husky: '^9.1.7' };
    writeTestFile(dir, 'package.json', `${JSON.stringify(packageJson, undefined, 2)}\n`);

    const result = await runCli(['setup'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(fileExists(dir, '.husky/pre-commit')).toBe(false);
    expect(output(result)).toMatch(/husky init/i);
  });

  it('conflicting manager signals nudge instead of shimming (TB1.R1 rejection)', async () => {
    initGitRepo(dir);
    mkdirSync(nodePath.join(dir, '.husky'), { recursive: true });
    writeTestFile(dir, '.husky/pre-commit', 'npx lint-staged\n');
    writeTestFile(dir, 'lefthook.yml', LEFTHOOK_CONFIG);
    execFileSync('git', ['config', 'core.hooksPath', '.git/hooks'], { cwd: dir, stdio: 'pipe' });

    const result = await runCli(['setup'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(readTestFile(dir, '.husky/pre-commit')).toBe('npx lint-staged\n');
    expect(output(result)).toContain(BOUNDARY_INVOCATION);
  });

  it('pasting the printed snippet quiesces the nudge (TB1.R3 rejection)', async () => {
    initGitRepo(dir);
    writeTestFile(dir, 'lefthook.yml', LEFTHOOK_CONFIG);
    const first = await runCli(['setup'], { cwd: dir });
    // Extract the printed snippet's command into the config the way a user
    // pasting it would: the config now invokes the boundary gate.
    expect(output(first)).toContain(BOUNDARY_INVOCATION);
    writeTestFile(
      dir,
      'lefthook.yml',
      `${LEFTHOOK_CONFIG}    safeword-boundary:\n      run: node_modules/.bin/safeword boundary --at commit || true\n`,
    );

    const second = await runCli(['setup'], { cwd: dir });

    expect(second.exitCode).toBe(0);
    expect(output(second)).not.toContain(BOUNDARY_INVOCATION);
  });

  it('non-git directory gets no hook writes and no hook nudge (SM1.R2 rejection)', async () => {
    const result = await runCli(['setup'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(fileExists(dir, '.husky/pre-commit')).toBe(false);
    expect(output(result)).not.toContain(BOUNDARY_INVOCATION);
    expect(output(result)).not.toMatch(/hook manager|husky init/i);
  });

  it('setup in a monorepo subdirectory plants no dead hooks and notes the root (SM1.R2)', async () => {
    initGitRepo(dir);
    const sub = nodePath.join(dir, 'packages', 'app');
    mkdirSync(sub, { recursive: true });
    createTypeScriptProjectReadyForSetup(sub);

    const result = await runCli(['setup'], { cwd: sub });

    expect(result.exitCode).toBe(0);
    expect(fileExists(sub, '.husky/pre-commit')).toBe(false);
    expect(output(result)).toMatch(/repository root/i);
  });
});
