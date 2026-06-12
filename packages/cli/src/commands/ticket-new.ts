/**
 * `safeword ticket new <slug>` — mint a Crockford Base32 ticket ID and create
 * the ticket folder at `.safeword-project/tickets/{ID}/ticket.md` (ticket 158).
 *
 * Replaces the prompt-driven "find highest folder + 1" instruction in the
 * ticket-system skill, which was a race condition across parallel sessions
 * and silently colliding across git branches.
 */

import process from 'node:process';

import { cryptoIdMinter, type IdMinter } from '../utils/id-minter.js';
import { header, info, success } from '../utils/output.js';
import { normalizeSlug, SlugError } from '../utils/slug.js';
import { formatTicketReference } from '../utils/ticket-reference.js';
import { createTicket, TicketIdCollisionError, type TicketType } from '../utils/ticket-writer.js';

const VALID_TYPES: ReadonlySet<TicketType> = new Set(['patch', 'task', 'feature']);

export interface TicketNewOptions {
  type?: string;
  title?: string;
}

export function ticketNew(slug: string, options: TicketNewOptions): Promise<void> {
  ticketNewSync(slug, options);
  return Promise.resolve();
}

function ticketNewSync(slug: string, options: TicketNewOptions): void {
  const type = resolveType(options.type);
  if (type === 'invalid') {
    process.stderr.write(
      `Invalid --type=${String(options.type)}. Must be one of: patch, task, feature.\n`,
    );
    process.exit(1);
  }

  let normalizedSlug: string;
  try {
    normalizedSlug = normalizeSlug(slug);
  } catch (error: unknown) {
    if (error instanceof SlugError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  header('Create ticket');

  try {
    const result = createTicket(process.cwd(), resolveMinter(), {
      slug: normalizedSlug,
      type,
      title: options.title,
    });
    success(`Created ticket ${formatTicketReference(result.id, normalizedSlug)}`);
    info(`Folder: ${result.folderPath}`);
    info(`File:   ${result.ticketPath}`);
    // NB: deliberately no index regen here — writing INDEX.md into the tickets
    // dir on every `ticket new` pollutes "tickets dir = ticket folders" and makes
    // the index a cross-branch merge-conflict magnet (the most concurrent op).
    // The index refreshes via `safeword sync-tickets` and `safeword check`. 1GGD28.
  } catch (error: unknown) {
    if (error instanceof TicketIdCollisionError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

function resolveType(value: string | undefined): TicketType | undefined | 'invalid' {
  if (value === undefined) return undefined;
  return VALID_TYPES.has(value as TicketType) ? (value as TicketType) : 'invalid';
}

// Test-only injection point: SAFEWORD_TICKET_ID_OVERRIDE forces a specific
// minted ID so cross-branch collision scenarios can be exercised deterministically.
// The override is never set in production — the env var is intentionally
// undocumented to discourage real-world use.
function resolveMinter(): IdMinter {
  const override = process.env.SAFEWORD_TICKET_ID_OVERRIDE;
  if (override !== undefined && override !== '') {
    return { mint: () => override };
  }
  return cryptoIdMinter();
}
