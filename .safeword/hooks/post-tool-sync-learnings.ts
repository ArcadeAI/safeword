#!/usr/bin/env bun
// Safeword: Regenerate project-learnings skill when a learning file changes (PostToolUse)
// Ticket #130.

import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

interface HookInput {
  tool_input?: {
    file_path?: string;
    notebook_path?: string;
  };
}

let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch (error) {
  if (process.env.DEBUG) console.error('[post-tool-sync-learnings] stdin parse error:', error);
  process.exit(0);
}

const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!file) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const learningsDirectory = nodePath.join(projectDir, '.safeword-project', 'learnings');

// Only fire for files inside the learnings directory.
const resolvedFile = nodePath.resolve(file);
if (!resolvedFile.startsWith(`${nodePath.resolve(learningsDirectory)}${nodePath.sep}`)) {
  process.exit(0);
}
if (!resolvedFile.endsWith('.md')) process.exit(0);

// Best-effort: never block an edit. If bunx is missing or the CLI
// version doesn't yet ship sync-learnings, just exit 0.
spawnSync('bunx', ['safeword@latest', 'sync-learnings', '--quiet'], {
  cwd: projectDir,
  stdio: 'inherit',
  timeout: 30_000,
});
process.exit(0);
