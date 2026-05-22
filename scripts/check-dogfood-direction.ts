#!/usr/bin/env bun
/**
 * Pre-commit guard: block commits that stage a dogfood file without also
 * staging its canonical pair (when the two differ on disk).
 *
 * Background: SAFEWORD_SCHEMA.ownedFiles maps dogfood paths (e.g.
 * `.safeword/hooks/foo.ts`) to canonical templates under
 * `packages/cli/templates/`. Canonical is the source of truth — running
 * `bunx safeword install` syncs canonical → dogfood. If you edit only the
 * dogfood side and run install, your change is silently overwritten.
 *
 * This guard catches that wrong-direction edit at commit time. The CI
 * release-gate test catches drift regardless of direction; this script
 * adds local, directional feedback so you know which side to edit.
 *
 * Bypass (rare, intentional divergence): `git commit --no-verify`.
 */

import { execSync } from 'node:child_process';
import console from 'node:console';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { SAFEWORD_SCHEMA } from '../packages/cli/src/schema.js';

const TEMPLATES_DIRECTORY = 'packages/cli/templates';

const stagedOutput = execSync('git diff --cached --name-only --diff-filter=ACM', {
  encoding: 'utf8',
});
const stagedSet = new Set(stagedOutput.split('\n').filter(Boolean));

interface Violation {
  dogfoodPath: string;
  canonicalPath: string;
}

const violations: Violation[] = [];

for (const [dogfoodPath, definition] of Object.entries(SAFEWORD_SCHEMA.ownedFiles)) {
  if (!definition.template) continue;
  if (!stagedSet.has(dogfoodPath)) continue;

  const canonicalPath = nodePath.join(TEMPLATES_DIRECTORY, definition.template);

  // Both sides staged — paired commit, fine.
  if (stagedSet.has(canonicalPath)) continue;

  // Either file missing — can't compare; defer to release-gate test.
  if (!existsSync(canonicalPath) || !existsSync(dogfoodPath)) continue;

  // Content matches — staging the dogfood is a no-op for parity, fine.
  if (readFileSync(canonicalPath, 'utf8') === readFileSync(dogfoodPath, 'utf8')) continue;

  violations.push({ dogfoodPath, canonicalPath });
}

if (violations.length === 0) process.exit(0);

console.error('pre-commit: dogfood-only edits detected.');
console.error('Canonical templates are the source of truth — `bunx safeword install` would');
console.error('silently overwrite your dogfood edit. Edit the canonical instead:');
console.error('');
for (const { dogfoodPath, canonicalPath } of violations) {
  console.error(`  edited:  ${dogfoodPath}`);
  console.error(`  edit:    ${canonicalPath}`);
  console.error('');
}
console.error('If you really do want a temporary intentional divergence,');
console.error('bypass with: git commit --no-verify');
process.exit(1);
