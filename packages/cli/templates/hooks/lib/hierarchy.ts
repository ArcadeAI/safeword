/**
 * Hierarchy Navigation Library (Ticket #025)
 *
 * Pure functions for walking ticket parent/child relationships.
 * Used by stop-quality.ts to navigate to the next ticket after completion.
 *
 * All functions use standard Node.js APIs (no Bun-specific code)
 * so they can be unit tested with vitest directly.
 */

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TicketFrontmatter {
  parent: string | null;
  children: string[];
  status: string | null;
  phase: string | null;
  type: string | null;
}

export type NextAction =
  | { type: 'navigate'; ticketId: string; ticketDirectory: string }
  | { type: 'cascade-done'; parentId: string; ticketDirectory: string }
  | { type: 'all-done' };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Ticket frontmatter fields that must carry content before scenarios are written. */
export const REQUIRED_INTAKE_FIELDS = ['scope', 'out_of_scope', 'done_when'] as const;

/**
 * True when a parsed frontmatter value carries no content: absent, blank, a YAML
 * null (`null`, `Null`, `NULL` or `~`), or a list whose items are all empty.
 */
export function isEmptyFrontmatterValue(value: string | string[] | undefined): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.every(item => isEmptyFrontmatterValue(item));
  const trimmed = value.trim();
  return trimmed === '' || trimmed === '~' || /^null$/i.test(trimmed);
}

/**
 * Minimal YAML frontmatter parser — no external dependencies.
 * Handles simple key: value pairs, block sequences (- item) and block scalars
 * (`|` / `>`, whose indented lines are joined with newlines, not folded).
 * All scalar values are returned as raw strings (failsafe mode) so
 * leading-zero IDs like `001` are preserved as '001', not integer 1.
 */
export function parseFrontmatter(yaml: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  let pending: PendingEntry | undefined;

  for (const line of yaml.split(/\r?\n/)) {
    if (pending && continuesPending(pending, line)) continue;
    // Blank and comment-only lines inside a list neither add an item nor end it
    if (pending?.kind === 'list' && isBlankOrComment(line)) continue;
    if (pending) flushPending(result, pending);
    pending = readPair(line, result);
  }

  if (pending) flushPending(result, pending);
  return result;
}

/** A key whose value continues on the following lines. */
interface PendingEntry {
  key: string;
  kind: 'list' | 'block';
  lines: string[];
}

function isBlankOrComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === '' || trimmed.startsWith('#');
}

/** Add `line` to the pending list or block scalar when it belongs there. */
function continuesPending(entry: PendingEntry, line: string): boolean {
  if (entry.kind === 'block') {
    const belongs = line.trim() === '' || line.startsWith(' ') || line.startsWith('\t');
    if (belongs) entry.lines.push(line.trim());
    return belongs;
  }
  const listMatch = /^[ \t]*-(?:[ \t]+(.*))?$/.exec(line);
  if (listMatch) entry.lines.push(parseScalar(listMatch[1] ?? ''));
  return listMatch !== null;
}

/**
 * Read a `key: value` line into `result`, or return the entry it starts when its
 * value continues on the following lines (a block sequence or block scalar).
 */
function readPair(
  line: string,
  result: Record<string, string | string[]>,
): PendingEntry | undefined {
  const pairMatch = /^(\w+):\s*(.*)$/.exec(line);
  if (!pairMatch?.[1]) return undefined;
  const value = parsePairValue(pairMatch[2] ?? '');
  if (value === 'list' || value === 'block') return { key: pairMatch[1], kind: value, lines: [] };
  result[pairMatch[1]] = value.content;
  return undefined;
}

function flushPending(result: Record<string, string | string[]>, entry: PendingEntry): void {
  result[entry.key] = entry.kind === 'list' ? entry.lines : entry.lines.join('\n').trim();
}

/**
 * Classify the text after `key:` — the start of a block scalar (`|` / `>`), the
 * start of a block sequence (nothing), a flow list (`[a, b]`), or a scalar.
 */
function parsePairValue(text: string): 'list' | 'block' | { content: string | string[] } {
  const raw = withoutComment(text.trim());
  // `|` or `>`, optionally with a chomping (+/-) and indentation (1-9) indicator in either order
  if (/^[|>](?:[+-]?[1-9]?|[1-9][+-])$/.test(raw)) return 'block';
  if (raw === '') return 'list';
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim();
    return { content: inner === '' ? [] : inner.split(',').map(item => stripQuotes(item.trim())) };
  }
  return { content: stripQuotes(raw) };
}

function parseScalar(text: string): string {
  return stripQuotes(withoutComment(text.trim()));
}

/**
 * Drop a YAML comment from a trimmed value, as a YAML parser would: a value that
 * is only a comment (`# TODO`) becomes empty, and ` # note` after a quoted
 * string, flow list or plain scalar is removed. A `#` inside quotes or attached
 * to text (`Fix#123`) stays. One deliberate difference from YAML: a value that
 * starts with `#` and text (`#563 cost gate`) is kept, so issue references
 * written as list items are not silently dropped.
 */
