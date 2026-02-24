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
  readTicketFrontmatter,
  resolveTicketDirectory,
  updateTicketStatus,
} from '../../../../.safeword/hooks/lib/hierarchy';
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

let temporaryDirectory: string;
let ticketsDirectory: string;

beforeEach(() => {
  temporaryDirectory = createTemporaryDirectory();
  ticketsDirectory = nodePath.join(temporaryDirectory, '.safeword-project', 'tickets');
  mkdirSync(ticketsDirectory, { recursive: true });
});

afterEach(() => {
  removeTemporaryDirectory(temporaryDirectory);
});

describe('readTicketFrontmatter', () => {
  it('parses quoted string parent and children', () => {
    const ticketDirectory = createTicket(ticketsDirectory, '013a-bdd-compression', {
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
    const ticketDirectory = createTicket(ticketsDirectory, '001-epic', {
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
    const ticketDirectory = createTicket(ticketsDirectory, '025-hierarchy', {
      id: '025',
      type: 'feature',
      parent: null,
    });

    const fm = readTicketFrontmatter(ticketDirectory);
    expect(fm.parent).toBeNull();
  });

  it('handles missing parent field', () => {
    const ticketDirectory = createTicket(ticketsDirectory, '030-standalone', {
      id: '030',
      type: 'task',
    });

    const fm = readTicketFrontmatter(ticketDirectory);
    expect(fm.parent).toBeNull();
  });

  it('handles missing children field', () => {
    const ticketDirectory = createTicket(ticketsDirectory, '016-epic', {
      id: '016',
      type: 'epic',
    });

    const fm = readTicketFrontmatter(ticketDirectory);
    expect(fm.children).toEqual([]);
  });
});

describe('resolveTicketDirectory', () => {
  it('resolves ticket ID to directory path', () => {
    createTicket(ticketsDirectory, '013a-bdd-compression', { id: "'013a'" });

    const resolved = resolveTicketDirectory('013a', ticketsDirectory);
    expect(resolved).toBe(nodePath.join(ticketsDirectory, '013a-bdd-compression'));
  });

  it('returns null for non-existent ticket', () => {
    const resolved = resolveTicketDirectory('999', ticketsDirectory);
    expect(resolved).toBeNull();
  });

  it('returns null when multiple directories match', () => {
    createTicket(ticketsDirectory, '013-epic-a', { id: '013' });
    createTicket(ticketsDirectory, '013-epic-b', { id: '013' });

    const resolved = resolveTicketDirectory('013', ticketsDirectory);
    expect(resolved).toBeNull();
  });
});

describe('updateTicketStatus', () => {
  it('updates status, phase, and last_modified', () => {
    const ticketDirectory = createTicket(ticketsDirectory, '013a-bdd', {
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
    createTicket(ticketsDirectory, '001-epic', {
      id: '001',
      type: 'epic',
      status: 'in_progress',
      children: [6, 7, 8],
    });

    // Children are unquoted numbers [6, 7, 8] — YAML failsafe keeps as strings
    // Directory names use the same unpadded format to match
    const currentDirectory = createTicket(ticketsDirectory, '6-feature-a', {
      id: 6,
      status: 'done',
      phase: 'done',
      parent: '001',
    });

    createTicket(ticketsDirectory, '7-feature-b', {
      id: 7,
      status: 'in_progress',
      parent: '001',
    });

    createTicket(ticketsDirectory, '8-feature-c', {
      id: 8,
      status: 'ready',
      parent: '001',
    });

    const result = findNextWork(currentDirectory, ticketsDirectory);
    expect(result.type).toBe('navigate');
    expect(result.ticketId).toBe('7');
    expect(result.ticketDirectory).toContain('7-feature-b');
  });

  // Scenario 2: Skip done siblings, find next undone
  it('skips done siblings and finds next undone', () => {
    createTicket(ticketsDirectory, '013-epic', {
      id: "'013'",
      type: 'epic',
      status: 'in_progress',
      children: ['013a', '013b', '013c', '013d'],
    });

    createTicket(ticketsDirectory, '013a-feat', {
      id: "'013a'",
      status: 'done',
      parent: "'013'",
    });

    const currentDirectory = createTicket(ticketsDirectory, '013b-feat', {
      id: "'013b'",
      status: 'done',
      parent: "'013'",
    });

    createTicket(ticketsDirectory, '013c-feat', {
      id: "'013c'",
      status: 'done',
      parent: "'013'",
    });

    createTicket(ticketsDirectory, '013d-feat', {
      id: "'013d'",
      status: 'in_progress',
      parent: "'013'",
    });

    const result = findNextWork(currentDirectory, ticketsDirectory);
    expect(result.type).toBe('navigate');
    expect(result.ticketId).toBe('013d');
  });

  // Scenario 3: All siblings done — cascade parent to done
  it('returns cascade-done when all siblings are done', () => {
    createTicket(ticketsDirectory, '013-epic', {
      id: "'013'",
      type: 'epic',
      status: 'in_progress',
      children: ['013a', '013b'],
    });

    createTicket(ticketsDirectory, '013a-feat', {
      id: "'013a'",
      status: 'done',
      parent: "'013'",
    });

    const currentDirectory = createTicket(ticketsDirectory, '013b-feat', {
      id: "'013b'",
      status: 'done',
      parent: "'013'",
    });

    const result = findNextWork(currentDirectory, ticketsDirectory);
    expect(result.type).toBe('cascade-done');
    expect(result.parentId).toBe('013');
    expect(result.ticketDirectory).toContain('013-epic');
  });

  // Scenario 5: Standalone ticket (no parent) — allow stop
  it('returns all-done for standalone ticket with no parent', () => {
    const currentDirectory = createTicket(ticketsDirectory, '025-standalone', {
      id: '025',
      status: 'done',
      phase: 'done',
      parent: null,
    });

    const result = findNextWork(currentDirectory, ticketsDirectory);
    expect(result.type).toBe('all-done');
  });

  // Scenario 6: Broken hierarchy — parent directory missing
  it('returns all-done when parent directory is missing', () => {
    const currentDirectory = createTicket(ticketsDirectory, '050-orphan', {
      id: '050',
      status: 'done',
      phase: 'done',
      parent: "'999'",
    });

    const result = findNextWork(currentDirectory, ticketsDirectory);
    expect(result.type).toBe('all-done');
  });

  // Scenario 7: Children field empty or missing
  it('returns all-done when parent has no children field', () => {
    createTicket(ticketsDirectory, '016-epic', {
      id: '016',
      type: 'epic',
      status: 'in_progress',
    });

    const currentDirectory = createTicket(ticketsDirectory, '016a-feat', {
      id: "'016a'",
      status: 'done',
      parent: '016',
    });

    const result = findNextWork(currentDirectory, ticketsDirectory);
    expect(result.type).toBe('all-done');
  });
});
