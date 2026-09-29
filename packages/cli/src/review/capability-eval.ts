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

export function scoreCapabilityRun(fixture: CapabilityFixture, run: CapabilityRun): boolean {
  return (
    run.fixture_id === fixture.id &&
    run.verdict === fixture.verdict &&
    fixture.required.every(finding => run.findings.includes(finding)) &&
    fixture.forbidden.every(finding => !run.findings.includes(finding))
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
