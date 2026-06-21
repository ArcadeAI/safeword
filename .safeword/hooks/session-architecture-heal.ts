#!/usr/bin/env bun
// Safeword: Architecture state-document self-heal (SessionStart)
// Refreshes the architecture state doc at the configured paths.architecture so
// structural facts stay fresh — including after out-of-band human edits. Skips
// any document safeword does not own (no generator marker), so a hand-written
// ARCHITECTURE.md is never overwritten. Best-effort: never blocks a session.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// Not a safeword project — nothing to do.
if (!existsSync(nodePath.join(projectDir, '.safeword'))) {
  process.exit(0);
}

// Prefer local source in dev/dogfood, fall back to the published CLI.
const localCli = nodePath.join(projectDir, 'packages/cli/src/cli.ts');
const [command, args] = existsSync(localCli)
  ? ['bun', [localCli, 'architecture']]
  : ['bunx', ['safeword@latest', 'architecture']];

spawnSync(command as string, args as string[], {
  cwd: projectDir,
  stdio: 'inherit',
  timeout: 30_000,
});
