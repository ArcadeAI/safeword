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

import nodePath from 'node:path';
import process from 'node:process';

import { effectsFromMutationJournal } from '../cli-protocol/mutation-effects.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import { createTicketRouted, RoutedTicketCreationError } from '../ticket-create/index.js';
import { buildWriterRegistry } from '../tracker-sync/clients.js';
import { readTicketBridgeConfig } from '../tracker-sync/config.js';
import { linkChildToEpic, validateEpicParent } from '../utils/epic-linker.js';
import { cryptoIdMinter, type IdMinter } from '../utils/id-minter.js';
import { resolveParentContract } from '../utils/product-plan-contract.js';
import { normalizeSlug } from '../utils/slug.js';
import { TicketIdCollisionError, type TicketType } from '../utils/ticket-writer.js';

const VALID_TYPES: ReadonlySet<TicketType> = new Set(['patch', 'task', 'feature', 'epic']);
type ParsedTicketType = TicketType | undefined | 'invalid';

export interface TicketNewOptions {
  type?: string;
  title?: string;
  goal?: string;
  why?: string;
  parent?: string;
  milestone?: string;
  parentJob?: string;
  /** Adopt an existing tracker issue key as identity (issue-first providers only). */
  issue?: string;
}

export async function createTicketResult(
  slug: string,
  options: TicketNewOptions,
  cwd: string,
): Promise<CliResult> {
  let type: TicketType | undefined;
  let normalizedSlug: string;
  try {
    type = validateOptions(options, resolveType(options.type), cwd);
    normalizedSlug = normalizeSlug(slug);
  } catch (validationError) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'TICKET_INPUT_INVALID',
          message:
            validationError instanceof Error ? validationError.message : String(validationError),
          retryable: false,
        },
      ],
    });
  }

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
        milestone: options.milestone,
        parentJob: options.parentJob,
        issue: options.issue,
      },
      {
        config: readTicketBridgeConfig(cwd),
        buildWriter: (provider, target) => buildWriterRegistry(provider, target)[provider],
        minter: resolveMinter(),
      },
    );
    const findings = [];
    if (options.parent !== undefined) {
      const linked = linkChildToEpic(cwd, result.id, options.parent);
      if (!linked.ok) {
        findings.push({
          code: 'EPIC_REVERSE_LINK_FAILED',
          message: linked.reason,
          severity: 'warning' as const,
        });
      }
    }
    const effects =
      result.mutations.length === 0
        ? {
            files: [
              {
                kind: 'create',
                target: nodePath.relative(cwd, result.ticketPath),
                operation: 'write',
              },
              {
                kind: 'create',
                target: nodePath.relative(cwd, result.folderPath),
                operation: 'mkdir',
              },
            ],
          }
        : effectsFromMutationJournal(result.mutations);
    return createResult({
      state: 'changed',
      effects,
      findings,
      data: {
        command: 'ticket new',
        ticket_id: result.id,
        folder: nodePath.relative(cwd, result.folderPath),
        file: nodePath.relative(cwd, result.ticketPath),
      },
    });
  } catch (creationError) {
    const partialMutations =
      creationError instanceof RoutedTicketCreationError ? creationError.mutations : [];
    const changed = partialMutations.length > 0;
    return createResult({
      state: 'failed',
      changed,
      effects: effectsFromMutationJournal(partialMutations),
      errors: [
        {
          code:
            creationError instanceof TicketIdCollisionError
              ? 'TICKET_ID_COLLISION'
              : 'TICKET_CREATE_FAILED',
          message: errorMessage(creationError),
          retryable: !(creationError instanceof TicketIdCollisionError),
        },
      ],
      recovery: changed
        ? [
            {
              command: 'safeword tracker sync',
              description:
                'Reconcile the pending tracker reference before retrying ticket creation.',
              requiresHuman: false,
            },
          ]
        : [],
    });
  }
}

function validateOptions(
  options: TicketNewOptions,
  type: ParsedTicketType,
  cwd: string,
): TicketType | undefined {
  if (type === 'invalid') {
    throw new Error(
      `Invalid --type=${String(options.type)}. Must be one of: patch, task, feature, epic.`,
    );
  }
  if (options.why !== undefined && type === 'feature') {
    throw new Error(
      '--why does not apply to features — their motivation lives in spec.md. Use --goal, or edit spec.md.',
    );
  }
  validateParentOptions(options, type, cwd);
  return type;
}

function validateParentOptions(
  options: TicketNewOptions,
  type: ParsedTicketType,
  cwd: string,
): void {
  if (options.parent === undefined) {
    if (options.milestone !== undefined || options.parentJob !== undefined) {
      throw new Error('--milestone and --parent-job require --parent.');
    }
    return;
  }
  const check = validateEpicParent(cwd, options.parent);
  if (!check.ok) throw new Error(check.reason);
  if (type !== 'feature') throw new Error('--parent applies only to feature tickets.');
  if (!options.milestone?.trim()) throw new Error('--milestone is required with --parent.');
  if (!options.parentJob?.trim()) throw new Error('--parent-job is required with --parent.');
  resolveParentContract(cwd, options.parent, options.parentJob, options.milestone);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveType(value: string | undefined): ParsedTicketType {
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
