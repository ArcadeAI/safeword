/**
 * Creates a new ticket folder + ticket.md (ticket 158).
 *
 * Folder layout: `.safeword-project/tickets/{ID}/ticket.md`. Folder name is the
 * Crockford ID alone — slug lives in frontmatter. Any duplicate ID becomes a
 * real git merge conflict instead of two silently-coexisting folders.
 *
 * EEXIST retry + fresh-install (no tickets dir yet) handled here. Slice 1 sets
 * up the structure; slice 2 wires the deterministic retry tests.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { IdMinter } from './id-minter.js';

const TICKETS_SUBPATH = ['.safeword-project', 'tickets'];
const RETRY_BUDGET = 5;

export type TicketType = 'patch' | 'task' | 'feature';

export interface NewTicketOptions {
  slug: string;
  type?: TicketType;
  title?: string;
  /** Override `new Date()` for tests. */
  now?: () => Date;
}

export interface NewTicketResult {
  id: string;
  folderPath: string;
  ticketPath: string;
}

export class TicketIdCollisionError extends Error {
  constructor(
    public readonly attemptedIds: string[],
    public readonly retryBudget: number,
  ) {
    super(
      `Failed to mint a unique ticket ID after ${retryBudget} attempts. Tried: ${attemptedIds.join(', ')}.`,
    );
    this.name = 'TicketIdCollisionError';
  }
}

export function createTicket(
  cwd: string,
  minter: IdMinter,
  options: NewTicketOptions,
): NewTicketResult {
  const ticketsDirectory = nodePath.join(cwd, ...TICKETS_SUBPATH);
  if (!existsSync(ticketsDirectory)) {
    mkdirSync(ticketsDirectory, { recursive: true });
  }

  const { id, folderPath } = mintAndClaim(ticketsDirectory, minter);
  const ticketPath = nodePath.join(folderPath, 'ticket.md');
  writeFileSync(ticketPath, renderTicketMarkdown(id, options));

  return { id, folderPath, ticketPath };
}

function mintAndClaim(
  ticketsDirectory: string,
  minter: IdMinter,
): { id: string; folderPath: string } {
  const attempted: string[] = [];
  for (let attempt = 0; attempt < RETRY_BUDGET; attempt++) {
    const id = minter.mint();
    const folderPath = nodePath.join(ticketsDirectory, id);
    try {
      mkdirSync(folderPath);
      return { id, folderPath };
    } catch (error: unknown) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;
      attempted.push(id);
    }
  }
  throw new TicketIdCollisionError(attempted, RETRY_BUDGET);
}

function renderTicketMarkdown(id: string, options: NewTicketOptions): string {
  const type = options.type ?? 'task';
  const now = (options.now ?? (() => new Date()))().toISOString();
  const title = options.title ?? options.slug;

  return `---
id: ${id}
slug: ${options.slug}
type: ${type}
phase: intake
status: in_progress
created: ${now}
last_modified: ${now}
---

# ${title}

**Goal:** {One sentence: what are we trying to achieve?}

**Why:** {One sentence: why does this matter?}

## Work Log

- ${now} Started: Created ticket ${id}
`;
}
