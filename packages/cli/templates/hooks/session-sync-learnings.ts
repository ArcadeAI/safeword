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

// Best-effort: never block session start. If bunx is missing or the CLI
// version doesn't yet ship sync-learnings, exit 0 quietly.
spawnSync('bunx', ['safeword@latest', 'sync-learnings', '--quiet'], {
  cwd: projectDir,
  stdio: 'inherit',
  timeout: 30_000,
});
process.exit(0);
