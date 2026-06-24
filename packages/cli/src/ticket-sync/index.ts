/**
 * Ticket sync — generates capability-discovery indexes over the ticket corpus:
 * `<namespace-root>/tickets/INDEX.md` (active tickets, grouped by epic) and
 * `INDEX-completed.md` (the `completed/` archive). Mirrors `learning-sync`
 * (plain markdown + grep, no skill-description char cap) so "is there already
 * a ticket for X?" is one grep instead of a hundreds-of-folders hunt.
 *
 * Fired manually via `safeword sync-tickets`, as a `safeword check` step, and
 * after `ticket new`.
 *
 * Ticket 1GGD28.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveTicketsDirectory } from '../utils/configured-paths.js';
import { formatTicketReference } from '../utils/ticket-reference.js';
import { deriveBlocks, parseTicketIdList } from '../utils/ticket-relations.js';

/** Placeholder label for callers that read a directory without a project cwd. */
export const TICKETS_RELATIVE_PATH = '<namespace-root>/tickets';
export const INDEX_FILENAME = 'INDEX.md';
export const COMPLETED_INDEX_FILENAME = 'INDEX-completed.md';
export const COMPLETED_DIRNAME = 'completed';

const NO_EPIC_GROUP = '(no epic)';
const SKIP_DIRECTORIES = new Set([COMPLETED_DIRNAME, 'tmp']);

export interface TicketEntry {
  id: string;
  folder: string; // folder name, e.g. 1GGD28-ticket-discovery-index
  relativePath: string; // e.g. <namespace-root>/tickets/1GGD28-ticket-discovery-index
  title: string;
  status: string;
  epic: string | undefined; // undefined → grouped under "(no epic)"
  goal: string | undefined; // the **Goal:** one-liner, when present
  dependsOn: string[]; // ticket ids this one depends on (directed edge); [] when none
  blockedOn: string[]; // ticket ids this one is hard-blocked on (gates phase advance); [] when none
  blockedOnOverride: string | undefined; // reason recorded to advance past a non-done blocker; undefined when none
}

export interface TicketSyncResult {
  wrote: boolean;
  active: TicketEntry[];
  completed: TicketEntry[];
  skipped: { folder: string; reason: string }[];
  indexPath: string;
  completedIndexPath: string;
}

/** Strip a single layer of matching surrounding quotes. */
function stripQuotes(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"')))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

/** Parse the leading `--- … ---` frontmatter block into a key→value map. */
function parseFrontmatter(content: string): { fields: Map<string, string>; bodyStart: number } {
  const lines = content.split('\n');
  const fields = new Map<string, string>();
  if (lines[0]?.trim() !== '---') return { fields, bodyStart: 0 };

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '---') return { fields, bodyStart: index + 1 };
    const match = /^([a-z_][\w-]*):(.*)$/i.exec(line);
    if (match?.[1] !== undefined) fields.set(match[1], stripQuotes((match[2] ?? '').trim()));
  }
  return { fields, bodyStart: 0 };
}

/** First `# H1` heading text in the body, if any. */
function firstHeading(bodyLines: string[]): string | undefined {
  for (const line of bodyLines) {
    if (line.startsWith('# ')) return line.slice(2).trim();
  }
  return undefined;
}

/** The `**Goal:**` one-liner from the body, label stripped, if present. */
function goalLine(bodyLines: string[]): string | undefined {
  for (const line of bodyLines) {
    const match = /^\*\*Goal:\*\*(.*)$/.exec(line.trim());
    if (match?.[1] !== undefined) {
      const goal = match[1].trim();
      if (goal.length > 0) return goal;
    }
  }
  return undefined;
}

/**
 * Parse a single ticket.md. Returns the entry (minus relativePath) when it has
 * an `id:`, or a skip reason. Title resolves frontmatter `title` → first H1 →
 * frontmatter `slug` → folder name.
 */
