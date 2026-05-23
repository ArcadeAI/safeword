/**
 * Integration test: SessionStart conflict-detection warning.
 *
 * Ticket 645W8H. Rule 5 (post-elicit Q2 re-scope).
 *
 * Conflict = another Claude session in this worktree edited a file in its
 * last ~10 turns AND that file is currently dirty in `git status`. On conflict,
 * the SessionStart hook adds a warning line to additionalContext naming the
 * file(s); status-line surfacing is Slice 3.
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory, TIMEOUT_QUICK } from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const SESSION_START_REENTRY = nodePath.join(
  SAFEWORD_ROOT,
  '.safeword/hooks/session-start-reentry.ts',
);

function makeLogFile(directory: string, lines: string[]): void {
  const briefDirectory = nodePath.join(directory, '.safeword-project');
  mkdirSync(briefDirectory, { recursive: true });
  writeFileSync(nodePath.join(briefDirectory, 're-entry.md'), `${lines.join('\n')}\n`);
}

function initGitRepoWithDirtyFile(directory: string, file: string): void {
  // Set up a minimal git repo, commit a baseline of the file, then dirty it.
  execSync('git init -q', { cwd: directory });
  execSync('git config user.email "test@example.com"', { cwd: directory });
  execSync('git config user.name "Test"', { cwd: directory });
  writeFileSync(nodePath.join(directory, file), 'original content\n');
  execSync('git add .', { cwd: directory });
  execSync('git commit -q -m "baseline"', { cwd: directory });
  // Dirty it.
  writeFileSync(nodePath.join(directory, file), 'dirty content\n');
}

function makeTranscriptWithEdit(
  transcriptsDirectory: string,
  sessionFilename: string,
  editedFilePath: string,
): string {
  mkdirSync(transcriptsDirectory, { recursive: true });
  const line = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          name: 'Edit',
          id: 'tu_1',
          input: { file_path: editedFilePath },
        },
      ],
    },
  });
  const path = nodePath.join(transcriptsDirectory, sessionFilename);
  writeFileSync(path, line);
  return path;
}

function runSessionStartWithTranscript(
  directory: string,
  sessionId: string,
  source: 'startup' | 'resume',
  transcriptPath: string,
) {
  return spawnSync('bun', [SESSION_START_REENTRY], {
    input: JSON.stringify({
      session_id: sessionId,
      source,
      cwd: directory,
      transcript_path: transcriptPath,
    }),
    cwd: directory,
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

describe('session-start-reentry hook — Rule 5: conflict detection', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(projectDirectory);
  });

  it('multiple dirty-file overlaps → warning names all of them', () => {
    initGitRepoWithDirtyFile(projectDirectory, 'foo.ts');
    // Dirty a second file too.
    writeFileSync(nodePath.join(projectDirectory, 'bar.ts'), 'fresh\n');
    execSync('git add bar.ts', { cwd: projectDirectory });
    execSync('git commit -q -m "add bar"', { cwd: projectDirectory });
    writeFileSync(nodePath.join(projectDirectory, 'bar.ts'), 'dirty\n');

    const transcriptsDirectory = nodePath.join(projectDirectory, '.fake-claude-projects');
    // Same other-session transcript records edits on BOTH files.
    mkdirSync(transcriptsDirectory, { recursive: true });
    const otherLines = [
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              name: 'Edit',
              id: 'tu_foo',
              input: { file_path: nodePath.join(projectDirectory, 'foo.ts') },
            },
            {
              type: 'tool_use',
              name: 'Edit',
              id: 'tu_bar',
              input: { file_path: nodePath.join(projectDirectory, 'bar.ts') },
            },
          ],
        },
      }),
    ];
    writeFileSync(nodePath.join(transcriptsDirectory, 'sess_other.jsonl'), otherLines.join('\n'));
    const currentTranscript = nodePath.join(transcriptsDirectory, 'sess_current.jsonl');
    writeFileSync(currentTranscript, '');

    makeLogFile(projectDirectory, [
      '2026-05-22T10:00:00Z sess_current ticket=∅/freeform Next: keep going',
    ]);

    const result = runSessionStartWithTranscript(
      projectDirectory,
      'sess_current',
      'resume',
      currentTranscript,
    );

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? '';

    expect(ctx).toContain('foo.ts');
    expect(ctx).toContain('bar.ts');
    expect(ctx.toLowerCase()).toContain('conflict');
  });

  it('single dirty-file overlap → warning names the file', () => {
    // Set up: foo.ts is dirty in git, another session edited it recently.
    initGitRepoWithDirtyFile(projectDirectory, 'foo.ts');

    const transcriptsDirectory = nodePath.join(projectDirectory, '.fake-claude-projects');
    makeTranscriptWithEdit(
      transcriptsDirectory,
      'sess_other.jsonl',
      nodePath.join(projectDirectory, 'foo.ts'),
    );
    const currentTranscript = nodePath.join(transcriptsDirectory, 'sess_current.jsonl');
    writeFileSync(currentTranscript, '');

    // Give the current session some entries so the brief renders too.
    makeLogFile(projectDirectory, [
      '2026-05-22T10:00:00Z sess_current ticket=∅/freeform Next: continue here',
    ]);

    const result = runSessionStartWithTranscript(
      projectDirectory,
      'sess_current',
      'resume',
      currentTranscript,
    );

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    const ctx = parsed.hookSpecificOutput?.additionalContext ?? '';

    // Warning naming the file should appear.
    expect(ctx).toContain('foo.ts');
    expect(ctx.toLowerCase()).toContain('conflict');

    // Normal brief still renders alongside the warning.
    expect(ctx).toContain('continue here');
  });
});
