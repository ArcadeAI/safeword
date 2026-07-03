#!/usr/bin/env bun
// Safeword: Cursor adapter for afterFileEdit
// Auto-lints changed files, sets marker for stop hook

import { existsSync } from 'node:fs';

import { stashCursorTranscript } from '../lib/cursor-transcript-stash.ts';
import { lintFile } from '../lib/lint.ts';
import { getRunStorageKey, resolveRunIdentity } from '../lib/run-identity.ts';
import { installCrashCapture } from '../lib/self-report.ts';

installCrashCapture('cursor-after-file-edit', undefined, 'cursor');

interface CursorInput {
  workspace_roots?: string[];
  file_path?: string;
  conversation_id?: string;
  generation_id?: string;
  // Stashed for the user-invoked `/retro` command; see cursor-transcript-stash.ts.
  transcript_path?: string;
}

// Read hook input from stdin
let input: CursorInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

const workspace = input.workspace_roots?.[0];
const file = input.file_path;
const runIdentity = resolveRunIdentity(input, { runtime: 'cursor' });
const markerKey = getRunStorageKey(runIdentity) ?? 'cursor-default';

// Exit silently if no file or file doesn't exist
if (!file || !(await Bun.file(file).exists())) {
  process.exit(0);
}

// Change to workspace directory
if (workspace) {
  process.chdir(workspace);
}

// Check for .safeword directory
if (!existsSync('.safeword')) {
  process.exit(0);
}

// Set marker file for stop hook to know edits were made
const markerFile = `/tmp/safeword-cursor-edited-${markerKey}`;
await Bun.write(markerFile, '');

// Stash transcript_path so the user-invoked `/retro` command (which gets no
// payload) can resolve THIS conversation's transcript (RTSK9C / #624).
stashCursorTranscript(input);

// Lint the file
await lintFile(file, process.cwd());
