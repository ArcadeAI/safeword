/**
 * Lists a project's architecture records (ticket K4BWTQ).
 *
 * The resolved `paths.architecture` location may be a single markdown file
 * (the architecture record itself) or a directory of ADRs — each top-level
 * `.md` file except README.md, accept-any naming, no recursion. See the
 * M6D315 replan for why this reuses `paths.architecture` instead of a
 * separate ADR-location field.
 */

import { readdirSync, statSync } from 'node:fs';
import nodePath from 'node:path';

type ArchitectureLocationKind = 'file' | 'directory' | 'absent';

export interface ArchitectureRecords {
  kind: ArchitectureLocationKind;
  /** Absolute paths of the record files; empty when none exist. */
  records: string[];
}

export function listArchitectureRecords(resolvedPath: string): ArchitectureRecords {
  // try/catch in addition to throwIfNoEntry: statSync still throws ENOTDIR
  // when a path *component* is a file (nodejs/node#56993) — reachable here
  // via a misconfigured paths.architecture; treat it as absent, not a crash.
  let stats;
  try {
    stats = statSync(resolvedPath, { throwIfNoEntry: false });
  } catch {
    return { kind: 'absent', records: [] };
  }
  if (stats?.isFile()) {
    return { kind: 'file', records: [resolvedPath] };
  }
  if (stats?.isDirectory()) {
    const records = readdirSync(resolvedPath, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
      .map(entry => nodePath.join(resolvedPath, entry.name));
    return { kind: 'directory', records };
  }
  return { kind: 'absent', records: [] };
}