function withoutComment(value: string): string {
  if (/^#(\s|$)/.test(value)) return '';
  const quote = value[0];
  if (quote === "'" || quote === '"') {
    const close = value.indexOf(quote, 1);
    return close > 0 && /^\s*(#.*)?$/.test(value.slice(close + 1))
      ? value.slice(0, close + 1)
      : value;
  }
  const comment = /\s+#/.exec(value);
  return comment ? value.slice(0, comment.index) : value;
}

function stripQuotes(value: string): string {
  return value.replace(/^(['"])(.*)\1$/, '$2');
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Parse ticket.md frontmatter, coerce all IDs to strings.
 * Handles: quoted strings ('013'), unquoted numbers (001),
 * null parent, missing fields.
 */
export function readTicketFrontmatter(ticketDirectory: string): TicketFrontmatter {
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  const content = readFileSync(ticketPath, 'utf8');

  // Extract YAML frontmatter between --- markers
  const frontmatterMatch = content.match(/^---\n([\S\s]*?)\n---/);
  if (!frontmatterMatch) {
    return { parent: null, children: [], status: null, phase: null, type: null };
  }

  // parseFrontmatter returns all scalars as strings (failsafe-equivalent),
  // so '001' stays '001' and 'null' stays the string 'null'.
  const parsed = parseFrontmatter(frontmatterMatch[1] ?? '');

  const str = (key: string): string | undefined => {
    const v = parsed[key];
    return Array.isArray(v) ? undefined : v;
  };

  const isNull = (value: string | undefined): boolean =>
    value === undefined || value === 'null' || value === '';

  return {
    parent: isNull(str('parent')) ? null : str('parent')!,
    children: Array.isArray(parsed.children) ? parsed.children.map(String) : [],
    status: isNull(str('status')) ? null : str('status')!,
    phase: isNull(str('phase')) ? null : str('phase')!,
    type: isNull(str('type')) ? null : str('type')!,
  };
}

/**
 * Resolve a ticket ID to its directory path.
 * Scans ticketsDirectory for directories matching `{id}-*`.
 * Returns null if not found or ambiguous (multiple matches).
 */
export function resolveTicketDirectory(ticketId: string, ticketsDirectory: string): string | null {
  if (!existsSync(ticketsDirectory)) return null;

  const matches = readdirSync(ticketsDirectory).filter(directory =>
    directory.startsWith(`${ticketId}-`),
  );

  if (matches.length === 1) {
    return nodePath.join(ticketsDirectory, matches[0]!);
  }

  return null;
}

/**
 * Update a ticket's status, phase, and last_modified in its ticket.md.
 */
export function updateTicketStatus(
  ticketDirectory: string,
  newStatus: string,
  newPhase: string,
): void {
  const ticketPath = nodePath.join(ticketDirectory, 'ticket.md');
  let content = readFileSync(ticketPath, 'utf8');
  content = content.replace(/^status:\s*\S+/m, `status: ${newStatus}`);
  content = content.replace(/^phase:\s*\S+/m, `phase: ${newPhase}`);
  content = content.replace(/^last_modified:\s*.+/m, `last_modified: ${new Date().toISOString()}`);
  // Write-then-rename for atomicity: prevents partial writes on process kill
  const tmpPath = `${ticketPath}.tmp`;
  writeFileSync(tmpPath, content);
  renameSync(tmpPath, ticketPath);
}

/**
 * Walk the ticket hierarchy to determine what work comes next.
 *
 * - 'navigate': next undone sibling found, go work on it
 * - 'cascade-done': all siblings done, parent should be marked done
 * - 'all-done': no parent or tree exhausted, nothing left to do
 *
 * IMPORTANT: The current ticket must be marked done BEFORE calling this,
 * otherwise it will be found as an undone sibling and navigated back to.
 */
export function findNextWork(ticketDirectory: string, ticketsDirectory: string): NextAction {
  const ticket = readTicketFrontmatter(ticketDirectory);

  // No parent → standalone ticket, nothing to navigate to
  if (!ticket.parent) {
    return { type: 'all-done' };
  }

  // Find parent ticket directory
  const parentDirectory = resolveTicketDirectory(ticket.parent, ticketsDirectory);
  if (!parentDirectory) {
    return { type: 'all-done' };
  }

  const parent = readTicketFrontmatter(parentDirectory);
  const { children } = parent;

  // No children listed → broken/incomplete hierarchy
  if (children.length === 0) {
    return { type: 'all-done' };
  }

  // Find next undone sibling (in children array order)
  for (const childId of children) {
    const childDirectory = resolveTicketDirectory(childId, ticketsDirectory);
    if (!childDirectory) continue;

    const child = readTicketFrontmatter(childDirectory);
    if (child.status !== 'done' && child.status !== 'complete') {
      return { type: 'navigate', ticketId: childId, ticketDirectory: childDirectory };
    }
  }

  // All siblings done → cascade: mark parent done, recurse
  return { type: 'cascade-done', parentId: ticket.parent, ticketDirectory: parentDirectory };
}
