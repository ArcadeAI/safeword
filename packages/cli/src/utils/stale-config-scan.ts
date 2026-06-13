/**
 * Stale tooling-config scanner (ticket JYWZG1, epic AQJ95G follow-up).
 *
 * After `safeword upgrade --migrate-namespace` moves a repo from the legacy
 * `.safeword-project/` namespace to `.project/`, a customer's hand-authored
 * tooling config (eslint, prettier, tsconfig, CI, …) that referenced the old
 * path silently goes stale. This scanner NAMES those files so the migration
 * can warn — it never edits anything.
 *
 * Scope is deliberately narrow (ticket JYWZG1 / the /figure-it-out call):
 * - Only a curated set of *functional* tooling configs is read — never a
 *   blanket repo grep, because the moved `.project/` dir legitimately holds
 *   hundreds of documentary `.safeword-project` references (tickets, learnings).
 * - The match is path-boundary anchored (`.safeword-project/`) so unrelated
 *   tokens like `.safeword-projectile/` don't false-positive.
 * - In `.prettierignore`, lines inside safeword's own managed block are
 *   skipped — safeword writes BOTH roots there by design; a customer's stale
 *   line elsewhere in the file is still flagged.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

/** The legacy namespace path, anchored with a trailing slash (boundary match). */
const LEGACY_REFERENCE = '.safeword-project/';

/** Marker for safeword's managed `.prettierignore` block (mirrors schema.ts). */
const MANAGED_PRETTIER_MARKER = '# Safeword - managed prettier exclusions';

/** Workflows directory — the one nested config location safeword scans. */
const WORKFLOWS_SUBPATH = ['.github', 'workflows'];

/**
 * Curated root-level tooling-config files. Extend here as new config types
 * surface; `.github/workflows/*` is handled separately (nested).
 */
const CURATED_ROOT_CONFIGS: readonly string[] = [
  'eslint.config.ts',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.js',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  '.prettierignore',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  'tsconfig.json',
  'knip.json',
  'knip.ts',
  '.dependency-cruiser.cjs',
  '.dependency-cruiser.js',
  '.jscpd.json',
];

/** True when any line outside the managed prettier block references the legacy root. */
function prettierignoreHasCustomerReference(content: string): boolean {
  let insideManagedBlock = false;
  for (const line of content.split('\n')) {
    if (line.includes(MANAGED_PRETTIER_MARKER)) {
      insideManagedBlock = true;
      continue;
    }
    // The managed block is safeword-written and contiguous; a blank line ends it.
    if (insideManagedBlock && line.trim() === '') {
      insideManagedBlock = false;
      continue;
    }
    if (!insideManagedBlock && line.includes(LEGACY_REFERENCE)) return true;
  }
  return false;
}

function fileHasStaleReference(relativePath: string, content: string): boolean {
  if (nodePath.basename(relativePath) === '.prettierignore') {
    return prettierignoreHasCustomerReference(content);
  }
  return content.includes(LEGACY_REFERENCE);
}

/** Workflow files under `.github/workflows/`, repo-relative; [] when absent. */
function workflowConfigPaths(cwd: string): string[] {
  const directory = nodePath.join(cwd, ...WORKFLOWS_SUBPATH);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter(name => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map(name => `${WORKFLOWS_SUBPATH.join('/')}/${name}`);
}

/**
 * Return the repo-relative paths of curated tooling configs that still
 * reference the legacy `.safeword-project/` namespace. Empty when none —
 * including a clean repo, a managed-only `.prettierignore`, and documentary
 * references (those live under `.project/`, which is never in the curated set).
 */
export function scanStaleNamespaceConfigs(cwd: string): string[] {
  const candidates = [...CURATED_ROOT_CONFIGS, ...workflowConfigPaths(cwd)];
  const stale: string[] = [];
  for (const relativePath of candidates) {
    const fullPath = nodePath.join(cwd, relativePath);
    if (!existsSync(fullPath)) continue;
    let content: string;
    try {
      content = readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }
    if (fileHasStaleReference(relativePath, content)) stale.push(relativePath);
  }
  return stale;
}

export { LEGACY_REFERENCE };