function parseTicket(
  filePath: string,
  folder: string,
): { ok: true; entry: Omit<TicketEntry, 'relativePath'> } | { ok: false; reason: string } {
  const content = readFileSync(filePath, 'utf8');
  const { fields, bodyStart } = parseFrontmatter(content);

  const id = fields.get('id');
  if (id === undefined || id.length === 0) {
    return { ok: false, reason: 'missing id: in frontmatter' };
  }

  const bodyLines = content.split('\n').slice(bodyStart);
  const title = fields.get('title') ?? firstHeading(bodyLines) ?? fields.get('slug') ?? folder;
  const status = fields.get('status') ?? '—';
  const epic = fields.get('epic');

  return {
    ok: true,
    entry: {
      id,
      folder,
      title,
      status,
      epic,
      goal: goalLine(bodyLines),
      dependsOn: parseTicketIdList(fields.get('depends_on')),
      blockedOn: parseTicketIdList(fields.get('blocked_on')),
      blockedOnOverride: fields.get('blocked_on_override'),
    },
  };
}

/** Parse every ticket folder directly under `directory`, returning entries +
 * skip reasons. Folders without a ticket.md are silently ignored (not skipped).
 * `pathPrefix` is prepended to the folder for the entry's relativePath. */
function readTicketFolders(
  directory: string,
  pathPrefix: string,
): { entries: TicketEntry[]; skipped: { folder: string; reason: string }[] } {
  if (!existsSync(directory)) return { entries: [], skipped: [] };

  const entries: TicketEntry[] = [];
  const skipped: { folder: string; reason: string }[] = [];

  const folders = readdirSync(directory, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !SKIP_DIRECTORIES.has(dirent.name))
    .map(dirent => dirent.name)
    .toSorted((a, b) => a.localeCompare(b));

  for (const folder of folders) {
    const ticketPath = nodePath.join(directory, folder, 'ticket.md');
    if (!existsSync(ticketPath)) continue; // not a ticket folder — ignore
    const parsed = parseTicket(ticketPath, folder);
    if (parsed.ok) {
      entries.push({ ...parsed.entry, relativePath: `${pathPrefix}/${folder}` });
    } else {
      skipped.push({ folder, reason: parsed.reason });
    }
  }

  return { entries, skipped };
}

/**
 * Read the corpus into active (top-level) and completed (`completed/`) entries,
 * each sorted by id, plus any skipped folders. INDEX*.md are files, so the
 * directory filter excludes them from being parsed as tickets.
 */
export function readTickets(
  ticketsDirectory: string,
  relativeLabel: string = TICKETS_RELATIVE_PATH,
): {
  active: TicketEntry[];
  completed: TicketEntry[];
  skipped: { folder: string; reason: string }[];
} {
  const active = readTicketFolders(ticketsDirectory, relativeLabel);
  const completed = readTicketFolders(
    nodePath.join(ticketsDirectory, COMPLETED_DIRNAME),
    `${relativeLabel}/${COMPLETED_DIRNAME}`,
  );

  const byId = (a: TicketEntry, b: TicketEntry) => a.id.localeCompare(b.id);
  return {
    active: active.entries.toSorted(byId),
    completed: completed.entries.toSorted(byId),
    skipped: [...active.skipped, ...completed.skipped],
  };
}

/** Render a list of related ticket ids slug-first, falling back to the bare id
 * for targets outside this index (cross-variant or not-yet-created). */
function renderRelation(ids: string[], labelById: Map<string, string>): string {
  return ids
    .map(id => {
      const title = labelById.get(id);
      return title === undefined ? id : formatTicketReference(id, title);
    })
    .join(', ');
}

/** Render one entry as a block: header, optional goal, relation edges, path. */
function renderEntry(
  entry: TicketEntry,
  blocks: Map<string, string[]>,
  labelById: Map<string, string>,
): string[] {
  const epic = entry.epic ?? '—';
  const lines = [
    `- **${formatTicketReference(entry.id, entry.title)}** (${entry.status}, epic: ${epic})`,
  ];
  if (entry.goal !== undefined) lines.push(`  ${entry.goal}`);
  if (entry.dependsOn.length > 0) {
    lines.push(`  blocked by: ${renderRelation(entry.dependsOn, labelById)}`);
  }
  const blocking = blocks.get(entry.id) ?? [];
  if (blocking.length > 0) lines.push(`  blocks: ${renderRelation(blocking, labelById)}`);
  if (entry.blockedOnOverride !== undefined) lines.push(`  override: ${entry.blockedOnOverride}`);
  lines.push(`  → \`${entry.relativePath}\``);
  return lines;
}

