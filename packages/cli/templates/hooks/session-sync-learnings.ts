#!/usr/bin/env bun
// Safeword: Regenerate project-learnings skill at session start (catches out-of-band edits)
// Ticket #130.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const learningsDirectory = nodePath.join(projectDir, '.safeword-project', 'learnings');

// Not a safeword project with learnings, skip silently.
if (!existsSync(learningsDirectory)) process.exit(0);

// Prefer local source in dev/dogfood, fall back to published CLI.
// Best-effort: never block session start.
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
