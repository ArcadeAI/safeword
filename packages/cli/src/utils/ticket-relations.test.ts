/**
 * Unit tests for structured ticket relations (ticket AKZJXC).
 *
 * `depends_on` is one canonical directed edge, stored as an inline-array scalar
 * (`[A, B]`) the hand-rolled frontmatter parser can hold. The inverse `blocks`
 * is always DERIVED across the corpus, never stored. Validation warns (never
 * errors) on dangling refs and cycles, mirroring safeword's ID tolerance.
 */

import { describe, expect, it } from 'vitest';

import {
  deriveBlocks,
  findDanglingDependencies,
  findTicketsInCycles,
  parseTicketIdList,
  type TicketNode,
} from './ticket-relations.js';

describe('parseTicketIdList', () => {
  it('parses an inline array into ids', () => {
    expect(parseTicketIdList('[AKZJXC, 3293WH]')).toEqual(['AKZJXC', '3293WH']);
  });

  it('tolerates a bracketless comma list', () => {
    expect(parseTicketIdList('AKZJXC, 3293WH')).toEqual(['AKZJXC', '3293WH']);
  });

  it('trims surrounding whitespace on each id', () => {
    expect(parseTicketIdList('[ AKZJXC ,3293WH ]')).toEqual(['AKZJXC', '3293WH']);
  });

  it('drops empty entries', () => {
    expect(parseTicketIdList('[AKZJXC, , 3293WH]')).toEqual(['AKZJXC', '3293WH']);
  });

  it('returns [] for an empty list, empty string, or undefined', () => {
    expect(parseTicketIdList('[]')).toEqual([]);
    expect(parseTicketIdList('')).toEqual([]);
    expect(parseTicketIdList()).toEqual([]);
  });
});

describe('deriveBlocks', () => {
  it('inverts depends_on into blocks across the corpus', () => {
    const nodes: TicketNode[] = [
      { id: 'A', dependsOn: ['B', 'C'] },
      { id: 'D', dependsOn: ['B'] },
      { id: 'B', dependsOn: [] },
      { id: 'C', dependsOn: [] },
    ];
    const blocks = deriveBlocks(nodes);
    expect(blocks.get('B')).toEqual(['A', 'D']);
    expect(blocks.get('C')).toEqual(['A']);
    expect(blocks.get('A')).toBeUndefined();
  });
});

describe('findDanglingDependencies', () => {
  it('flags depends_on targets absent from the corpus', () => {
    const nodes: TicketNode[] = [
      { id: 'A', dependsOn: ['B', 'GONE'] },
      { id: 'B', dependsOn: [] },
    ];
    expect(findDanglingDependencies(nodes)).toEqual([{ from: 'A', missing: 'GONE' }]);
  });

  it('returns [] when every target exists', () => {
    const nodes: TicketNode[] = [
      { id: 'A', dependsOn: ['B'] },
      { id: 'B', dependsOn: [] },
    ];
    expect(findDanglingDependencies(nodes)).toEqual([]);
  });
});

describe('findTicketsInCycles', () => {
  it('returns the sorted ids of tickets in a two-node cycle', () => {
    const nodes: TicketNode[] = [
      { id: 'A', dependsOn: ['B'] },
      { id: 'B', dependsOn: ['A'] },
    ];
    expect(findTicketsInCycles(nodes)).toEqual(['A', 'B']);
  });

  it('detects a self-dependency as a cycle', () => {
    expect(findTicketsInCycles([{ id: 'A', dependsOn: ['A'] }])).toEqual(['A']);
  });

  it('returns [] for an acyclic graph', () => {
    const nodes: TicketNode[] = [
      { id: 'A', dependsOn: ['B'] },
      { id: 'B', dependsOn: ['C'] },
      { id: 'C', dependsOn: [] },
    ];
    expect(findTicketsInCycles(nodes)).toEqual([]);
  });
});
