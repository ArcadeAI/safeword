/**
 * Creates a new ticket folder + ticket.md (ticket 158).
 *
 * Folder layout: `<namespace-root>/tickets/{ID}-{slug}/ticket.md`. The ID
 * stays the unique key (stored in frontmatter `id:` and used by the duplicate
 * detector); the slug suffix is for human/agent legibility when scanning
 * `ls` output. Mint-time collision check rejects any minted ID already in
 * use by an existing folder, regardless of that folder's slug suffix.
 *
 * Safety layers against duplicate IDs (PR #160 trade-off):
 *   1. Mint-time: idsAlreadyTaken() — within one working copy, blocks re-mint.
 *   2. Post-merge: check-ticket-ids.ts (pre-commit + CI) — across branches,
 *      duplicate `id:` in frontmatter is the loud failure. The previous
 *      layout (`{ID}/` alone) used identical filesystem paths as an extra
 *      merge-time conflict layer; the slug suffix breaks that, so detection
 *      shifts entirely to the post-merge detector.
 *
 * Mint-collision retry + fresh-install (no tickets dir yet) handled here.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { TrackerReference } from '../tracker-sync/types.js';
import { resolveTicketsDirectory } from './configured-paths.js';
import { getTemplatesDirectory } from './fs.js';
import type { IdMinter } from './id-minter.js';

const RETRY_BUDGET = 5;
const NON_TICKET_ENTRIES = new Set(['completed', 'tmp']);

export type TicketType = 'patch' | 'task' | 'feature' | 'epic';

export interface NewTicketOptions {
  slug: string;
  type?: TicketType;
  title?: string;
  /** One-line Goal; fills the `**Goal:**` field instead of leaving a placeholder. */
  goal?: string;
  /** One-line Why; fills `**Why:**` for task/patch/epic. Not valid for features
   * (their motivation lives in spec.md) — the CLI rejects `--why` there. */
  why?: string;
  /** Epic id this ticket is a child of; written as `parent:` frontmatter. */
  parent?: string;
  /** Stable milestone id declared by the parent Product Plan. */
  milestone?: string;
  /** Stable parent JTBD id declared by the parent Product Plan. */
  parentJob?: string;
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

/** A tracker-minted identity for issue-first creation. */
export interface MintedIdentity {
  /** The canonical ticket id — the tracker's own issue key. */
  id: string;
  /** The recorded reference, for the caller to persist in the tracker-map. */
  ref?: TrackerReference;
}

/** Mints identity from the tracker (the network boundary). Injected for tests. */
export type IdentitySource = () => Promise<MintedIdentity>;

const SAFE_TRACKER_IDENTITY = /^[A-Z0-9][\w.-]*$/i;
const WINDOWS_RESERVED_DEVICE_WITH_EXTENSION = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])\./i;

/**
 * Tracker identities become part of a ticket folder name. Keep that boundary
 * deliberately narrower than platform path syntax: GitHub numbers, Linear
 * keys, and UUIDs all fit, while separators, drive prefixes, dot segments, and
 * control characters cannot reach path normalization. A bare Windows device
 * name is safe after the required `-${slug}` suffix; a device name followed by
 * a period remains reserved even after that suffix and must be rejected.
 */
function assertSafeTrackerIdentity(id: string): void {
  if (!SAFE_TRACKER_IDENTITY.test(id) || WINDOWS_RESERVED_DEVICE_WITH_EXTENSION.test(id)) {
    throw new Error(
      `Tracker returned "${JSON.stringify(id)}", which is not a safe ticket identity.`,
    );
  }
}

export function createTicket(
  cwd: string,
  minter: IdMinter,
  options: NewTicketOptions,
): NewTicketResult {
  const ticketsDirectory = ensureTicketsDirectory(cwd);
  const { id, folderPath } = mintAndClaim(ticketsDirectory, minter, options.slug);
  const { ticketPath } = writeTicketContents(folderPath, id, options);
  return { id, folderPath, ticketPath };
}

/**
 * Issue-first creation (KKNFZA TB1.AC1): identity is minted from the tracker
 * BEFORE any folder exists, so a failed mint leaves no orphan. The folder is
 * keyed to the tracker's issue key. The returned `ref` is the caller's to
 * persist in the tracker-map. No retry loop: a tracker key is unique by
 * construction (an existing folder for it surfaces as a normal EEXIST).
 */
export async function createIssueFirstTicket(
  cwd: string,
  options: NewTicketOptions,
  identity: IdentitySource,
  onMinted?: (minted: MintedIdentity) => void,
): Promise<NewTicketResult & { ref?: TrackerReference }> {
  const minted = await identity();
  assertSafeTrackerIdentity(minted.id);
  // Hook fires after the issue is minted but BEFORE any folder is written, so a
  // caller can persist a `pending` ref first: then a folder on disk always implies
  // a map entry, and a later sync reconciles instead of double-creating (narrows
  // the Decision-C partial-create window to "minted, nothing local written").
  onMinted?.(minted);
  const ticketsDirectory = ensureTicketsDirectory(cwd);
  const folderPath = nodePath.join(ticketsDirectory, `${minted.id}-${options.slug}`);
  try {
    mkdirSync(folderPath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`A ticket folder already exists for ${minted.id} (${folderPath}).`, {
        cause: error,
      });
    }
    throw error;
  }
  const { ticketPath } = writeTicketContents(folderPath, minted.id, options);
  return { id: minted.id, folderPath, ticketPath, ref: minted.ref };
}

