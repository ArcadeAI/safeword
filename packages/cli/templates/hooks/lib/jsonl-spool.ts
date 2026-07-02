// Per-session JSONL spool I/O — the shared machinery under the self-report spool
// (lib/self-report.ts) and the retro draft spool (lib/retro-draft-spool.ts).
//
// Both persist sanitized, per-session records to `.safeword/<dir>/<session>.jsonl`
// and had their own copy of: count non-blank lines, read-and-skip-torn-lines,
// cap-aware append, and atomic (temp+rename) rewrite. That machinery is
// correctness-sensitive (torn-tolerance, fail-open, whole-or-nothing writes), so it
// lives here ONCE. Callers keep what genuinely differs — the subdir, the filename
// sanitizer, the record schema (parse/serialize), and the cap value — and pass a
// resolved file path in.
//
// Self-contained (node:* only) so the CLI's src/ and the customer-repo hooks can
// both run it, like the two spools it backs.

import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

/**
 * Yield the JSON-parsed value of each non-blank JSONL line in `text`, skipping any
 * blank or torn (unparseable) line — never throws. The single home for the
 * split / skip-blank / parse-or-skip skeleton shared by the spool reader here and
 * the transcript scanners (retro-trigger's counters, retro-extract's digest);
 * callers supply only their per-entry handling.
 */
export function* iterateJsonlEntries(text: string): Generator<unknown> {
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      continue; // skip a torn/malformed JSONL line
    }
    yield value;
  }
}

/** Count non-blank JSONL records in a spool file (0 when absent/unreadable). */
export function countJsonlRecords(filePath: string): number {
  try {
    return readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(line => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

/**
 * Read every JSONL line, JSON.parse it, and map it through `parse` — skipping any
 * blank, torn (unparseable), or rejected (`parse` → undefined) line. Fail-open: a
 * missing or unreadable file yields `[]`, never a throw, so a filing/read path never
 * crashes on a bad spool.
 */
export function readJsonlRecords<T>(
  filePath: string,
  parse: (value: unknown) => T | undefined,
): T[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const records: T[] = [];
  for (const value of iterateJsonlEntries(raw)) {
    try {
      const record = parse(value);
      if (record !== undefined) records.push(record);
    } catch {
      // a parse callback that rejects a malformed record is skipped, not fatal
    }
  }
  return records;
}

/**
 * Append pre-serialized JSONL lines, capped: once the file already holds `cap`
 * records, drop the overflow rather than growing unbounded (bounds a crash-looping
 * or runaway session). BEST-EFFORT — never throws, so a spool-write failure can't
 * break the host path that called it.
 */
export function appendJsonlRecords(filePath: string, lines: readonly string[], cap: number): void {
  try {
    const room = cap - countJsonlRecords(filePath);
    if (room <= 0) return;
    const toWrite = lines.slice(0, room);
    if (toWrite.length === 0) return;
    mkdirSync(nodePath.dirname(filePath), { recursive: true });
    appendFileSync(filePath, `${toWrite.join('\n')}\n`);
  } catch {
    // Self-observation must never break the host. Swallow.
  }
}

/**
 * Write `contents` to `file` atomically: write a pid-unique temp sibling, then
 * rename onto the target, so a concurrent reader sees the whole old or whole new
 * file — never a half-written one. Creates the parent dir. Throws on I/O error;
 * callers that must stay fail-open wrap it in their own try/catch.
 */
export function atomicWriteFile(file: string, contents: string): void {
  const temporary = `${file}.${process.pid}.tmp`;
  mkdirSync(nodePath.dirname(file), { recursive: true });
  writeFileSync(temporary, contents);
  renameSync(temporary, file);
}
