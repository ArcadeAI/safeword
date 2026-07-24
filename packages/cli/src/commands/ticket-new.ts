/**
 * `safeword ticket new <slug>` — mint a Crockford Base32 ticket ID and create
 * the ticket folder at `<namespace-root>/tickets/{ID}-{slug}/ticket.md` (ticket 158).
 *
 * Replaces the prompt-driven "find highest folder + 1" instruction in the
 * ticket-system skill, which was a race condition across parallel sessions
 * and silently colliding across git branches.
 *
 * Identity routing (KKNFZA DGH59K): `provider:none` keeps the local minter
 * exactly as before; a configured GitHub/Linear provider mints identity from
 * the tracker (issue-first), keying the folder to the issue key. Epics always
 * route local — an epic is a safeword-internal coordination container whose
 * `children[]` reverse-index is over local folder ids, so its identity does not
 * off-board. `--parent` epic-linking composes on top of whichever route runs.
 */

import process from 'node:process';

import { createTicketRouted } from '../ticket-create/index.js';
import { buildWriterRegistry } from '../tracker-sync/clients.js';
import { readTicketBridgeConfig } from '../tracker-sync/config.js';
import { linkChildToEpic, validateEpicParent } from '../utils/epic-linker.js';
import { cryptoIdMinter, type IdMinter } from '../utils/id-minter.js';
import { header, info, success } from '../utils/output.js';
import { normalizeSlug, SlugError } from '../utils/slug.js';
import { formatTicketReference } from '../utils/ticket-reference.js';
import { TicketIdCollisionError, type TicketType } from '../utils/ticket-writer.js';

const VALID_TYPES: ReadonlySet<TicketType> = new Set(['patch', 'task', 'feature', 'epic']);

export interface TicketNewOptions {
  type?: string;
  title?: string;
  goal?: string;
  why?: string;
  parent?: string;
  /** Adopt an existing tracker issue key as identity (issue-first providers only). */
  issue?: string;
}

export async function ticketNew(
  slug: string,
  options: TicketNewOptions,
  cwd: string = process.cwd(),
): Promise<void> {
  const type = assertOptionsValid(options, resolveType(options.type), cwd);
  const normalizedSlug = resolveSlug(slug);

  header('Create ticket');

  try {
    const result = await createTicketRouted(
      cwd,
      {
        slug: normalizedSlug,
        type,
        title: options.title,
        goal: options.goal,
        why: options.why,
        parent: options.parent,
        issue: options.issue,
      },
      {
        config: readTicketBridgeConfig(cwd),
        buildWriter: (provider, target) => buildWriterRegistry(provider, target)[provider],
        minter: resolveMinter(),
      },
    );
    // Write the reverse index on the epic: append the child to its children[].
    // The epic was validated pre-create, but could have changed since — the
    // child already exists here, so surface a recoverable warning, not a fail.
    if (options.parent !== undefined) {
      const linked = linkChildToEpic(cwd, result.id, options.parent);
      if (!linked.ok) {
        process.stderr.write(
          `Warning: ${linked.reason} — created ${result.id} with parent: ${options.parent}, but the epic's children list was not updated. Add '${result.id}' to its children: manually.\n`,
        );
      }
    }
    success(`Created ticket ${formatTicketReference(result.id, normalizedSlug)}`);
    info(`Folder: ${result.folderPath}`);
    info(`File:   ${result.ticketPath}`);
    // NB: deliberately no index regen here — writing INDEX.md into the tickets
    // dir on every `ticket new` pollutes "tickets dir = ticket folders" and makes
    // the index a cross-branch merge-conflict magnet (the most concurrent op).
    // The index refreshes via `safeword sync-tickets` and `safeword check`. 1GGD28.
  } catch (error: unknown) {
    if (error instanceof TicketIdCollisionError) {
      fail(error.message);
    }
    // Issue-first creation mints identity before any folder, so a tracker failure
    // here leaves no orphan. Surface the message (gh/Arcade never echo the token).
    process.stderr.write(`Failed to create ticket: ${errorMessage(error)}\n`);
    process.exit(1);
  }
}

/** Validate all option constraints, exiting before anything is created;
 * returns the type narrowed past the `invalid` sentinel. */
function assertOptionsValid(
  options: TicketNewOptions,
  type: TicketType | undefined | 'invalid',
  cwd: string,
): TicketType | undefined {
  if (type === 'invalid') {
    fail(`Invalid --type=${String(options.type)}. Must be one of: patch, task, feature, epic.`);
  }
  // Features keep motivation in spec.md (single source of truth), so they have
  // no **Why:** field for --why to fill — fail loud rather than silently drop it.
  if (options.why !== undefined && type === 'feature') {
    fail(
      '--why does not apply to features — their motivation lives in spec.md. Use --goal, or edit spec.md.',
    );
  }
  // Validate --parent BEFORE creating anything, so a bad epic reference leaves
  // no half-linked child behind (AC3).
  if (options.parent !== undefined) {
    const check = validateEpicParent(cwd, options.parent);
    if (!check.ok) fail(check.reason);
  }
  return type;
}

function resolveSlug(slug: string): string {
  try {
    return normalizeSlug(slug);
  } catch (error: unknown) {
    if (error instanceof SlugError) fail(error.message);
    throw error;
  }
}

/** Write a one-line diagnostic to stderr and exit non-zero. */
function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
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
