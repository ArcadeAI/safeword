#!/usr/bin/env bun
// Safeword: Codex SessionStart dispatcher.
//
// Session hooks are observation-only: upgrades are explicit CLI operations.

import process from 'node:process';

import {
  readHookInput,
  readSafewordContext,
  resolveProjectDir,
  withCodexAuthority,
} from './lib/safeword-context.ts';
import { toCodexSessionStartResponse } from './lib/auto-upgrade.ts';
import { claimCodexCloseoutHandoff } from './lib/closeout-binding.ts';

const hookInput = await readHookInput();
const projectDir = resolveProjectDir(hookInput);
const context = readSafewordContext(projectDir);
const sessionId = typeof hookInput.session_id === 'string' ? hookInput.session_id : '';
const handoff = claimCodexCloseoutHandoff({ projectDirectory: projectDir, sessionId });
const closeoutScript = process.env.CLAUDE_PLUGIN_ROOT
  ? `"${process.env.CLAUDE_PLUGIN_ROOT}/resources/scripts/closeout-cleanup.ts"`
  : '.safeword/scripts/closeout-cleanup.ts';
const closeoutContext = handoff
  ? `\n\nPending closeout recovered after restart: run bun ${closeoutScript} --pr ${handoff.pull_request}. Re-observe and preview before applying; this handoff grants no cleanup authority.`
  : '';
const response = toCodexSessionStartResponse({
  outcome: { kind: 'skipped', reason: 'upgrades require an explicit CLI command' },
  additionalContext: `${withCodexAuthority(context)}${closeoutContext}`,
});

if (response.stdout) {
  process.stdout.write(response.stdout);
}
if (response.stderr) {
  process.stderr.write(response.stderr);
}

process.exit(response.exitCode);
