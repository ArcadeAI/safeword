/**
 * Unit Tests: Hierarchy Navigation (Ticket #025)
 *
 * Tests the pure functions in .safeword/hooks/lib/hierarchy.ts:
 * - readTicketFrontmatter: parse YAML frontmatter, coerce IDs to strings
 * - resolveTicketDirectory: map ticket ID → directory path
 * - findNextWork: walk parent→siblings→NextAction
 * - updateTicketStatus: write status/phase/last_modified to ticket.md
 *
 * 8 scenarios from test-definitions.md covered at the unit level.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  findNextWork,
  isEmptyFrontmatterValue,
  parseFrontmatter,
  readTicketFrontmatter,
  resolveTicketDirectory,
  updateTicketStatus,
} from '../../templates/hooks/lib/hierarchy';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers';

/* eslint-disable unicorn/no-null -- Ticket frontmatter uses null values */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a ticket directory with frontmatter */
function createTicket(
  ticketsDirectory: string,
  slug: string,
  frontmatter: Record<string, unknown>,
  body = '',
): string {
  const directory = nodePath.join(ticketsDirectory, slug);
  mkdirSync(directory, { recursive: true });
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      // Write arrays in flow style: children: ['013a', '013b']
      const items = value.map(v => (typeof v === 'number' ? String(v) : `'${v}'`));
      lines.push(`${key}: [${items.join(', ')}]`);
    } else if (value === null) {
      lines.push(`${key}: null`);
    } else {
      lines.push(`${key}: ${value as string | number}`);
    }
  }
  lines.push('---', '', body);
  writeFileSync(nodePath.join(directory, 'ticket.md'), lines.join('\n'));
  return directory;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const directories: { temporary: string; tickets: string } = { temporary: '', tickets: '' };

beforeEach(() => {
  directories.temporary = createTemporaryDirectory();
  directories.tickets = nodePath.join(directories.temporary, '.safeword-project', 'tickets');
  mkdirSync(directories.tickets, { recursive: true });
});

afterEach(() => {
  removeTemporaryDirectory(directories.temporary);
});

describe('readTicketFrontmatter', () => {
  it('parses quoted string parent and children', () => {
    const ticketDirectory = createTicket(directories.tickets, '013a-bdd-compression', {
      id: "'013a'",
      type: 'feature',
      status: 'done',
      phase: 'done',
      parent: "'013'",
    });

    const fm = readTicketFrontmatter(ticketDirectory);
    expect(fm.parent).toBe('013');
    expect(fm.status).toBe('done');
    expect(fm.phase).toBe('done');
    expect(fm.type).toBe('feature');
  });

  it('parses unquoted number parent and children array', () => {
    const ticketDirectory = createTicket(directories.tickets, '001-epic', {
      id: '001',
      type: 'epic',
      status: 'in_progress',
      children: [6, 7, 8],
    });

    const fm = readTicketFrontmatter(ticketDirectory);
    // IDs should be coerced to strings
    expect(fm.children).toEqual(['6', '7', '8']);
  });

  it('handles null parent', () => {
    const ticketDirectory = createTicket(directories.tickets, '025-hierarchy', {
      id: '025',
      type: 'feature',
      parent: null,
    });

    const fm = readTicketFrontmatter(ticketDirectory);
    expect(fm.parent).toBeNull();
  });

  it('handles missing parent field', () => {
    const ticketDirectory = createTicket(directories.tickets, '030-standalone', {
      id: '030',
      type: 'task',
    });

    const fm = readTicketFrontmatter(ticketDirectory);
    expect(fm.parent).toBeNull();
  });

  it('handles missing children field', () => {
    const ticketDirectory = createTicket(directories.tickets, '016-epic', {
      id: '016',
      type: 'epic',
    });

    const fm = readTicketFrontmatter(ticketDirectory);
    expect(fm.children).toEqual([]);
  });
});

describe('resolveTicketDirectory', () => {
  it('resolves ticket ID to directory path', () => {
    createTicket(directories.tickets, '013a-bdd-compression', { id: "'013a'" });

    const resolved = resolveTicketDirectory('013a', directories.tickets);
    expect(resolved).toBe(nodePath.join(directories.tickets, '013a-bdd-compression'));
  });

  it('returns null for non-existent ticket', () => {
    const resolved = resolveTicketDirectory('999', directories.tickets);
    expect(resolved).toBeNull();
  });

  it('returns null when multiple directories match', () => {
    createTicket(directories.tickets, '013-epic-a', { id: '013' });
    createTicket(directories.tickets, '013-epic-b', { id: '013' });

    const resolved = resolveTicketDirectory('013', directories.tickets);
    expect(resolved).toBeNull();
  });
});

