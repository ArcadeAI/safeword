#!/usr/bin/env bun
// Safeword: Claude auto-upgrade wrapper (SessionStart asyncRewake).
//
// The shared core returns typed outcomes; this wrapper preserves Claude Code's
// existing asyncRewake contract by surfacing actionable notices on stderr with
// exit code 2 and staying silent for transient skips.

import process from 'node:process';

import { filterSafewordFiles } from './lib/owned-paths.ts';
import { runAutoUpgrade, toClaudeAutoUpgradeResponse } from './lib/auto-upgrade.ts';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const outcome = await runAutoUpgrade({ projectDir, filterSafewordFiles });
const response = toClaudeAutoUpgradeResponse(outcome);

if (response.stderr) {
  process.stderr.write(response.stderr);
}
if (response.stdout) {
  process.stdout.write(response.stdout);
}

process.exit(response.exitCode);
