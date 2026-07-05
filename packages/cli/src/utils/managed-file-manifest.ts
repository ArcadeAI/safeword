/**
 * Provenance manifest for managed files (ticket A4HG61, #849).
 *
 * `.safeword/managed-files.json` records the sha256 of every managed file
 * safeword actually wrote, so upgrade can distinguish "still exactly what
 * safeword wrote" (refreshable) from "customer-edited" (never touched).
 * Committed on purpose — provenance travels with the repo, so clones aren't
 * permanently pre-manifest (spec DD3). Keys are on-disk relative paths as
 * written (post-namespace-translation); serialization sorts keys and ends
 * with a newline to keep diffs small and merges tame.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

export const MANAGED_FILE_MANIFEST_PATH = '.safeword/managed-files.json';

/** Codepoint order — deterministic across machines, unlike localeCompare. */
function comparePaths(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

const MANIFEST_VERSION = 1;

/**
 * Absent and corrupt are distinct on purpose: absent enables byte-identity
 * adoption, while corrupt fails safe — refresh nothing, record nothing, warn
 * (spec DD8) — so a truncated manifest can never be "re-adopted" into fresh
 * records that erase real provenance.
 */
export type ManifestReadResult =
  { kind: 'absent' } | { kind: 'corrupt' } | { kind: 'ok'; files: Record<string, string> };

/** sha256 hex over the exact string content safeword writes. */
export function hashManagedFileContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function readManagedFileManifest(cwd: string): ManifestReadResult {
  const manifestPath = nodePath.join(cwd, MANAGED_FILE_MANIFEST_PATH);
  if (!existsSync(manifestPath)) return { kind: 'absent' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return { kind: 'corrupt' };
  }
  return parseManifestShape(parsed);
}

function parseManifestShape(parsed: unknown): ManifestReadResult {
  // An unknown version means the files map's semantics can't be trusted —
  // fail safe (refresh nothing, warn) rather than mis-adopt a future format.
  if ((parsed as { version?: unknown })?.version !== MANIFEST_VERSION) return { kind: 'corrupt' };

  const files = (parsed as { files?: unknown })?.files;
  if (files === null || typeof files !== 'object' || Array.isArray(files)) {
    return { kind: 'corrupt' };
  }
  const entries: Record<string, string> = {};
  for (const [path, hash] of Object.entries(files)) {
    if (typeof hash !== 'string') return { kind: 'corrupt' };
    entries[path] = hash;
  }
  return { kind: 'ok', files: entries };
}

export function serializeManagedFileManifest(files: Record<string, string>): string {
  // Codepoint comparison, NOT localeCompare: the manifest is committed, so
  // key order must be identical on every contributor's machine regardless of
  // ICU locale.
  const sorted = Object.fromEntries(
    Object.entries(files).toSorted(([a], [b]) => comparePaths(a, b)),
  );
  return `${JSON.stringify({ version: MANIFEST_VERSION, files: sorted }, undefined, 2)}\n`;
}

/**
 * Merge `entries` into the on-disk manifest, creating it if absent. Merge —
 * never truncate — so setup on a clone of an installed repo (managed files
 * exist, nothing written this run) preserves the committed provenance. A
 * corrupt manifest is left byte-for-byte alone (spec DD8).
 */
export function recordManagedFileProvenance(cwd: string, entries: Record<string, string>): void {
  if (Object.keys(entries).length === 0) return;
  const current = readManagedFileManifest(cwd);
  if (current.kind === 'corrupt') return;
  const files = current.kind === 'ok' ? { ...current.files, ...entries } : { ...entries };
  const manifestPath = nodePath.join(cwd, MANAGED_FILE_MANIFEST_PATH);
  mkdirSync(nodePath.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, serializeManagedFileManifest(files));
}
