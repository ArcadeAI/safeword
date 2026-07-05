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
  const ticketsDirectory = resolveTicketsDirectory(cwd);
  if (!existsSync(ticketsDirectory)) {
    mkdirSync(ticketsDirectory, { recursive: true });
  }

  const { id, folderPath } = mintAndClaim(ticketsDirectory, minter, options.slug);
  const ticketPath = nodePath.join(folderPath, 'ticket.md');
  writeFileSync(ticketPath, renderTicketMarkdown(id, options));

  // Features carry a product-framing spec.md sibling (epic DZ2NM5/D2 + D4).
  // Tasks and patches don't pay the persona/JTBD tax.
  if ((options.type ?? 'task') === 'feature') {
    const title = options.title ?? options.slug;
    writeFileSync(nodePath.join(folderPath, 'spec.md'), renderSpecMarkdown(title));
  }

  return { id, folderPath, ticketPath };
}

function renderSpecMarkdown(title: string): string {
  const template = readFileSync(nodePath.join(getTemplatesDirectory(), 'spec-template.md'), 'utf8');
  return template.replace('{title}', () => title);
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

function renderTicketMarkdown(id: string, options: NewTicketOptions): string {
  const type = options.type ?? 'task';
  const now = (options.now ?? (() => new Date()))().toISOString();
  const title = options.title ?? options.slug;
  const featureReadinessFrontmatter =
    type === 'feature'
      ? `scope:
out_of_scope:
done_when:
`
      : '';
  // Epics are containers: they carry a `children:` list (bidirectional with each
  // child's `parent:`). Born empty; children link in as they're created. Epics
  // use the same inline **Goal:**/**Why:** body as tasks — matching the
  // index-visible epic precedent (Q4FX8Y) so `sync-tickets` picks up the goal.
  const childrenFrontmatter = type === 'epic' ? 'children: []\n' : '';

  const goal = options.goal ?? '{One sentence: what are we trying to achieve?}';

  // Features keep motivation in spec.md's ## Intent (single source of truth)
  // and point there; task/patch/epic have no spec.md, so they keep **Why:**.
  const motivation =
    type === 'feature'
      ? '**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.'
      : `**Why:** ${options.why ?? '{One sentence: why does this matter?}'}`;

  return `---
id: ${id}
slug: ${options.slug}
type: ${type}
phase: intake
status: in_progress
${featureReadinessFrontmatter}${childrenFrontmatter}created: ${now}
last_modified: ${now}
---

# ${title}

**Goal:** ${goal}

${motivation}

## Work Log

- ${now} Started: Created ticket ${id}
`;
}
