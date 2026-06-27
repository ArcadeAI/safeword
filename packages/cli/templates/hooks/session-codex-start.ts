#!/usr/bin/env bun
// Safeword: Codex SessionStart dispatcher.
//
// Codex runs matching hooks for the same event concurrently, so auto-upgrade
// and SAFEWORD.md context injection must be sequenced through one command.

import process from 'node:process';

import { readHookInput, readSafewordContext, resolveProjectDir } from './lib/safeword-context.ts';
import { filterSafewordFiles } from './lib/owned-paths.ts';
import {
  runAutoUpgrade,
  toCodexSessionStartResponse,
  type AutoUpgradeOutcome,
} from './lib/auto-upgrade.ts';

const hookInput = await readHookInput();
const projectDir = resolveProjectDir(hookInput);
let outcome: AutoUpgradeOutcome = { kind: 'skipped', reason: 'not checked' };

try {
  outcome = await runAutoUpgrade({ projectDir, filterSafewordFiles });
} catch {
  // SessionStart context is more important than surfacing an auto-upgrade
  // implementation error. The next session will retry through the normal gates.
  outcome = { kind: 'skipped', reason: 'auto-upgrade error' };
}

const context = readSafewordContext(projectDir);
const response = toCodexSessionStartResponse({ outcome, additionalContext: context });

if (response.stdout) {
  process.stdout.write(response.stdout);
}
if (response.stderr) {
  process.stderr.write(response.stderr);
}

process.exit(response.exitCode);
