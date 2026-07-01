/**
 * Dependency-free reader for the narrow TOML subset the language packs share (ticket
 * HWSEPV) — a table-scoped array value and a table-scoped string value. NOT a general
 * TOML parser: it is table-scoped (a same-named key under another table is ignored) and
 * comment-aware (a `]` inside a `#` comment does not close an array early), returning
 * `undefined`/`[]` for anything outside the shape. Generalized from the twice-reviewed
 * `cargo-manifest` reader so Cargo.toml and pyproject.toml share one implementation.
 */

/**
 * The quoted entries of `[<table>] <key> = [ … ]`, or `undefined` when the table or key
 * is absent. Reads both inline (`= ["a"]`) and multi-line forms; comments and trailing
 * commas are ignored.
 */
export function readTomlTableArray(
  content: string,
  table: string,
  key: string,
): string[] | undefined {
  const found = tableArrayBody(content.split(/\r?\n/), table, key);
  if (found === undefined) return undefined;

  const values = found.body
    .matchAll(/"([^"]*)"|'([^']*)'/g)
    .map(match => match[1] ?? match[2] ?? '')
    .filter(value => value.length > 0)
    .toArray();
  return values.length > 0 ? values : undefined;
}

/**
 * Whether `[<table>] <key>` holds a well-formed but EMPTY array (`[]`, possibly across
 * lines / with comments) — as opposed to a malformed value (`= "x"`, an unclosed `[`),
 * which `readTomlTableArray` also collapses to `undefined`. Lets a caller treat an
 * explicitly-empty member list as "declared no members" (absent, like package.json
 * `workspaces: []`) rather than present-but-unparseable.
 */
export function isTomlTableEmptyArray(content: string, table: string, key: string): boolean {
  const found = tableArrayBody(content.split(/\r?\n/), table, key);
  return found !== undefined && found.closed && found.body.replaceAll(/[\s,]/g, '') === '';
}

/**
 * Whether `content` declares a `[<table>]` (or `[[<table>]]`) header. Comment-aware
 * (a header inside a `#` comment does not count) and table-scoped (exact name). Lets a
 * caller tell "the table is absent" from "the table is present but its key is
 * unparseable" — `readTomlTableArray` returns `undefined` for both, so this distinguishes
 * a single crate (no `[workspace]`) from a workspace whose `members` could not be read.
 */
export function hasTomlTable(content: string, table: string): boolean {
  return content.split(/\r?\n/).some(line => tableHeader(stripTomlComment(line).trim()) === table);
}

/**
 * Yield the meaningful lines (comment-stripped, trimmed, non-empty) that fall inside
 * `[<table>]`, in document order — the shared table-scoped traversal behind the key/value
 * readers below. Table membership is tracked via the `[header]` lines a line follows.
 */
function* linesInTable(content: string, table: string): Generator<string> {
  let inTable = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (line === '') continue;
    const header = tableHeader(line);
    if (header !== undefined) {
      inTable = header === table;
      continue;
    }
    if (inTable) yield line;
  }
}

/**
 * Whether `[<table>]` declares `<key> = …` (any value, parseable or not). Comment-aware,
 * table-scoped. Lets a caller tell "the key is absent" from "the key is present but its
 * value is unparseable" — `readTomlTableArray` returns `undefined` for both, so this
 * separates a workspace whose `members` list can't be read (surface it) from one with no
 * `members` key at all (a Cargo root-package workspace that auto-discovers members from
 * path deps — valid, out of scope, not a coverage gap).
 */
export function hasTomlTableKey(content: string, table: string, key: string): boolean {
  for (const line of linesInTable(content, table)) {
    if (tableValue(line, key) !== undefined) return true;
  }
  return false;
}

/** The string value of `[<table>] <key> = "…"`, or `undefined`. Table-scoped. */
export function readTomlTableString(
  content: string,
  table: string,
  key: string,
): string | undefined {
  for (const line of linesInTable(content, table)) {
    const value = tableValue(line, key);
    if (value?.startsWith('"')) {
      const end = value.indexOf('"', 1);
      if (end !== -1) return value.slice(1, end);
    }
  }
  return undefined;
}

/**
 * The comment-stripped text inside `[<table>] <key> = [ … ]` plus whether the array
 * actually closed (a `]` was seen), or `undefined` when no array value is found. The
 * `closed` flag distinguishes a well-formed array from one left unterminated at EOF —
 * callers that only need the entries (`readTomlTableArray`) can ignore it.
 */
function tableArrayBody(
  lines: string[],
  table: string,
  key: string,
): { body: string; closed: boolean } | undefined {
  const opened = findTableArrayOpen(lines, table, key);
  if (opened === undefined) return undefined;

  let body = opened.initial;
  for (let index = opened.line; index < lines.length; index += 1) {
    if (index > opened.line) body += `\n${stripTomlComment(lines[index] ?? '')}`;
    const close = indexOfOutsideQuotes(body, ']');
    if (close !== -1) return { body: body.slice(0, close), closed: true };
  }
  return { body, closed: false };
}

/**
 * The text after the opening `[` of `[<table>] <key> = [`, with the line it sits on, or
 * `undefined` when the table, the key, or an array value is absent. Table-scoped and
 * comment-aware — the seek half of {@link tableArrayBody}.
 */
function findTableArrayOpen(
  lines: string[],
  table: string,
  key: string,
): { line: number; initial: string } | undefined {
  let inTable = false;
  for (const [index, rawLine] of lines.entries()) {
    const trimmed = stripTomlComment(rawLine).trim();
    const header = tableHeader(trimmed);
    if (header !== undefined) {
      inTable = header === table;
      continue;
    }
    if (!inTable) continue;
    const value = tableValue(trimmed, key);
    if (value?.startsWith('[') === true) return { line: index, initial: value.slice(1) };
  }
  return undefined;
}

/**
 * The index of the first `target` character that is NOT inside a quoted string, or -1.
 * The single quote-aware scanner behind both the array's closing `]` (so a `]` inside a
 * value — a Python extra `foo[extra]`, a char-class glob `crates/[ab]/*` — does not end
 * the array early) and the inline `#` comment cut (so a `#` inside a PEP 508 URL dep does
 * not truncate the value). Per-line: TOML basic strings do not span lines.
 */
function indexOfOutsideQuotes(text: string, target: string): number {
  let quote = '';
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (quote === '') {
      if (character === '"' || character === "'") quote = character;
      else if (character === target) return index;
    } else if (character === quote) {
      quote = '';
    }
    index += 1;
  }
  return -1;
}

/** The trimmed right-hand side of `<key> = <rhs>` on this line, or `undefined` if the key differs. */
function tableValue(line: string, key: string): string | undefined {
  const equals = line.indexOf('=');
  if (equals === -1 || line.slice(0, equals).trim() !== key) return undefined;
  return line.slice(equals + 1).trim();
}

/** The bare table name of a `[table]` / `[[table]]` header line, or `undefined`. */
function tableHeader(line: string): string | undefined {
  const match = /^\[\[?([^[\]]+)\]\]?\s*$/.exec(line);
  return match?.[1] === undefined ? undefined : match[1].trim();
}

/**
 * Drop an inline `# comment`, but only a `#` that is NOT inside a quoted string — a
 * PEP 508 URL dependency (`"pkg @ git+https://…#egg=pkg"`) legitimately carries a `#`
 * inside its value, and cutting there would break the quote and silently drop later
 * array entries.
 */
export function stripTomlComment(line: string): string {
  const hash = indexOfOutsideQuotes(line, '#');
  return hash === -1 ? line : line.slice(0, hash);
}
