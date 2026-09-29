import { createHash } from 'node:crypto';

import type { CapabilityRevision } from './capability-catalogue.js';
import type { ReviewPacket } from './contract.js';

export interface CapabilityFixture {
  readonly id: string;
  readonly verdict: 'approve' | 'request_changes';
  readonly required: readonly string[];
  readonly forbidden: readonly string[];
}

export interface CapabilityRun {
  readonly fixture_id: string;
  readonly run: number;
  readonly verdict: 'approve' | 'request_changes';
  readonly findings: readonly string[];
}

export interface CapabilityFloor {
  readonly runs_per_fixture: number;
  readonly minimum_fixture_passes: number;
  readonly minimum_total_percent: number;
}

export interface CapabilityManifest {
  readonly schema_version: 1;
  readonly owner: string;
  readonly floor: CapabilityFloor;
  readonly settings: Readonly<Record<string, string>>;
  readonly fixtures: readonly {
    readonly label: CapabilityFixture;
    readonly packet: ReviewPacket;
  }[];
}

export interface SealedCapabilityResults extends CapabilityRevision {
  readonly provider: string;
  readonly model: string;
  readonly evidence_date: string;
  readonly runs: readonly CapabilityRun[];
  readonly results_digest: string;
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sortedEntries(values: Readonly<Record<string, string>>): readonly [string, string][] {
  return Object.entries(values).toSorted(([left], [right]) => left.localeCompare(right));
}

export function capabilityRevision(
  manifest: CapabilityManifest,
  rubrics: Readonly<Record<string, string>>,
): CapabilityRevision {
  return {
    corpus_digest: digest({
      schema_version: manifest.schema_version,
      floor: manifest.floor,
      fixtures: manifest.fixtures,
    }),
    rubric_digest: digest(sortedEntries(rubrics)),
    settings_digest: digest(sortedEntries(manifest.settings)),
  };
}

function resultsDigest(evidence: Omit<SealedCapabilityResults, 'results_digest'>): string {
  return digest(evidence);
}

export function sealCapabilityResults(
  provider: string,
  model: string,
  revision: CapabilityRevision,
  runs: readonly CapabilityRun[],
  evidenceDate: string,
): SealedCapabilityResults {
  const evidence = { provider, model, ...revision, evidence_date: evidenceDate, runs };
  return { ...evidence, results_digest: resultsDigest(evidence) };
}

function currentEvidence(result: SealedCapabilityResults, revision: CapabilityRevision): boolean {
  const { results_digest, ...evidence } = result;
  return (
    result.corpus_digest === revision.corpus_digest &&
    result.rubric_digest === revision.rubric_digest &&
    result.settings_digest === revision.settings_digest &&
    result.provider !== '' &&
    result.model !== '' &&
    results_digest === resultsDigest(evidence)
  );
}

export function compareSealedCapabilityResults(
  manifest: CapabilityManifest,
  rubrics: Readonly<Record<string, string>>,
  author: SealedCapabilityResults,
  candidate: SealedCapabilityResults,
): 'not_weaker' | 'weaker' | 'unknown' {
  const revision = capabilityRevision(manifest, rubrics);
  if (!currentEvidence(author, revision) || !currentEvidence(candidate, revision)) return 'unknown';
  return compareCapabilityRuns(
    manifest.fixtures.map(fixture => fixture.label),
    author.runs,
    candidate.runs,
    manifest.floor,
  );
}

export function scoreCapabilityRun(fixture: CapabilityFixture, run: CapabilityRun): boolean {
  const findings = run.findings.map(finding => finding.toLowerCase().replaceAll(/\s+/gu, ' '));
  const contains = (phrase: string): boolean =>
    findings.some(finding => finding.includes(phrase.toLowerCase().replaceAll(/\s+/gu, ' ')));
  return (
    run.fixture_id === fixture.id &&
    run.verdict === fixture.verdict &&
    fixture.required.every(finding => contains(finding)) &&
    fixture.forbidden.every(finding => !contains(finding))
  );
}

function invalidCorpusShape(
  fixtures: readonly CapabilityFixture[],
  runs: readonly CapabilityRun[],
  floor: CapabilityFloor,
): boolean {
  return (
    fixtures.length === 0 ||
    new Set(fixtures.map(fixture => fixture.id)).size !== fixtures.length ||
    !Number.isSafeInteger(floor.runs_per_fixture) ||
    floor.runs_per_fixture < 1 ||
    !Number.isSafeInteger(floor.minimum_fixture_passes) ||
    floor.minimum_fixture_passes < 1 ||
    floor.minimum_fixture_passes > floor.runs_per_fixture ||
    floor.minimum_total_percent < 0 ||
    floor.minimum_total_percent > 100 ||
    runs.length !== fixtures.length * floor.runs_per_fixture
  );
}

function passCounts(
  fixtures: readonly CapabilityFixture[],
  runs: readonly CapabilityRun[],
  floor: CapabilityFloor,
): ReadonlyMap<string, number> | undefined {
  const byFixture = new Map(fixtures.map(fixture => [fixture.id, fixture]));
  const seen = new Set<string>();
  const passes = new Map(fixtures.map(fixture => [fixture.id, 0]));
  for (const run of runs) {
    const fixture = byFixture.get(run.fixture_id);
    const key = `${run.fixture_id}:${run.run}`;
    if (
      fixture === undefined ||
      !Number.isSafeInteger(run.run) ||
      run.run < 1 ||
      run.run > floor.runs_per_fixture ||
      seen.has(key)
    )
      return undefined;
    seen.add(key);
    if (scoreCapabilityRun(fixture, run)) {
      passes.set(fixture.id, (passes.get(fixture.id) ?? 0) + 1);
    }
  }
  return passes;
}

function qualifiedPassCounts(
  fixtures: readonly CapabilityFixture[],
  runs: readonly CapabilityRun[],
  floor: CapabilityFloor,
): ReadonlyMap<string, number> | undefined {
  if (invalidCorpusShape(fixtures, runs, floor)) return undefined;
  const passes = passCounts(fixtures, runs, floor);
  if (passes === undefined) return undefined;
  let totalPasses = 0;
  for (const count of passes.values()) {
    if (count < floor.minimum_fixture_passes) return undefined;
    totalPasses += count;
  }
  if (totalPasses * 100 < floor.minimum_total_percent * runs.length) return undefined;
  return passes;
}

export function compareCapabilityRuns(
  fixtures: readonly CapabilityFixture[],
  author: readonly CapabilityRun[],
  candidate: readonly CapabilityRun[],
  floor: CapabilityFloor,
): 'not_weaker' | 'weaker' | 'unknown' {
  const authorPasses = qualifiedPassCounts(fixtures, author, floor);
  const candidatePasses = qualifiedPassCounts(fixtures, candidate, floor);
  if (authorPasses === undefined || candidatePasses === undefined) return 'unknown';
  return [...authorPasses].every(([id, count]) => (candidatePasses.get(id) ?? 0) >= count)
    ? 'not_weaker'
    : 'weaker';
}