/** Group entries by epic; "(no epic)" sorts last, every other group alphabetical. */
function groupByEpic(entries: TicketEntry[]): [string, TicketEntry[]][] {
  const groups = new Map<string, TicketEntry[]>();
  for (const entry of entries) {
    const key = entry.epic ?? NO_EPIC_GROUP;
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups].toSorted(([a], [b]) => {
    if (a === NO_EPIC_GROUP) return 1;
    if (b === NO_EPIC_GROUP) return -1;
    return a.localeCompare(b);
  });
}

/**
 * Render the full index for one variant. Deterministic: same entries → same
 * bytes. No size cap — agents Read or grep the file.
 */
export function buildIndexContent(
  entries: TicketEntry[],
  options: { variant: 'active' | 'completed' },
): string {
  const isActive = options.variant === 'active';
  const header = [
    isActive ? '# Project Tickets — Index' : '# Project Tickets — Completed Archive',
    '',
    '<!-- Auto-generated by `safeword sync-tickets`. Do not edit by hand. -->',
    isActive
      ? '<!-- Active tickets, grouped by epic. Completed tickets live in INDEX-completed.md. -->'
      : '<!-- Completed tickets (the completed/ archive), grouped by epic. -->',
    '',
  ];

  if (entries.length === 0) {
    return [...header, isActive ? 'No active tickets.' : 'No completed tickets.', ''].join('\n');
  }

  const blocks = deriveBlocks(entries);
  const labelById = new Map(entries.map(entry => [entry.id, entry.title]));

  const lines = [...header, `## Tickets (${entries.length})`, ''];
  for (const [epic, group] of groupByEpic(entries)) {
    lines.push(`### ${epic}`, '');
    for (const entry of group) lines.push(...renderEntry(entry, blocks, labelById));
    lines.push('');
  }
  return lines.join('\n');
}

/** Write `content` to `path` only when it differs; report whether it wrote. */
function writeIfChanged(path: string, content: string): boolean {
  const previous = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  if (previous === content) return false;
  writeFileSync(path, content);
  return true;
}

/**
 * Generate/update both ticket indexes from the corpus. No-op (creates nothing)
 * when the tickets directory is absent. The completed archive is written when
 * a `completed/` directory exists or completed entries are present.
 */
export function syncTickets(cwd: string): TicketSyncResult {
  const ticketsDirectory = resolveTicketsDirectory(cwd);
  const relativeLabel = nodePath.relative(cwd, ticketsDirectory) || TICKETS_RELATIVE_PATH;
  const indexPath = nodePath.join(ticketsDirectory, INDEX_FILENAME);
  const completedIndexPath = nodePath.join(ticketsDirectory, COMPLETED_INDEX_FILENAME);

  if (!existsSync(ticketsDirectory)) {
    return { wrote: false, active: [], completed: [], skipped: [], indexPath, completedIndexPath };
  }

  const { active, completed, skipped } = readTickets(ticketsDirectory, relativeLabel);

  const isWroteActive = writeIfChanged(indexPath, buildIndexContent(active, { variant: 'active' }));

  const completedDirectory = nodePath.join(ticketsDirectory, COMPLETED_DIRNAME);
  const isWroteCompleted =
    completed.length > 0 || existsSync(completedDirectory)
      ? writeIfChanged(completedIndexPath, buildIndexContent(completed, { variant: 'completed' }))
      : false;

  return {
    wrote: isWroteActive || isWroteCompleted,
    active,
    completed,
    skipped,
    indexPath,
    completedIndexPath,
  };
}
