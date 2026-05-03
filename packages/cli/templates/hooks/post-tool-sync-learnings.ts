#!/usr/bin/env bun
// Safeword: Regenerate .safeword-project/learnings/INDEX.md when a learning file changes (PostToolUse)
// Ticket #130.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

// Prefer local source in dev/dogfood, fall back to published CLI.
// Best-effort: never block an edit.
const localCli = nodePath.join(projectDir, 'packages/cli/src/cli.ts');
const [command, args] = existsSync(localCli)
  ? ['bun', [localCli, 'sync-learnings', '--quiet']]
  : ['bunx', ['safeword@latest', 'sync-learnings', '--quiet']];
spawnSync(command as string, args as string[], {
  cwd: projectDir,
  stdio: 'inherit',
  timeout: 30_000,
});
process.exit(0);
