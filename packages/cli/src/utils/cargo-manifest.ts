/**
 * Cargo.toml reader for the architecture pack (ticket YKFA5X). The `[workspace] members`
 * array and `[package] name` are read via the shared `toml.ts` table readers; this module
 * adds only the Cargo-specific dependency-key collection — the flat
 * `[dependencies]`/`[dev-dependencies]`/`[build-dependencies]` keys plus `[<table>.<name>]`
 * sub-tables. Out of scope and intentionally not handled: `[workspace.dependencies]`
 * inheritance, target-specific deps, and multi-line inline-table dependency values.
 */

import { readTomlTableArray, readTomlTableString, stripTomlComment } from './toml.js';

/** Tables whose keys (or `[<table>.<name>]` sub-tables) are crate dependency names. */
const DEPENDENCY_TABLES = ['dependencies', 'dev-dependencies', 'build-dependencies'] as const;

/** The `[workspace] members` path globs, or `undefined` when absent/unparseable. */
export function readCargoWorkspaceMembers(content: string): string[] | undefined {
  return readTomlTableArray(content, 'workspace', 'members');
}

/** The `[package] name`, or `undefined` when there is no `[package]` table with a name. */
export function readCargoPackageName(content: string): string | undefined {
  return readTomlTableString(content, 'package', 'name');
}

/** The dependency names (keys) across the flat dependency tables and their sub-tables. */
export function readCargoDependencyNames(content: string): string[] {
  const names = new Set<string>();
  let currentTable = '';

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (line === '') continue;

    const header = /^\[\[?([^\]]+)\]\]?$/.exec(line);
    if (header?.[1] !== undefined) {
      currentTable = header[1].trim();
      const subTableDependency = dependencySubTableName(currentTable);
      if (subTableDependency !== undefined) names.add(subTableDependency);
      continue;
    }

    if ((DEPENDENCY_TABLES as readonly string[]).includes(currentTable)) {
      const key = leadingKey(line);
      if (key !== undefined) names.add(key);
    }
  }

  return [...names];
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

function unquote(value: string): string {
  return value.replaceAll(/^["']|["']$/g, '');
}
