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
  const body = tableArrayBody(content.split(/\r?\n/), table, key);
  if (body === undefined) return undefined;

  const values = body
    .matchAll(/"([^"]*)"|'([^']*)'/g)
    .map(match => match[1] ?? match[2] ?? '')
    .filter(value => value.length > 0)
    .toArray();
  return values.length > 0 ? values : undefined;
}

/** The string value of `[<table>] <key> = "…"`, or `undefined`. Table-scoped. */
export function readTomlTableString(
  content: string,
  table: string,
  key: string,
): string | undefined {
  let inTable = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (line === '') continue;

    const header = tableHeader(line);
    if (header !== undefined) {
      inTable = header === table;
      continue;
    }
    if (!inTable) continue;

    const value = tableValue(line, key);
    if (value?.startsWith('"')) {
      const end = value.indexOf('"', 1);
      if (end !== -1) return value.slice(1, end);
    }
  }
  return undefined;
}

/** The comment-stripped text inside `[<table>] <key> = [ … ]`, or `undefined`. */
function tableArrayBody(lines: string[], table: string, key: string): string | undefined {
  let inTable = false;
  let body: string | undefined;

  for (const rawLine of lines) {
    const line = stripTomlComment(rawLine);
    const trimmed = line.trim();

    if (body === undefined) {
      const header = tableHeader(trimmed);
      if (header !== undefined) {
        inTable = header === table;
        continue;
      }
      const value = inTable ? tableValue(trimmed, key) : undefined;
      if (!value?.startsWith('[')) continue;
      body = value.slice(1);
    } else {
      body += `\n${line}`;
    }

    const close = topLevelCloseBracket(body);
    if (close !== -1) return body.slice(0, close);
  }

  return body;
}

/**
 * The index of the array's closing `]` — the first `]` that is NOT inside a quoted
 * string, so a `]` within a value (a Python extra `foo[extra]`, a char-class glob
 * `crates/[ab]/*`) does not end the array early. Returns -1 if none on this text.
 */
function topLevelCloseBracket(text: string): number {
  let quote = '';
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (quote === '') {
      if (character === '"' || character === "'") quote = character;
      else if (character === ']') return index;
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

/** Drop an inline `# comment` (line-level; the subset has no `#` inside its values). */
export function stripTomlComment(line: string): string {
  const hash = line.indexOf('#');
  return hash === -1 ? line : line.slice(0, hash);
}
