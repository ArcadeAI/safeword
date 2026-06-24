/**
 * pyproject.toml reader for the architecture pack (ticket HWSEPV). pyproject.toml is
 * TOML, so the table reads reuse the shared `toml.ts` machinery; this module adds only
 * the Python-specific shapes: PEP 621 `[project] name` / `dependencies` (an array of
 * PEP 508 specifier strings, reduced to the leading distribution name) and the
 * `[tool.uv.workspace] members` array. Out of scope: Poetry `[tool.poetry]` tables,
 * `optional-dependencies` (a table of arrays), and `requirements.txt`.
 */

import { readTomlTableArray, readTomlTableString } from './toml.js';

/** The PEP 621 `[project] name`, or `undefined`. */
export function readPyprojectName(content: string): string | undefined {
  return readTomlTableString(content, 'project', 'name');
}

/** The `[tool.uv.workspace] members` path globs, or `undefined` when absent. */
export function readUvWorkspaceMembers(content: string): string[] | undefined {
  return readTomlTableArray(content, 'tool.uv.workspace', 'members');
}

/**
 * The distribution names of the PEP 621 `[project] dependencies` — each entry is a
 * PEP 508 specifier string (`"requests>=2.0"`, `"foo[extra]>=1; marker"`), reduced to its
 * leading name (`requests`, `foo`). Versions, extras, and markers are noise, not shape.
 */
export function readPyprojectDependencies(content: string): string[] {
  const specifiers = readTomlTableArray(content, 'project', 'dependencies') ?? [];
  return specifiers.map(specifier => distributionName(specifier)).filter(name => name.length > 0);
}

/** The leading PEP 508 distribution name of a requirement specifier. */
function distributionName(specifier: string): string {
  return /^[\w.-]+/.exec(specifier.trim())?.[0] ?? '';
}