function ensureTicketsDirectory(cwd: string): string {
  const ticketsDirectory = resolveTicketsDirectory(cwd);
  if (!existsSync(ticketsDirectory)) {
    mkdirSync(ticketsDirectory, { recursive: true });
  }
  return ticketsDirectory;
}

/**
 * Write ticket.md (+ spec.md for features) into an already-claimed folder.
 * Shared by the local (minter) and issue-first (tracker) creation paths so the
 * file shape stays identical regardless of where identity came from.
 */
function writeTicketContents(
  folderPath: string,
  id: string,
  options: NewTicketOptions,
): { ticketPath: string } {
  const ticketPath = nodePath.join(folderPath, 'ticket.md');
  writeFileSync(ticketPath, renderTicketMarkdown(id, options));

  // Epics and features own Product Plan context. Child features receive only
  // their contribution and Rules; their parent remains the intent owner.
  if (['feature', 'epic'].includes(options.type ?? 'task')) {
    const title = options.title ?? options.slug;
    const spec = options.parent
      ? renderChildSpecMarkdown(title, id, options)
      : renderSpecMarkdown(title);
    writeFileSync(nodePath.join(folderPath, 'spec.md'), spec);
  }

  return { ticketPath };
}

function renderSpecMarkdown(title: string): string {
  const template = readFileSync(nodePath.join(getTemplatesDirectory(), 'spec-template.md'), 'utf8');
  return template.replace('{title}', () => title);
}

function renderChildSpecMarkdown(title: string, id: string, options: NewTicketOptions): string {
  const template = readFileSync(
    nodePath.join(getTemplatesDirectory(), 'child-spec-template.md'),
    'utf8',
  );
  return template
    .replaceAll('{title}', () => title)
    .replaceAll('{ticket_id}', () => id)
    .replaceAll('{parent}', () => options.parent ?? '')
    .replaceAll('{milestone}', () => options.milestone ?? '')
    .replaceAll('{parent_job}', () => options.parentJob ?? '');
}

function mintAndClaim(
  ticketsDirectory: string,
  minter: IdMinter,
  slug: string,
): { id: string; folderPath: string } {
  const takenIds = idsAlreadyTaken(ticketsDirectory);
  const attempted: string[] = [];
  for (let attempt = 0; attempt < RETRY_BUDGET; attempt++) {
    const id = minter.mint();
    if (takenIds.has(id)) {
      attempted.push(id);
      continue;
    }
    const folderPath = nodePath.join(ticketsDirectory, `${id}-${slug}`);
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

// Extract the ID portion of every existing ticket folder. Folders use either
// `{id}` (legacy opaque) or `{id}-{slug}` — split on the first `-`. This is the
// loud-failure mechanism that keeps mint-time ID collisions from coexisting on
// disk regardless of slug suffix.
function idsAlreadyTaken(ticketsDirectory: string): Set<string> {
  const ids = new Set<string>();
  try {
    for (const entry of readdirSync(ticketsDirectory)) {
      if (NON_TICKET_ENTRIES.has(entry)) continue;
      const dashIndex = entry.indexOf('-');
      ids.add(dashIndex === -1 ? entry : entry.slice(0, dashIndex));
    }
  } catch {
    // tickets dir may not exist yet on fresh installs — caller creates it.
  }
  return ids;
}

/** The value if it carries non-whitespace content, else the placeholder. */
function filledOr(value: string | undefined, placeholder: string): string {
  return value !== undefined && value.trim() !== '' ? value : placeholder;
}

function renderTicketMarkdown(id: string, options: NewTicketOptions): string {
  const type = options.type ?? 'task';
  const now = (options.now ?? (() => new Date()))().toISOString();
  const title = options.title ?? options.slug;
  const productPlanFrontmatter = renderProductPlanFrontmatter(type);
  const childrenFrontmatter = type === 'epic' ? 'children: []\n' : '';
  const parentFrontmatter = renderParentFrontmatter(options);
  const childReferenceFrontmatter = renderChildReferenceFrontmatter(options);

  const goal = filledOr(options.goal, '{One sentence: what are we trying to achieve?}');
  const motivation = renderMotivation(type, options.why);

  return `---
id: ${id}
slug: ${options.slug}
type: ${type}
phase: intake
status: in_progress
${productPlanFrontmatter}${childrenFrontmatter}${parentFrontmatter}${childReferenceFrontmatter}created: ${now}
last_modified: ${now}
---

# ${title}

**Goal:** ${goal}

${motivation}

## Work Log

- ${now} Started: Created ticket ${id}
`;
}

function ownsProductPlan(type: TicketType): boolean {
  return type === 'feature' || type === 'epic';
}

function renderProductPlanFrontmatter(type: TicketType): string {
  return ownsProductPlan(type)
    ? `scope:
out_of_scope:
done_when:
product_plan_contract: v1
`
    : '';
}

function renderParentFrontmatter(options: NewTicketOptions): string {
  return options.parent ? `parent: ${options.parent}\n` : '';
}

function renderChildReferenceFrontmatter(options: NewTicketOptions): string {
  return options.parent
    ? `parent_job: ${options.parentJob ?? ''}\nmilestone: ${options.milestone ?? ''}\n`
    : '';
}

function renderMotivation(type: TicketType, why: string | undefined): string {
  return ownsProductPlan(type)
    ? '**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.'
    : `**Why:** ${filledOr(why, '{One sentence: why does this matter?}')}`;
}
