/**
 * Unit tests for ticket folder/ticket.md creation (ticket 158, slice 2).
 *
 * Covers Rule 2 in test-definitions.md: EEXIST retry succeeds, retry budget
 * exhausted fails loud, fresh-install (no tickets dir yet) is handled.
 *
 * Tests use a stub minter that returns a controlled sequence — no flakes,
 * no CLI subprocess overhead.
 */

import { existsSync, mkdirSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTemporaryDirectory, removeTemporaryDirectory } from '../../tests/helpers.js';
import type { IdMinter } from './id-minter.js';
import { createTicket, TicketIdCollisionError } from './ticket-writer.js';

function sequenceMinter(sequence: string[]): IdMinter {
  let index = 0;
  return {
    mint(): string {
      const value = sequence[index];
      if (value === undefined) throw new Error('sequence exhausted in test');
      index++;
      return value;
    },
  };
}

function constantMinter(value: string): IdMinter {
  return { mint: () => value };
}

const ticketsSubpath = (cwd: string): string => nodePath.join(cwd, '.safeword-project', 'tickets');

describe('createTicket — EEXIST retry', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('retries with the next minted ID when the first folder already exists', () => {
    const ticketsDirectory = ticketsSubpath(cwd);
    mkdirSync(nodePath.join(ticketsDirectory, 'AAAAAA'), { recursive: true });

    const minter = sequenceMinter(['AAAAAA', 'BBBBBB']);
    const result = createTicket(cwd, minter, { slug: 'foo' });

    expect(result.id).toBe('BBBBBB');
    expect(existsSync(nodePath.join(ticketsDirectory, 'BBBBBB', 'ticket.md'))).toBe(true);
  });

  it('succeeds within the retry budget after N-1 collisions', () => {
    const ticketsDirectory = ticketsSubpath(cwd);
    for (const id of ['AAAAAA', 'BBBBBB', 'CCCCCC', 'DDDDDD']) {
      mkdirSync(nodePath.join(ticketsDirectory, id), { recursive: true });
    }

    const minter = sequenceMinter(['AAAAAA', 'BBBBBB', 'CCCCCC', 'DDDDDD', 'EEEEEE']);
    const result = createTicket(cwd, minter, { slug: 'foo' });

    expect(result.id).toBe('EEEEEE');
  });

  it('throws TicketIdCollisionError when the retry budget is exhausted', () => {
    const ticketsDirectory = ticketsSubpath(cwd);
    mkdirSync(nodePath.join(ticketsDirectory, 'ZZZZZZ'), { recursive: true });

    const minter = constantMinter('ZZZZZZ');
    expect(() => createTicket(cwd, minter, { slug: 'foo' })).toThrow(TicketIdCollisionError);
  });

  it('TicketIdCollisionError names the colliding ID and the retry budget', () => {
    const ticketsDirectory = ticketsSubpath(cwd);
    mkdirSync(nodePath.join(ticketsDirectory, 'ZZZZZZ'), { recursive: true });

    const minter = constantMinter('ZZZZZZ');
    try {
      createTicket(cwd, minter, { slug: 'foo' });
      expect.fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(TicketIdCollisionError);
      const collisionError = error as TicketIdCollisionError;
      expect(collisionError.attemptedIds).toContain('ZZZZZZ');
      expect(collisionError.retryBudget).toBe(5);
      expect(collisionError.message).toContain('ZZZZZZ');
      expect(collisionError.message).toContain('5');
    }
  });
});

describe('createTicket — fresh install', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = createTemporaryDirectory();
  });

  afterEach(() => {
    removeTemporaryDirectory(cwd);
  });

  it('creates .safeword-project/tickets/ when it does not yet exist', () => {
    expect(existsSync(ticketsSubpath(cwd))).toBe(false);

    const minter = constantMinter('FIRSTT');
    const result = createTicket(cwd, minter, { slug: 'kickoff' });

    expect(result.id).toBe('FIRSTT');
    expect(existsSync(nodePath.join(ticketsSubpath(cwd), 'FIRSTT', 'ticket.md'))).toBe(true);
  });
});
