/**
 * Emitted-shim runtime semantics under husky's strict shell (ZJMZ50, TB1.R4).
 *
 * Husky's `_/h` runner executes hook files with `sh -e`, so any unguarded
 * failing line BLOCKS the commit. These tests execute the hook files setup
 * actually emitted — not the template string — with an empty PATH (proving
 * explicit-path resolution, learning 9P3VVH) across the three binary states:
 * recorder (gate invoked), absent (fresh clone), crashing (broken install).
 */

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync } from 'node:fs';
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

describe('emitted shim under sh -e (ZJMZ50 slice 5)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = createTemporaryDirectory();
    createTypeScriptProjectReadyForSetup(dir);
    initGitRepo(dir);
    // Husky world with no pre-existing hooks: setup creates both hook files
    // holding exactly the shim — the emitted artifact under test.
    mkdirSync(nodePath.join(dir, '.husky'), { recursive: true });
    await runCli(['setup'], { cwd: dir });
  });

  afterEach(() => {
    removeTemporaryDirectory(dir);
  });

  /** Run an emitted hook file the way husky's runner does: sh -e, repo cwd.
   * Empty PATH proves the shim resolves its binary by explicit path. */
  function runHook(hook: string): void {
    execFileSync('/bin/sh', ['-e', `.husky/${hook}`], {
      cwd: dir,
      env: { PATH: '' },
      stdio: 'pipe',
    });
  }

  function installStubBinary(script: string): void {
    const binDirectory = nodePath.join(dir, 'node_modules', '.bin');
    mkdirSync(binDirectory, { recursive: true });
    writeTestFile(dir, 'node_modules/.bin/safeword', script);
    chmodSync(nodePath.join(binDirectory, 'safeword'), 0o755);
  }

  it.each([
    ['pre-commit', 'commit'],
    ['pre-push', 'push'],
  ])('the emitted %s hook invokes the gate at the %s boundary', (hook, boundary) => {
    installStubBinary('#!/bin/sh\nprintf \'%s \' "$@" > safeword-invoked.txt\n');

    runHook(hook);

    expect(fileExists(dir, 'safeword-invoked.txt')).toBe(true);
    expect(readTestFile(dir, 'safeword-invoked.txt')).toContain(`boundary --at ${boundary}`);
  });

  it('the emitted hook passes when the binary is absent (fresh clone)', () => {
    expect(fileExists(dir, 'node_modules/.bin/safeword')).toBe(false);

    expect(() => {
      runHook('pre-commit');
    }).not.toThrow();
  });

  it('the emitted hook passes even when the gate crashes', () => {
    installStubBinary('#!/bin/sh\nexit 1\n');

    expect(() => {
      runHook('pre-commit');
    }).not.toThrow();
    expect(() => {
      runHook('pre-push');
    }).not.toThrow();
  });
});
