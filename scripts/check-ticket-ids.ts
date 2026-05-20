#!/usr/bin/env bun
/**
 * Loud-failure guard for duplicate ticket IDs (ticket 158, slice 5).
 *
 * Scans `.safeword-project/tickets/` and exits non-zero if any two folders
 * share the same `id:` in their frontmatter. Reused from both:
 *   - .husky/pre-commit (this script runs before lint-staged)
 *   - .github/workflows/ci.yml (the lint job)
 *
 * The pure detector lives in packages/cli/src/utils/duplicate-ids.ts so unit
 * tests cover the logic; this script is a thin formatting shell.
 *
 * Exit codes:
 *   0 — no duplicates
 *   1 — one or more duplicate IDs found
 */

import process from 'node:process';

import { findDuplicateTicketIds } from '../packages/cli/src/utils/duplicate-ids.js';

const duplicates = findDuplicateTicketIds(process.cwd());

if (duplicates.length === 0) {
  process.exit(0);
}

process.stderr.write('Duplicate ticket IDs detected:\n\n');
for (const group of duplicates) {
  process.stderr.write(`  id "${group.id}":\n`);
  for (const folder of group.folders) {
    process.stderr.write(`    .safeword-project/tickets/${folder}/\n`);
  }
  process.stderr.write('\n');
}
process.stderr.write(
  'Resolve by editing one ticket.md to have a fresh `id:` value, or by deleting the offending folder.\n',
);
process.exit(1);
