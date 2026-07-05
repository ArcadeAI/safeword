/**
 * Link a child ticket to its epic (ticket F9W3JP): append the child id to the
 * epic's `children:` list, idempotently and atomically. The child→epic
 * relationship's single source of truth is the child's `parent:` field; this
 * helper maintains the reverse index (`children:`) the navigation contract in
 * `hierarchy.ts` walks.
 *
 * Mirrors `hierarchy.ts`'s zero-dependency approach: inline frontmatter parsing
 * (no `yaml` package) and a write-then-rename atomic mutation, matching
 * `updateTicketStatus`.
 */

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { resolveTicketsDirectory } from './configured-paths.js';

export type LinkResult = { ok: true } | { ok: false; reason: string };

/**
 * Append `childId` to the `epicId` epic's `children:` list. Validates the epic
 * exists and is `type: epic`; appends only if absent (idempotent); writes
 * atomically. Returns a reason on failure so the caller can fail loud without
 * having created anything.
 */
export function linkChildToEpic(cwd: string, childId: string, epicId: string): LinkResult {
  const epicFolder = resolveTicketFolderById(cwd, epicId);
  if (epicFolder === undefined) {
    return { ok: false, reason: `--parent epic "${epicId}" not found` };
  }
  const epicPath = nodePath.join(epicFolder, 'ticket.md');
  const content = readTicketFileOrUndefined(epicPath);
  if (content === undefined) {
    return { ok: false, reason: `--parent "${epicId}" has no readable ticket.md` };
  }
  if (!isEpicTicket(content)) {
    return { ok: false, reason: `--parent "${epicId}" is not an epic` };
  }

  const children = parseChildrenList(content);
  if (children.includes(childId)) return { ok: true }; // idempotent — already linked

  atomicWrite(epicPath, replaceChildrenList(content, [...children, childId]));
  return { ok: true };
}

/**
 * Validate that `epicId` names an existing `type: epic` ticket, without
 * mutating anything — so `ticket new --parent` can fail before it creates a
 * child (AC3: a bad `--parent` creates nothing).
 */
export function validateEpicParent(cwd: string, epicId: string): LinkResult {
  const epicFolder = resolveTicketFolderById(cwd, epicId);
  if (epicFolder === undefined) {
    return { ok: false, reason: `--parent epic "${epicId}" not found` };
  }
  const content = readTicketFileOrUndefined(nodePath.join(epicFolder, 'ticket.md'));
  if (content === undefined) {
    // e.g. `--parent completed` resolves the archive dir, which has no ticket.md.
    return { ok: false, reason: `--parent "${epicId}" has no readable ticket.md` };
  }
  if (!isEpicTicket(content)) {
    return { ok: false, reason: `--parent "${epicId}" is not an epic` };
  }
  return { ok: true };
}

/** ticket.md contents, or undefined when missing/unreadable — never throws. */
function readTicketFileOrUndefined(ticketPath: string): string | undefined {
  try {
    return readFileSync(ticketPath, 'utf8');
  } catch {
    return undefined;
  }
}

/** Resolve a ticket folder by id (`{id}-{slug}` or legacy `{id}`), or undefined. */
export function resolveTicketFolderById(cwd: string, id: string): string | undefined {
  const ticketsDirectory = resolveTicketsDirectory(cwd);
  if (!existsSync(ticketsDirectory)) return undefined;
  for (const entry of readdirSync(ticketsDirectory)) {
    if (entry === id || entry.startsWith(`${id}-`)) {
      return nodePath.join(ticketsDirectory, entry);
    }
  }
  return undefined;
}

function isEpicTicket(content: string): boolean {
  return /^type:\s*epic\s*$/m.test(content);
}

/** Strip one layer of surrounding single/double quotes. */
function unquote(value: string): string {
  const trimmed = value.trim();
  const first = trimmed.at(0);
  if (trimmed.length >= 2 && (first === "'" || first === '"') && trimmed.at(-1) === first) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Index of the `children:` line, or -1. */
function childrenLineIndex(lines: string[]): number {
  return lines.findIndex(line => line.startsWith('children:'));
}

/** Block-sequence items (`  - id`) immediately following `children:`. */
function blockItemsAfter(lines: string[], start: number): string[] {
  const items: string[] = [];
  for (let index = start; index < lines.length; index += 1) {
    const match = /^[ \t]+-[ \t](.*)$/.exec(lines[index] ?? '');
    if (match?.[1] === undefined) break;
    const value = unquote(match[1]);
    if (value) items.push(value);
  }
  return items;
}

/**
 * The epic's current children ids. Tolerant of the formats the corpus carries:
 * flow array (`['A', 'B']` / `[]`), a legacy comma-separated scalar
 * (`'A, B'`), a block sequence (`children:` followed by `  - id` lines), or an
 * absent line. Preserves existing entries so an append never drops them.
 */
export function parseChildrenList(content: string): string[] {
  const lines = content.split('\n');
  const index = childrenLineIndex(lines);
  if (index === -1) return [];
  const raw = (lines[index] ?? '').slice('children:'.length).trim();
  if (raw === '') return blockItemsAfter(lines, index + 1);
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim();
    return inner === ''
      ? []
      : inner
          .split(',')
          .map(entry => unquote(entry))
          .filter(Boolean);
  }
  // Legacy scalar form: `children: 'A, B, C'`
  return unquote(raw)
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

/**
 * Rewrite (or insert) the `children:` value as a single-quoted flow array,
 * consuming any block-sequence item lines so a block-form epic is rewritten
 * whole rather than left with orphaned `- id` lines under a flow scalar.
 */
function replaceChildrenList(content: string, ids: string[]): string {
  const quoted = ids.map(id => `'${id}'`).join(', ');
  const rendered = `children: [${quoted}]`;
  const lines = content.split('\n');
  const index = childrenLineIndex(lines);
  if (index === -1) {
    // No children line yet — insert just before the closing frontmatter fence.
    return content.replace('\n---\n', () => `\n${rendered}\n---\n`);
  }
  let end = index + 1;
  while (end < lines.length && /^[ \t]+-[ \t]/.test(lines[end] ?? '')) end += 1;
  lines.splice(index, end - index, rendered);
  return lines.join('\n');
}

/** Write-then-rename so an interrupted run can't leave a half-written epic. */
function atomicWrite(filePath: string, content: string): void {
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, content);
  renameSync(temporaryPath, filePath);
}
