/**
 * Resolves user-configurable read targets (personas, glossary, architecture).
 *
 * Reads `.safeword/config.json` for an optional `paths` object — each key
 * maps to a file path the user wants safeword to read instead of the
 * default `.safeword-project/<key>.md` location.
 *
 * Path resolution:
 * - Relative paths resolve against project root (the directory containing
 *   `.safeword/config.json`, which equals `cwd` in current invocations).
 * - Absolute paths are used verbatim.
 * - Empty-string or non-string values are treated as unset (defensive).
 *
 * See ticket K7N2QM for the design rationale, including why this is not a
 * cosmiconfig-style discovery layer and why N=3 doesn't warrant a
 * logical-filesystem abstraction.
 */

import nodePath from 'node:path';

import { readFileSafe } from './fs.js';

/** Logical keys safeword knows how to override via `paths.*`. */
export type ConfiguredPathKey = 'personas' | 'glossary' | 'architecture';

interface SafewordConfigShape {
  paths?: Partial<Record<ConfiguredPathKey, unknown>>;
}

const CONFIG_SUBPATH = ['.safeword', 'config.json'];

/**
 * Read the override path for `key` from `.safeword/config.json`, if any.
 * Returns the raw override string (unresolved) or `undefined` when unset,
 * empty, non-string, or the config file is missing/unparseable.
 */
function readOverride(cwd: string, key: ConfiguredPathKey): string | undefined {
  const configPath = nodePath.join(cwd, ...CONFIG_SUBPATH);
  const content = readFileSafe(configPath);
  if (content === undefined) return undefined;

  let parsed: SafewordConfigShape;
  try {
    parsed = JSON.parse(content) as SafewordConfigShape;
  } catch {
    return undefined;
  }

  const raw = parsed.paths?.[key];
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return raw;
}

/**
 * Resolve the absolute filesystem path for a configurable read target.
 *
 * @param cwd - Project root directory.
 * @param key - Logical key (`personas` | `glossary` | `architecture`).
 * @param defaultPath - Default location relative to `cwd`, used when no
 *   override is configured.
 */
export function resolveConfiguredPath(
  cwd: string,
  key: ConfiguredPathKey,
  defaultPath: string,
): string {
  const override = readOverride(cwd, key);
  if (override === undefined) {
    return nodePath.join(cwd, defaultPath);
  }
  if (nodePath.isAbsolute(override)) {
    return override;
  }
  return nodePath.join(cwd, override);
}
