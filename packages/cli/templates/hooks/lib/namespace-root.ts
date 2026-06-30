// Safeword: namespace-root resolver (hook-side copy, ticket TAGWZ8).
//
// Resolves the directory holding safeword's project knowledge (tickets,
// learnings, personas, glossary, surfaces, architecture). Precedence (epic AQJ95G):
// explicit config `paths.projectRoot` in `.safeword/config.json` →
// `.project/` → legacy `.safeword-project/`; neither present → `.project/`.
//
// Deliberate duplicate of `resolveNamespaceRoot` in the CLI's
// `src/utils/configured-paths.ts` — hooks run standalone under bun in
// customer repos with no import path to the CLI. A differential test pins
// the two copies against shared fixtures (P58R22 pattern).

import { existsSync, readFileSync, statSync } from 'node:fs';
import nodePath from 'node:path';

export const NAMESPACE_ROOT_DEFAULT = '.project';
export const NAMESPACE_ROOT_LEGACY = '.safeword-project';

function readConfiguredProjectRoot(projectDirectory: string): string | undefined {
  const configPath = nodePath.join(projectDirectory, '.safeword', 'config.json');
  if (!existsSync(configPath)) return undefined;

  let parsed: { paths?: { projectRoot?: unknown } };
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf8')) as { paths?: { projectRoot?: unknown } };
  } catch {
    return undefined;
  }

  const raw = parsed.paths?.projectRoot;
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return raw;
}

/**
 * True when `filePath` lies under `<namespace root>/<subpath>` for either
 * the default or the legacy root. String-level check for hook filters that
 * receive edited-file paths in unknown (absolute or relative) form.
 */
export function isNamespacePath(filePath: string, subpath: string): boolean {
  return [NAMESPACE_ROOT_DEFAULT, NAMESPACE_ROOT_LEGACY].some(root => {
    const needle = `${root}/${subpath}`;
    // Boundary-anchored: the root must start the path or follow a separator,
    // so `foo.project/…` never matches the `.project/` root.
    return filePath.startsWith(needle) || filePath.includes(`/${needle}`);
  });
}

/** True when `path` exists and is a directory (a stray file is not a root). */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Absolute path of the resolved namespace root for `projectDirectory`. */
export function resolveNamespaceRoot(projectDirectory: string): string {
  const configured = readConfiguredProjectRoot(projectDirectory);
  if (configured !== undefined) {
    return nodePath.isAbsolute(configured)
      ? configured
      : nodePath.join(projectDirectory, configured);
  }

  const defaultRoot = nodePath.join(projectDirectory, NAMESPACE_ROOT_DEFAULT);
  if (isDirectory(defaultRoot)) return defaultRoot;

  const legacyRoot = nodePath.join(projectDirectory, NAMESPACE_ROOT_LEGACY);
  if (isDirectory(legacyRoot)) return legacyRoot;

  return defaultRoot;
}
