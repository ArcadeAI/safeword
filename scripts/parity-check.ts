#!/usr/bin/env bun
/**
 * Safeword parity check CLI.
 *
 * Invokes runParity() against SAFEWORD_SCHEMA and reports drift.
 *
 * Usage:
 *   bun scripts/parity-check.ts                  # mode=all
 *   bun scripts/parity-check.ts --mode=all
 *   bun scripts/parity-check.ts --mode=contracts-only
 *
 * Exit codes:
 *   0 — no failures
 *   1 — one or more parity failures (mode-dependent)
 *
 * Surfaces:
 *   - .husky/pre-commit invokes with --mode=contracts-only (hard-block contracts)
 *   - .claude/commands/parity-check.md invokes with --mode=all (informational)
 */

import nodePath from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { runParity, type ParityMode } from '../packages/cli/src/parity.js';
import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';

const scriptDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const repoRoot = nodePath.resolve(scriptDirectory, '..');
const templatesDirectory = nodePath.resolve(repoRoot, 'packages/cli/templates');

const arguments_ = process.argv.slice(2);
const modeFlag = arguments_.find(a => a.startsWith('--mode='))?.split('=')[1];
const mode: ParityMode = modeFlag === 'contracts-only' ? 'contracts-only' : 'all';

const pairCount = Object.values(SAFEWORD_SCHEMA.ownedFiles).filter(d => d.template).length;
const contractCount = Object.keys(SAFEWORD_SCHEMA.contracts).length;

const result = runParity({
  schema: SAFEWORD_SCHEMA,
  mode,
  rootDirectory: repoRoot,
  templatesDirectory,
});

if (result.failures.length === 0) {
  if (mode === 'all') {
    console.log(`All ${pairCount} pairs and ${contractCount} contracts in sync.`);
  } else {
    console.log(`All ${contractCount} contracts in sync.`);
  }
  process.exit(0);
}

console.error(`Parity drift detected (${result.failures.length} failure(s)):`);
for (const failure of result.failures) {
  console.error(`  - ${failure.message}`);
}
process.exit(1);
