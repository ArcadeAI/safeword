/**
 * Lists a project's architecture records (ticket K4BWTQ).
 *
 * The resolved `paths.architecture` location may be a single markdown file
 * (the architecture record itself) or a directory of ADRs — each top-level
 * `.md` file except README.md, accept-any naming, no recursion. See the
 * M6D315 replan for why this reuses `paths.architecture` instead of a
 * separate ADR-location field.
 */

export type ArchitectureLocationKind = 'file' | 'directory' | 'absent';

export interface ArchitectureRecords {
  kind: ArchitectureLocationKind;
  /** Absolute paths of the record files; empty when none exist. */
  records: string[];
}

export function listArchitectureRecords(_resolvedPath: string): ArchitectureRecords {
  throw new Error('not implemented');
}
