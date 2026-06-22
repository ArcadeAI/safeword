/**
 * Unit tests for the duplicate-ID detector (ticket 158, slice 5).
 *
 * Covers Rule 6 in test-definitions.md: the pure function that scans ticket
 * folders, parses `id:` frontmatter, and returns groups of folders sharing
 * the same ID. Both wiring sites (pre-commit, CI) reuse this same detector.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../../tests/helpers.js';
import { findDuplicateTicketIds } from './duplicate-ids.js';

function makeTicket(projectDirectory: string, folder: string, id: string): void {
  const directory = nodePath.join(projectDirectory, '.safeword-project', 'tickets', folder);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    nodePath.join(directory, 'ticket.md'),
    `---
id: ${id}
type: task
status: in_progress
---

# Test
`,
  );
}

describe('findDuplicateTicketIds', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('returns an empty array when no tickets directory exists', () => {
    expect(findDuplicateTicketIds(cwd)).toEqual([]);
  });

  it('returns an empty array when no duplicates exist (mix of legacy and new)', () => {
    makeTicket(cwd, '080-foo', '080');
    makeTicket(cwd, '102a-bar', '102a');
    makeTicket(cwd, '7K9M3P', '7K9M3P');
    expect(findDuplicateTicketIds(cwd)).toEqual([]);
  });

  it('flags two NEW-format folders sharing the same id', () => {
    makeTicket(cwd, '7K9M3P', '7K9M3P');
    makeTicket(cwd, '7K9M3Q', '7K9M3P');
    const duplicates = findDuplicateTicketIds(cwd);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.id).toBe('7K9M3P');
    expect(duplicates[0]?.folders.toSorted((a, b) => a.localeCompare(b))).toEqual([
      '7K9M3P',
      '7K9M3Q',
    ]);
  });

  it('flags two LEGACY-format folders sharing the same id (reads frontmatter, not folder name)', () => {
    makeTicket(cwd, '080-original', '080');
    makeTicket(cwd, '080-duplicate', '080');
    const duplicates = findDuplicateTicketIds(cwd);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.id).toBe('080');
  });

  it('skips folders missing ticket.md', () => {
    makeTicket(cwd, '7K9M3P', '7K9M3P');
    mkdirSync(nodePath.join(cwd, '.safeword-project', 'tickets', 'orphan-folder'), {
      recursive: true,
    });
    expect(findDuplicateTicketIds(cwd)).toEqual([]);
  });

  it('skips ticket.md files with no id frontmatter', () => {
    makeTicket(cwd, '7K9M3P', '7K9M3P');
    const directory = nodePath.join(cwd, '.safeword-project', 'tickets', 'no-id');
    mkdirSync(directory, { recursive: true });
    writeFileSync(nodePath.join(directory, 'ticket.md'), '# No frontmatter\n');
    expect(findDuplicateTicketIds(cwd)).toEqual([]);
  });

  it('skips the completed/ archive', () => {
    makeTicket(cwd, '7K9M3P', '7K9M3P');
    makeTicket(cwd, nodePath.join('completed', '7K9M3P-archived'), '7K9M3P');
    expect(findDuplicateTicketIds(cwd)).toEqual([]);
  });
});
