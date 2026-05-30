/**
 * Scenario-lineage coverage (ticket XT1FFM) — RED stub.
 *
 * Real bodies land in the GREEN commit. Throwing keeps every scenario test
 * failing for the right reason (no accidental green from empty returns).
 */

export interface CoverageReport {
  uncovered: string[];
  stale: string[];
  orphan: string[];
}

export function parseAcReferenceFromTitle(title: string): string | null {
  throw new Error(`not implemented: parseAcReferenceFromTitle(${title})`);
}

export function parseAcIdsByJtbd(specContent: string): Map<string, string[]> {
  throw new Error(`not implemented: parseAcIdsByJtbd(${specContent.length} chars)`);
}

export function buildCoverageReport(
  specContent: string,
  testDefinitionsContent?: string,
): CoverageReport {
  throw new Error(
    `not implemented: buildCoverageReport(${specContent.length}, ${testDefinitionsContent?.length ?? 'undefined'})`,
  );
}
