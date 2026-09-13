#!/usr/bin/env bun
// Safeword: Claude auto-upgrade wrapper (SessionStart asyncRewake).

import process from 'node:process';

import { filterSafewordFiles } from './lib/owned-paths.ts';
import { runAutoUpgrade, toClaudeAutoUpgradeResponse } from './lib/auto-upgrade.ts';

// Native plugin releases are upgraded by Claude's plugin lifecycle. Never
// reach through the registry or mutate legacy project framework code here.
if (process.env.SAFEWORD_PLUGIN_CLI !== undefined) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const outcome = await runAutoUpgrade({ projectDir, filterSafewordFiles });
const response = toClaudeAutoUpgradeResponse(outcome);

if (response.stderr) process.stderr.write(response.stderr);
if (response.stdout) process.stdout.write(response.stdout);
process.exit(response.exitCode);
