#!/usr/bin/env bun
// Safeword: Architecture state-document self-heal (SessionStart)
// Refreshes the generated architecture state doc (.project/architecture.generated.md) so
// structural facts stay fresh — including after out-of-band human edits. Skips
// any document safeword does not own (no generator marker), so a hand-written
// ARCHITECTURE.md is never overwritten. Best-effort: never blocks a session.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { safewordCli } from './lib/safeword-cli.ts';
import process from 'node:process';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// Not a safeword project — nothing to do.
if (!existsSync(nodePath.join(projectDir, '.safeword'))) {
  process.exit(0);
}

const cli = safewordCli(projectDir);
if (cli === undefined) process.exit(0);

spawnSync(cli.command, [...cli.args, 'architecture'], {
  cwd: projectDir,
  stdio: 'inherit',
  timeout: 30_000,
});