describe('updateTicketStatus', () => {
  it('updates status, phase, and last_modified', () => {
    const ticketDirectory = createTicket(directories.tickets, '013a-bdd', {
      id: "'013a'",
      status: 'in_progress',
      phase: 'done',
      last_modified: '2026-01-01T00:00:00Z',
    });

    updateTicketStatus(ticketDirectory, 'done', 'done');

    const content = readFileSync(nodePath.join(ticketDirectory, 'ticket.md'), 'utf8');
    expect(content).toMatch(/^status: done$/m);
    expect(content).toMatch(/^phase: done$/m);
    expect(content).not.toMatch(/last_modified: 2026-01-01T00:00:00Z/);
    expect(content).toMatch(/^last_modified: \d{4}-\d{2}-\d{2}T/m);
  });
});

describe('findNextWork', () => {
  // Scenario 1: Navigate to next undone sibling
  it('navigates to next undone sibling', () => {
    createTicket(directories.tickets, '001-epic', {
      id: '001',
      type: 'epic',
      status: 'in_progress',
      children: [6, 7, 8],
    });

    // Children are unquoted numbers [6, 7, 8] — YAML failsafe keeps as strings
    // Directory names use the same unpadded format to match
    const currentDirectory = createTicket(directories.tickets, '6-feature-a', {
      id: 6,
      status: 'done',
      phase: 'done',
      parent: '001',
    });

    createTicket(directories.tickets, '7-feature-b', {
      id: 7,
      status: 'in_progress',
      parent: '001',
    });

    createTicket(directories.tickets, '8-feature-c', {
      id: 8,
      status: 'ready',
      parent: '001',
    });

    const result = findNextWork(currentDirectory, directories.tickets);
    expect(result.type).toBe('navigate');
    if (result.type !== 'navigate') throw new Error('Expected navigate');
    expect(result.ticketId).toBe('7');
    expect(result.ticketDirectory).toContain('7-feature-b');
  });

  // Scenario 2: Skip done siblings, find next undone
  it('skips done siblings and finds next undone', () => {
    createTicket(directories.tickets, '013-epic', {
      id: "'013'",
      type: 'epic',
      status: 'in_progress',
      children: ['013a', '013b', '013c', '013d'],
    });

    createTicket(directories.tickets, '013a-feat', {
      id: "'013a'",
      status: 'done',
      parent: "'013'",
    });

    const currentDirectory = createTicket(directories.tickets, '013b-feat', {
      id: "'013b'",
      status: 'done',
      parent: "'013'",
    });

    createTicket(directories.tickets, '013c-feat', {
      id: "'013c'",
      status: 'done',
      parent: "'013'",
    });

    createTicket(directories.tickets, '013d-feat', {
      id: "'013d'",
      status: 'in_progress',
      parent: "'013'",
    });

    const result = findNextWork(currentDirectory, directories.tickets);
    expect(result.type).toBe('navigate');
    if (result.type !== 'navigate') throw new Error('Expected navigate');
    expect(result.ticketId).toBe('013d');
  });

  // Scenario 3: All siblings done — cascade parent to done
  it('returns cascade-done when all siblings are done', () => {
    createTicket(directories.tickets, '013-epic', {
      id: "'013'",
      type: 'epic',
      status: 'in_progress',
      children: ['013a', '013b'],
    });

    createTicket(directories.tickets, '013a-feat', {
      id: "'013a'",
      status: 'done',
      parent: "'013'",
    });

    const currentDirectory = createTicket(directories.tickets, '013b-feat', {
      id: "'013b'",
      status: 'done',
      parent: "'013'",
    });

    const result = findNextWork(currentDirectory, directories.tickets);
    expect(result.type).toBe('cascade-done');
    if (result.type !== 'cascade-done') throw new Error('Expected cascade-done');
    expect(result.parentId).toBe('013');
    expect(result.ticketDirectory).toContain('013-epic');
  });

  // Scenario 5: Standalone ticket (no parent) — allow stop
  it('returns all-done for standalone ticket with no parent', () => {
    const currentDirectory = createTicket(directories.tickets, '025-standalone', {
      id: '025',
      status: 'done',
      phase: 'done',
      parent: null,
    });

    const result = findNextWork(currentDirectory, directories.tickets);
    expect(result.type).toBe('all-done');
  });

  // Scenario 6: Broken hierarchy — parent directory missing
  it('returns all-done when parent directory is missing', () => {
    const currentDirectory = createTicket(directories.tickets, '050-orphan', {
      id: '050',
      status: 'done',
      phase: 'done',
      parent: "'999'",
    });

    const result = findNextWork(currentDirectory, directories.tickets);
    expect(result.type).toBe('all-done');
  });

  // Scenario 7: Children field empty or missing
  it('returns all-done when parent has no children field', () => {
    createTicket(directories.tickets, '016-epic', {
      id: '016',
      type: 'epic',
      status: 'in_progress',
    });

    const currentDirectory = createTicket(directories.tickets, '016a-feat', {
      id: "'016a'",
      status: 'done',
      parent: '016',
    });

    const result = findNextWork(currentDirectory, directories.tickets);
    expect(result.type).toBe('all-done');
  });
});
/* eslint-enable unicorn/no-null */

