/**
 * Dependency-free parser for the `Cargo.toml` subset the architecture pack needs
 * (ticket YKFA5X): the `[workspace] members` array, the `[package] name`, and the
 * dependency-table keys. This is NOT a general TOML parser — it reads only these
 * shapes and returns empty/undefined for anything outside them, consistent with the
 * go.mod / pnpm hand-parses (incomplete, never silently wrong). Out of scope and
 * intentionally not handled: `[workspace.dependencies]` inheritance, target-specific
 * deps, and multi-line inline-table dependency values.
 */

/** Tables whose keys (or `[table.<name>]` sub-tables) are crate dependency names. */
const DEPENDENCY_TABLES = ['dependencies', 'dev-dependencies', 'build-dependencies'] as const;

/**
 * The `[workspace] members = [..]` path globs, or `undefined` when the file has no
 * `[workspace]` table or no parseable members array. The array body is read up to the
 * first `]`, so both inline (`members = ["a"]`) and multi-line forms work; quoted
 * entries are collected, comments and trailing commas are ignored.
 */
export function readCargoWorkspaceMembers(content: string): string[] | undefined {
  const body = workspaceMembersArrayBody(content.split(/\r?\n/));
  if (body === undefined) return undefined;

  const globs = body
    .matchAll(/"([^"]*)"|'([^']*)'/g)
    .map(match => match[1] ?? match[2] ?? '')
    .filter(glob => glob.length > 0)
    .toArray();
  return globs.length > 0 ? globs : undefined;
}

/**
 * The comment-stripped text inside the `[workspace]` table's `members = [ … ]` array,
 * or `undefined` when there is no such array. Table-scoped (a `members` key under any
 * other table is ignored) and comment-aware (a `]` inside a `#` comment does not close
 * the array early) — both via the same line scan, so neither silently mis-reads. The one
 * remaining limit: a member glob whose string literally contains `]` (a char-class glob
 * like `"crates/[ab]/*"`, which Cargo member paths never use) ends the array early.
 */
function workspaceMembersArrayBody(lines: string[]): string | undefined {
  let inWorkspace = false;
  let body: string | undefined;

  for (const rawLine of lines) {
    const line = stripComment(rawLine);
    const trimmed = line.trim();

    if (body === undefined) {
      const header = /^\[\[?([^[\]]+)\]\]?\s*$/.exec(trimmed);
      if (header?.[1] !== undefined) {
        inWorkspace = header[1].trim() === 'workspace';
        continue;
      }
      const opening = inWorkspace ? /members\s*=\s*\[(.*)$/.exec(trimmed) : undefined;
      if (opening?.[1] === undefined) continue;
      body = opening[1];
    } else {
      body += `\n${line}`;
    }

    const close = body.indexOf(']');
    if (close !== -1) return body.slice(0, close);
  }

  return body;
}

/** The `[package] name`, or `undefined` when there is no `[package]` table with a name. */
export function readCargoPackageName(content: string): string | undefined {
  return scanTables(content).packageName;
}

/** The dependency names (keys) across the flat dependency tables and their sub-tables. */
export function readCargoDependencyNames(content: string): string[] {
  return [...scanTables(content).dependencyNames];
}

interface TableScan {
  packageName: string | undefined;
  dependencyNames: Set<string>;
}

/**
 * One line-oriented pass tracking the current table: collects the `[package] name`
 * and every dependency key (flat `name = …` lines under a dependency table, plus the
 * `<name>` of a `[dependencies.<name>]` sub-table).
 */
function scanTables(content: string): TableScan {
  const scan: TableScan = { packageName: undefined, dependencyNames: new Set<string>() };
  let currentTable = '';

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (line === '') continue;

    const header = /^\[\[?([^\]]+)\]\]?$/.exec(line);
    if (header?.[1] !== undefined) {
      currentTable = header[1].trim();
      const subTableDependency = dependencySubTableName(currentTable);
      if (subTableDependency !== undefined) scan.dependencyNames.add(subTableDependency);
      continue;
    }

    collectKey(line, currentTable, scan);
  }

  return scan;
}

/** Record a `key = …` line as the package name or a dependency, per the current table. */
function collectKey(line: string, currentTable: string, scan: TableScan): void {
  const key = leadingKey(line);
  if (key === undefined) return;
  if (currentTable === 'package' && key === 'name') {
    scan.packageName ??= stringValue(line);
  } else if ((DEPENDENCY_TABLES as readonly string[]).includes(currentTable)) {
    scan.dependencyNames.add(key);
  }
}

/** The dependency name of a `[dependencies.<name>]`-style sub-table, if this is one. */
function dependencySubTableName(table: string): string | undefined {
  for (const dependencyTable of DEPENDENCY_TABLES) {
    if (!table.startsWith(`${dependencyTable}.`)) continue;
    const name = unquote(table.slice(dependencyTable.length + 1).trim());
    return name.length > 0 ? name : undefined;
  }
  return undefined;
}

/** The key on the left of `=` (quotes stripped), or undefined if the line is not `key = …`. */
function leadingKey(line: string): string | undefined {
  const match = /^("[^"]+"|'[^']+'|[\w-]+)\s*=/.exec(line);
  return match?.[1] === undefined ? undefined : unquote(match[1]);
}

/** The `"…"` string value to the right of `=`, or undefined. */
function stringValue(line: string): string | undefined {
  return /=\s*"([^"]*)"/.exec(line)?.[1];
}

/** Drop an inline `# comment` (line-level; the subset has no `#` inside its values). */
function stripComment(line: string): string {
  const hash = line.indexOf('#');
  return hash === -1 ? line : line.slice(0, hash);
}

function unquote(value: string): string {
  return value.replaceAll(/^["']|["']$/g, '');
}
