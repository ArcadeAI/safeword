/**
 * Husky-world boundary-gate shims via setup/upgrade/reset (ZJMZ50, #810
 * child 2). Maps to features/host-repo-boundary-install.feature rules
 * TB1.R1/R2/R5 and SM1.R1 — real CLI runs into temp hosts, file bytes as the
 * oracle. Worlds other than husky (nudges, conflicts) live in the sibling
 * nudge suite (slice 4).
 */

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

const COMMIT_SHIM = 'node_modules/.bin/safeword boundary --at commit';
const PUSH_SHIM = 'node_modules/.bin/safeword boundary --at push';
const USER_LINE = 'npx lint-staged';

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('setup: husky hook shims (ZJMZ50 slice 3)', () => {
  let dir: string;

  beforeEach(() => {
    dir = createTemporaryDirectory();
    createTypeScriptProjectReadyForSetup(dir);
    initGitRepo(dir);
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
  });

  /** A husky host: versioned .husky dir with a user-owned pre-commit hook. */
  function seedHuskyHost() {
    writeTestFile(dir, '.husky/pre-commit', `${USER_LINE}\n`);
  }

  it('appends both shims without losing user hook content (TB1.R1)', async () => {
    seedHuskyHost();

    const result = await runCli(['setup'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    const preCommit = readTestFile(dir, '.husky/pre-commit');
    expect(preCommit).toContain(USER_LINE);
    expect(preCommit).toContain(COMMIT_SHIM);
    expect(preCommit).not.toContain(PUSH_SHIM);
  });

  it('creates a missing pre-push beside an existing pre-commit (TB1.R1)', async () => {
    seedHuskyHost();

    await runCli(['setup'], { cwd: dir });

    expect(fileExists(dir, '.husky/pre-push')).toBe(true);
    expect(readTestFile(dir, '.husky/pre-push')).toContain(PUSH_SHIM);
  });

  it('a second setup run is byte-identical and keeps exactly one shim (TB1.R2)', async () => {
    seedHuskyHost();
    await runCli(['setup'], { cwd: dir });
    const preCommitAfterFirst = readTestFile(dir, '.husky/pre-commit');
    const prePushAfterFirst = readTestFile(dir, '.husky/pre-push');
    expect(preCommitAfterFirst).toContain(COMMIT_SHIM);

    await runCli(['setup'], { cwd: dir });

    expect(readTestFile(dir, '.husky/pre-commit')).toBe(preCommitAfterFirst);
    expect(readTestFile(dir, '.husky/pre-push')).toBe(prePushAfterFirst);
    expect(count(readTestFile(dir, '.husky/pre-commit'), COMMIT_SHIM)).toBe(1);
  });

  it('upgrade over installed shims adds no duplicate (TB1.R2)', async () => {
    seedHuskyHost();
    await runCli(['setup'], { cwd: dir });

    const result = await runCli(['upgrade'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(count(readTestFile(dir, '.husky/pre-commit'), COMMIT_SHIM)).toBe(1);
    expect(count(readTestFile(dir, '.husky/pre-push'), PUSH_SHIM)).toBe(1);
  });

  it('reset restores a pre-existing hook byte-for-byte (TB1.R5)', async () => {
    seedHuskyHost();
    const before = readTestFile(dir, '.husky/pre-commit');
    await runCli(['setup'], { cwd: dir });
    expect(readTestFile(dir, '.husky/pre-commit')).toContain(COMMIT_SHIM);

    const result = await runCli(['reset', '--yes'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(readTestFile(dir, '.husky/pre-commit')).toBe(before);
  });

  it('reset removes a hook file that setup alone created (TB1.R5)', async () => {
    seedHuskyHost();
    await runCli(['setup'], { cwd: dir });
    expect(readTestFile(dir, '.husky/pre-push')).toContain(PUSH_SHIM);

    await runCli(['reset', '--yes'], { cwd: dir });

    expect(fileExists(dir, '.husky/pre-push')).toBe(false);
  });

  it('reset spares hook lines the user added after setup (TB1.R5)', async () => {
    seedHuskyHost();
    await runCli(['setup'], { cwd: dir });
    expect(readTestFile(dir, '.husky/pre-commit')).toContain(COMMIT_SHIM);
    const patched = readTestFile(dir, '.husky/pre-commit');
    writeTestFile(dir, '.husky/pre-commit', `${patched}npm run docs-check\n`);

    await runCli(['reset', '--yes'], { cwd: dir });

    const after = readTestFile(dir, '.husky/pre-commit');
    expect(after).toContain('npm run docs-check');
    expect(after).not.toContain(COMMIT_SHIM);
  });

  it('upgrade heals a stale shim line in place (SM1.R1)', async () => {
    // A block from an "older safeword": same marker, different command line.
    seedHuskyHost();
    writeTestFile(
      dir,
      '.husky/pre-commit',
      `${USER_LINE}\nnpx safeword boundary --legacy-flag || true # Safeword boundary gate: warn-only\n`,
    );

    const result = await runCli(['upgrade'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    const preCommit = readTestFile(dir, '.husky/pre-commit');
    expect(preCommit).toContain(USER_LINE);
    expect(preCommit).toContain(COMMIT_SHIM);
    expect(preCommit).not.toContain('--legacy-flag');
    expect(count(preCommit, 'Safeword boundary gate')).toBe(1);
  });

  it('a deleted shim line returns on upgrade (SM1.R1)', async () => {
    seedHuskyHost();
    await runCli(['setup'], { cwd: dir });
    writeTestFile(dir, '.husky/pre-commit', `${USER_LINE}\n`);

    await runCli(['upgrade'], { cwd: dir });

    expect(readTestFile(dir, '.husky/pre-commit')).toContain(COMMIT_SHIM);
  });

  it('a host without husky gets no .husky hook files (world gate)', async () => {
    // No .husky dir seeded: bare world — create-if-absent must not fire.
    const result = await runCli(['setup'], { cwd: dir });

    expect(result.exitCode).toBe(0);
    expect(fileExists(dir, '.husky/pre-commit')).toBe(false);
    expect(fileExists(dir, '.husky/pre-push')).toBe(false);
  });
});
