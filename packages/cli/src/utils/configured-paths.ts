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

import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { readFileSafe } from './fs.js';

/** Logical keys safeword knows how to override via `paths.*`. */
export type ConfiguredPathKey = 'personas' | 'glossary' | 'architecture';

interface SafewordConfigShape {
  paths?: Partial<Record<ConfiguredPathKey | 'projectRoot', unknown>>;
}

const CONFIG_SUBPATH = ['.safeword', 'config.json'];

/** Default namespace root for fresh contexts (epic AQJ95G). */
export const NAMESPACE_ROOT_DEFAULT = '.project';

/** Legacy namespace root, honored where it already exists (pre-AQJ95G installs). */
export const NAMESPACE_ROOT_LEGACY = '.safeword-project';

/**
 * Read the override path for `key` from `.safeword/config.json`, if any.
 * Returns the raw override string (unresolved) or `undefined` when unset,
 * empty, non-string, or the config file is missing/unparseable.
 *
 * Exported for callers that need to know "is this overridden?" without
 * resolving the path (e.g., reconcile's `configKey` gate, `safeword check`
 * advisory messaging).
 */
export function readConfiguredPath(
  cwd: string,
  key: ConfiguredPathKey | 'projectRoot',
): string | undefined {
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
 * Resolve the absolute namespace root — the directory holding safeword's
 * project knowledge (tickets, learnings, personas, glossary, architecture).
 *
 * Precedence (epic AQJ95G): explicit config `paths.projectRoot` →
 * `.project/` (the default, shared with arcade) → legacy `.safeword-project/`
 * where one already exists. A project with neither directory resolves to
 * `.project/` so fresh contexts land on the current convention.
 */
export function resolveNamespaceRoot(cwd: string): string {
  const configured = readConfiguredPath(cwd, 'projectRoot');
  if (configured !== undefined) {
    return nodePath.isAbsolute(configured) ? configured : nodePath.join(cwd, configured);
  }

  const defaultRoot = nodePath.join(cwd, NAMESPACE_ROOT_DEFAULT);
  if (existsSync(defaultRoot)) return defaultRoot;

  const legacyRoot = nodePath.join(cwd, NAMESPACE_ROOT_LEGACY);
  if (existsSync(legacyRoot)) return legacyRoot;

  return defaultRoot;
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
  const override = readConfiguredPath(cwd, key);
  if (override === undefined) {
    return nodePath.join(cwd, defaultPath);
  }
  if (nodePath.isAbsolute(override)) {
    return override;
  }
  return nodePath.join(cwd, override);
}
