import { createHash } from 'node:crypto';

import type {
  CapabilityPairRecord,
  CapabilityRevision,
  PinnedCapabilityRevision,
} from './capability-catalogue.js';
import type { ReviewPacket } from './contract.js';
import type { ReviewerExecution } from './runtime.js';

export interface CapabilityFixture {
  readonly id: string;
  readonly verdict: 'approve' | 'request_changes';
  readonly required: readonly string[];
  readonly forbidden: readonly string[];
  /** All concept groups must occur in ONE blocking finding; each group lists alternatives.
   * This is a bounded lexical oracle, not a semantic judge of arbitrary reviewer prose.
   */
  readonly finding_groups?: readonly (readonly string[])[];
}

export interface CapabilityRun {
  readonly fixture_id: string;
  readonly run: number;
  readonly verdict: 'approve' | 'request_changes' | 'invalid';
  readonly failure?: 'review_failed' | 'model_unconfirmed' | 'identity_mismatch';
  readonly findings: readonly {
    readonly severity: 'info' | 'warning' | 'error';
    readonly message: string;
  }[];
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
  readonly rescored_from?: {
    readonly results_digest: string;
    readonly corpus_digest: string;
    readonly scored_at: string;
  };
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

/** One exact Claude/Codex model pair qualified against the shared corpus. */
export interface CapabilityModelPair {
  readonly anthropic_model: string;
  readonly openai_model: string;
}

/** The pair's model ids join the shared settings, so each pair keeps its own settings revision. */
export function capabilityManifestForPair(
  manifest: CapabilityManifest,
  pair: CapabilityModelPair,
): CapabilityManifest {
  return {
    ...manifest,
    settings: {
      ...manifest.settings,
      anthropic_model: pair.anthropic_model,
      openai_model: pair.openai_model,
    },
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

export interface CapabilityCollection {
  readonly manifest: CapabilityManifest;
  readonly rubrics: Readonly<Record<string, string>>;
  readonly provider: 'anthropic' | 'openai';
  readonly model: string;
  readonly evidenceDate: string;
  readonly review: (packet: ReviewPacket, model: string) => Promise<ReviewerExecution>;
}

function invalidCapabilityRun(
  fixtureId: string,
  run: number,
  failure: NonNullable<CapabilityRun['failure']>,
): CapabilityRun {
  return { fixture_id: fixtureId, run, verdict: 'invalid', findings: [], failure };
}

async function collectCapabilityRun(
  collection: CapabilityCollection,
  fixture: CapabilityManifest['fixtures'][number],
  run: number,
): Promise<CapabilityRun> {
  const { provider, model, review } = collection;
  try {
    const result = await review(fixture.packet, model);
    if (result.confirmedModel?.provider !== provider || result.confirmedModel.model !== model) {
      return invalidCapabilityRun(fixture.label.id, run, 'model_unconfirmed');
    }
    const expectedReviewer = provider === 'anthropic' ? 'claude' : 'codex';
    if (
      result.output.dispatch_id !== fixture.packet.dispatch_id ||
      result.output.reviewer_agent !== expectedReviewer
    ) {
      return invalidCapabilityRun(fixture.label.id, run, 'identity_mismatch');
    }
    return {
      fixture_id: fixture.label.id,
      run,
      verdict: result.output.verdict,
      findings: result.output.findings,
    };
  } catch {
    return invalidCapabilityRun(fixture.label.id, run, 'review_failed');
  }
}

export async function collectCapabilityResults(
  collection: CapabilityCollection,
): Promise<SealedCapabilityResults> {
  const { manifest, rubrics, provider, model, evidenceDate } = collection;
  const runs: CapabilityRun[] = [];
  for (const fixture of manifest.fixtures) {
    for (let run = 1; run <= manifest.floor.runs_per_fixture; run += 1) {
      runs.push(await collectCapabilityRun(collection, fixture, run));
    }
  }
  return sealCapabilityResults(
    provider,
    model,
    capabilityRevision(manifest, rubrics),
    runs,
    evidenceDate,
  );
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

/** Regrade unchanged observations; never represent them as newly collected model runs. */
export function rescoreCapabilityResults(
  previous: CapabilityManifest,
  current: CapabilityManifest,
  rubrics: Readonly<Record<string, string>>,
  original: SealedCapabilityResults,
  scoredAt: string,
): SealedCapabilityResults {
  const observationInputs = (manifest: CapabilityManifest) => ({
    schema_version: manifest.schema_version,
    floor: manifest.floor,
    settings: manifest.settings,
    fixtures: manifest.fixtures.map(fixture => ({ id: fixture.label.id, packet: fixture.packet })),
  });
  if (
    original.rescored_from !== undefined ||
    !currentEvidence(original, capabilityRevision(previous, rubrics)) ||
    digest(observationInputs(previous)) !== digest(observationInputs(current))
  )
    throw new Error(
      'Rescoring requires original sealed observations with unchanged packets, rubric, settings and floor',
    );
  const { results_digest, ...observations } = original;
  const evidence = {
    ...observations,
    ...capabilityRevision(current, rubrics),
    rescored_from: { results_digest, corpus_digest: original.corpus_digest, scored_at: scoredAt },
  };
  return { ...evidence, results_digest: resultsDigest(evidence) };
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

function findingMatchesConceptGroups(
  message: string,
  groups: NonNullable<CapabilityFixture['finding_groups']>,
): boolean {
  const words = ` ${message.replaceAll(/[^\p{L}\p{N}]+/gu, ' ')}`;
  return groups.every(group =>
    group.some(
      concept =>
        concept.trim() !== '' &&
        words.includes(` ${concept.toLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, ' ')}`),
    ),
  );
}

export function scoreCapabilityRun(fixture: CapabilityFixture, run: CapabilityRun): boolean {
  const normalizedFindings = run.findings.map(finding => ({
    severity: finding.severity,
    message: finding.message.toLowerCase().replaceAll(/\s+/gu, ' '),
  }));
  const contains = (phrase: string, errorOnly: boolean): boolean =>
    normalizedFindings.some(
      finding =>
        (!errorOnly || finding.severity === 'error') &&
        finding.message.includes(phrase.toLowerCase().replaceAll(/\s+/gu, ' ')),
    );
  const groups = fixture.finding_groups;
  return (
    run.fixture_id === fixture.id &&
    run.verdict === fixture.verdict &&
    (run.verdict === 'request_changes') ===
      normalizedFindings.some(finding => finding.severity === 'error') &&
    fixture.required.every(finding => contains(finding, true)) &&
    fixture.forbidden.every(finding => !contains(finding, false)) &&
    (groups === undefined ||
      (groups.length > 0 &&
        normalizedFindings.some(
          finding =>
            finding.severity === 'error' && findingMatchesConceptGroups(finding.message, groups),
        )))
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

export interface BuiltCapabilityCatalogue {
  readonly revisions: readonly PinnedCapabilityRevision[];
  readonly pairs: readonly CapabilityPairRecord[];
  readonly unqualified: readonly CapabilityModelPair[];
}

function pairRecord(
  revision: CapabilityRevision,
  author: SealedCapabilityResults,
  reviewer: SealedCapabilityResults,
  direction: 'not_weaker' | 'weaker',
): CapabilityPairRecord {
  return {
    ...revision,
    author_provider: author.provider,
    author_model: author.model,
    reviewer_provider: reviewer.provider,
    reviewer_model: reviewer.model,
    direction,
    qualification: 'pinned-corpus',
    evidence_date:
      author.evidence_date.localeCompare(reviewer.evidence_date) > 0
        ? author.evidence_date
        : reviewer.evidence_date,
    results_digest: createHash('sha256')
      .update(`${author.results_digest}\0${reviewer.results_digest}`)
      .digest('hex'),
  };
}

function pairEvidence(
  pair: CapabilityModelPair,
  evidenceFor: (model: string) => SealedCapabilityResults | undefined,
): { claude: SealedCapabilityResults; codex: SealedCapabilityResults } | undefined {
  const claude = evidenceFor(pair.anthropic_model);
  const codex = evidenceFor(pair.openai_model);
  if (claude === undefined && codex === undefined) return undefined;
  const label = `${pair.anthropic_model} / ${pair.openai_model}`;
  if (claude === undefined || codex === undefined)
    throw new Error(`Capability evidence for ${label} is partial; record both models`);
  if (
    claude.provider !== 'anthropic' ||
    claude.model !== pair.anthropic_model ||
    codex.provider !== 'openai' ||
    codex.model !== pair.openai_model
  )
    throw new Error(`Capability evidence for ${label} does not match the pinned exact models`);
  return { claude, codex };
}

/**
 * Build the packaged catalogue from sealed evidence. A pinned pair with no evidence stays
 * unqualified; partial, cross-pair or unordered evidence is refused rather than omitted.
 */
export function buildCapabilityCatalogue(
  manifest: CapabilityManifest,
  rubrics: Readonly<Record<string, string>>,
  pinnedPairs: readonly CapabilityModelPair[],
  evidenceFor: (model: string) => SealedCapabilityResults | undefined,
): BuiltCapabilityCatalogue {
  const models = pinnedPairs.flatMap(pair => [pair.anthropic_model, pair.openai_model]);
  if (new Set(models).size !== models.length)
    throw new Error('Pinned capability pairs must not share a model; evidence is stored per model');
  const revisions: PinnedCapabilityRevision[] = [];
  const pairs: CapabilityPairRecord[] = [];
  const unqualified: CapabilityModelPair[] = [];
  for (const pair of pinnedPairs) {
    const evidence = pairEvidence(pair, evidenceFor);
    if (evidence === undefined) {
      unqualified.push(pair);
      continue;
    }
    const { claude, codex } = evidence;
    const label = `${pair.anthropic_model} / ${pair.openai_model}`;
    const pairManifest = capabilityManifestForPair(manifest, pair);
    const forward = compareSealedCapabilityResults(pairManifest, rubrics, claude, codex);
    const reverse = compareSealedCapabilityResults(pairManifest, rubrics, codex, claude);
    if (forward === 'unknown' || reverse === 'unknown')
      throw new Error(`Capability ordering for ${label} is unqualified`);
    const revision = capabilityRevision(pairManifest, rubrics);
    revisions.push({ ...revision, models: [pair.anthropic_model, pair.openai_model] });
    pairs.push(
      pairRecord(revision, claude, codex, forward),
      pairRecord(revision, codex, claude, reverse),
    );
  }
  return { revisions, pairs, unqualified };
}
