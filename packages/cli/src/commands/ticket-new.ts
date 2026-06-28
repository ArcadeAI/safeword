/**
 * `safeword ticket new <slug>` — mint a Crockford Base32 ticket ID and create
 * the ticket folder at `<namespace-root>/tickets/{ID}-{slug}/ticket.md` (ticket 158).
 *
 * Replaces the prompt-driven "find highest folder + 1" instruction in the
 * ticket-system skill, which was a race condition across parallel sessions
 * and silently colliding across git branches.
 */

import process from 'node:process';

import { buildWriterRegistry } from '../tracker-sync/clients.js';
import { readTicketBridgeConfig } from '../tracker-sync/config.js';
import { cryptoIdMinter, type IdMinter } from '../utils/id-minter.js';
import { header, info, success } from '../utils/output.js';
import { normalizeSlug, SlugError } from '../utils/slug.js';
import { formatTicketReference } from '../utils/ticket-reference.js';
import { TicketIdCollisionError, type TicketType } from '../utils/ticket-writer.js';
import { createTicketRouted } from './create-ticket-routed.js';

const VALID_TYPES: ReadonlySet<TicketType> = new Set(['patch', 'task', 'feature']);

export interface TicketNewOptions {
  type?: string;
  title?: string;
  /** Adopt an existing tracker issue key as identity (issue-first providers only). */
  issue?: string;
}

export async function ticketNew(slug: string, options: TicketNewOptions): Promise<void> {
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

  const cwd = process.cwd();
  try {
    const result = await createTicketRouted(
      cwd,
      { slug: normalizedSlug, type, title: options.title, issue: options.issue },
      {
        config: readTicketBridgeConfig(cwd),
        buildWriter: (provider, target) => buildWriterRegistry(provider, target)[provider],
        minter: resolveMinter(),
      },
    );
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
    // Issue-first creation mints identity before any folder, so a tracker failure
    // here leaves no orphan. Surface the message (gh/Arcade never echo the token).
    process.stderr.write(`Failed to create ticket: ${errorMessage(error)}\n`);
    process.exit(1);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
