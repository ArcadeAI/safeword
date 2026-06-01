/**
 * Integration: LOC gate stands down during a git operation (ticket MT27QG).
 *
 * Proves the wired guard: with >400 uncommitted LOC, the post-tool LOC gate
 * arms normally — but NOT while a merge is in progress, so blast-radius control
 * can't deadlock conflict resolution.
 */

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  writeTestFile,
} from '../helpers.js';

/* eslint-disable unicorn/no-null -- quality-state JSON uses null values by design */

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const POST_TOOL_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/post-tool-quality.ts');

let projectDirectory: string;

beforeEach(() => {
  projectDirectory = createTemporaryDirectory();
  initGitRepo(projectDirectory);
  writeTestFile(projectDirectory, 'seed.txt', 'seed\n');
  execSync('git add seed.txt && git commit -m initial', {
    cwd: projectDirectory,
    stdio: 'pipe',
  });
});

afterEach(() => {
  removeTemporaryDirectory(projectDirectory);
});

/** Stage >400 lines of uncommitted non-meta change. */
function stageLargeChange(): void {
  const lines = Array.from({ length: 420 }, (_, i) => `const x${i} = ${i};`).join('\n');
  writeTestFile(projectDirectory, 'large-file.ts', lines);
  execSync('git add large-file.ts', { cwd: projectDirectory, stdio: 'pipe' });
}

function seedState(): void {
  const head = execSync('git rev-parse --short HEAD', {
    cwd: projectDirectory,
    encoding: 'utf8',
  }).trim();
  writeFileSync(
    nodePath.join(projectDirectory, '.safeword-project', 'quality-state-test.json'),
    JSON.stringify({ locSinceCommit: 0, lastCommitHash: head, activeTicket: null, gate: null }),
  );
}

function runPostTool(): { gate: string | null } {
  spawnSync('bun', [POST_TOOL_QUALITY], {
    input: JSON.stringify({
      session_id: 'test',
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: nodePath.join(projectDirectory, 'large-file.ts') },
    }),
    cwd: projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
    encoding: 'utf8',
  });
  const state = JSON.parse(
    readFileSync(
      nodePath.join(projectDirectory, '.safeword-project', 'quality-state-test.json'),
      'utf8',
    ),
  );
  return { gate: state.gate };
}

describe('LOC gate × git operation (MT27QG)', () => {
  it('loc_gate_still_arms_with_no_operation', () => {
    // create the state dir, then seed
    writeTestFile(projectDirectory, '.safeword-project/.keep', '');
    seedState();
    stageLargeChange();

    expect(runPostTool().gate).toBe('loc');
  });

  it('loc_gate_does_not_arm_mid_merge', () => {
    writeTestFile(projectDirectory, '.safeword-project/.keep', '');
    seedState();
    stageLargeChange();
    // Simulate a merge in progress.
    const head = execSync('git rev-parse HEAD', {
      cwd: projectDirectory,
      encoding: 'utf8',
    }).trim();
    writeFileSync(nodePath.join(projectDirectory, '.git', 'MERGE_HEAD'), `${head}\n`);

    expect(runPostTool().gate).not.toBe('loc');
  });
});

/* eslint-enable unicorn/no-null */
