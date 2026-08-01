#!/usr/bin/env bun
// Safeword: Codex SessionStart dispatcher.
//
// Session hooks are observation-only: upgrades are explicit CLI operations.

import process from 'node:process';

import { readHookInput, readSafewordContext, resolveProjectDir } from './lib/safeword-context.ts';
import { toCodexSessionStartResponse } from './lib/auto-upgrade.ts';

const hookInput = await readHookInput();
const projectDir = resolveProjectDir(hookInput);
const context = readSafewordContext(projectDir);
const response = toCodexSessionStartResponse({
  outcome: { kind: 'skipped', reason: 'upgrades require an explicit CLI command' },
  additionalContext: context,
});

if (response.stdout) {
  process.stdout.write(response.stdout);
}
if (response.stderr) {
  process.stderr.write(response.stderr);
}

process.exit(response.exitCode);