describe('isEmptyFrontmatterValue', () => {
  it.each([
    ['absent', undefined],
    ['blank', '  '],
    ['YAML null word', 'null'],
    ['YAML null tilde', '~'],
    ['capitalised YAML null', 'Null'],
    ['upper-case YAML null', 'NULL'],
    ['empty list', []],
    ['list of blanks', ['', '  ']],
    ['list of YAML nulls', ['null', '~', 'NULL']],
  ])('treats a %s value as empty', (_label, value) => {
    expect(isEmptyFrontmatterValue(value)).toBe(true);
  });

  it.each([
    ['scalar', 'auth only'],
    ['list with one item', ['', 'auth only']],
  ])('treats a %s as filled', (_label, value) => {
    expect(isEmptyFrontmatterValue(value)).toBe(false);
  });
});

describe('parseFrontmatter comments', () => {
  it('reads a comment-only scalar as the start of an empty block sequence', () => {
    expect(parseFrontmatter('scope: # TODO\nphase: intake')).toEqual({
      scope: [],
      phase: 'intake',
    });
  });

  it('keeps list items under a commented key', () => {
    expect(parseFrontmatter('scope: # notes\n  - auth')).toEqual({ scope: ['auth'] });
  });

  it('keeps a block list going across comment and blank lines', () => {
    expect(
      parseFrontmatter('scope:\n  # included behavior\n  - auth\n\n  - billing\nphase: intake'),
    ).toEqual({ scope: ['auth', 'billing'], phase: 'intake' });
  });

  it('reads a bare hyphen as a blank item without ending the list', () => {
    expect(parseFrontmatter('scope:\n  -\n  - auth')).toEqual({ scope: ['', 'auth'] });
  });

  it('reads list items written without indentation', () => {
    expect(parseFrontmatter('scope:\n- auth\n- billing\nphase: intake')).toEqual({
      scope: ['auth', 'billing'],
      phase: 'intake',
    });
  });

  it('reads a comment-only list item as blank', () => {
    expect(parseFrontmatter('scope:\n  - # later')).toEqual({ scope: [''] });
  });

  it.each([
    ['a scalar', 'status: done # finished', { status: 'done' }],
    ['an empty flow list', 'scope: [] # TODO', { scope: [] }],
    ['a YAML null', 'scope: null # pending', { scope: 'null' }],
    ['a quoted empty string', "scope: '' # pending", { scope: '' }],
    ['a quoted hash', "title: 'a # b' # note", { title: 'a # b' }],
    ['a list item', 'scope:\n  - auth # first', { scope: ['auth'] }],
  ])('drops a trailing comment after %s', (_case, yaml, expected) => {
    expect(parseFrontmatter(yaml)).toEqual(expected);
  });

  it('keeps issue references and attached hashes as content', () => {
    expect(parseFrontmatter('title: Fix#123\nscope:\n  - #563 cost gate')).toEqual({
      title: 'Fix#123',
      scope: ['#563 cost gate'],
    });
  });
});

describe('parseFrontmatter block scalars', () => {
  it('reads indented lines under a literal block as one value', () => {
    expect(parseFrontmatter('scope: |\n  line one\n  line two\nphase: intake')).toEqual({
      scope: 'line one\nline two',
      phase: 'intake',
    });
  });

  it('reads an empty folded block as an empty value', () => {
    expect(parseFrontmatter('scope: >-\nphase: intake')).toEqual({ scope: '', phase: 'intake' });
  });

  it.each(['|2-', '>-2', '|+', '>'])('reads an empty %s block as an empty value', indicator => {
    expect(parseFrontmatter(`scope: ${indicator}\nphase: intake`)).toEqual({
      scope: '',
      phase: 'intake',
    });
  });

  it('keeps list-looking lines inside a block as text', () => {
    expect(parseFrontmatter('scope: |\n  - not a list')).toEqual({ scope: '- not a list' });
  });
});
