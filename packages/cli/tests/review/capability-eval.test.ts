import { describe, expect, it } from 'vitest';

import {
  type CapabilityFixture,
  type CapabilityRun,
  compareCapabilityRuns,
  scoreCapabilityRun,
} from '../../src/review/capability-eval.js';

const fixtures: CapabilityFixture[] = [
  { id: 'product-approve', verdict: 'approve', required: [], forbidden: ['invented-scope'] },
  {
    id: 'product-reject',
    verdict: 'request_changes',
    required: ['missing-outcome'],
    forbidden: ['invented-scope'],
  },
  {
    id: 'implementation-approve',
    verdict: 'approve',
    required: [],
    forbidden: ['invented-design'],
  },
  {
    id: 'implementation-reject',
    verdict: 'request_changes',
    required: ['missing-boundary'],
    forbidden: [],
  },
  { id: 'execution-approve', verdict: 'approve', required: [], forbidden: ['invented-proof'] },
  {
    id: 'execution-reject',
    verdict: 'request_changes',
    required: ['missing-slice'],
    forbidden: [],
  },
];

const floor = { runs_per_fixture: 3, minimum_fixture_passes: 2, minimum_total_percent: 90 };

function runs(): CapabilityRun[] {
  return fixtures.flatMap(fixture =>
    [1, 2, 3].map(run => ({
      fixture_id: fixture.id,
      run,
      verdict: fixture.verdict,
      findings: fixture.required,
    })),
  );
}

function withVerdict(
  source: readonly CapabilityRun[],
  index: number,
  verdict: CapabilityRun['verdict'],
): CapabilityRun[] {
  const changed = [...source];
  const previous = changed[index];
  if (previous === undefined) throw new Error(`Missing test run ${index}`);
  changed[index] = { ...previous, verdict };
  return changed;
}

describe('reviewer capability evaluation', () => {
  it('requires the verdict and every labelled finding without forbidden findings', () => {
    const fixture = fixtures[1];
    const run = runs()[3];
    if (fixture === undefined || run === undefined) throw new Error('Missing test fixture');
    expect(scoreCapabilityRun(fixture, run)).toBe(true);
    expect(scoreCapabilityRun(fixture, { ...run, verdict: 'approve' })).toBe(false);
    expect(scoreCapabilityRun(fixture, { ...run, findings: [] })).toBe(false);
    expect(
      scoreCapabilityRun(fixture, { ...run, findings: ['missing-outcome', 'invented-scope'] }),
    ).toBe(false);
  });

  it('qualifies a candidate only when every fixture and the predeclared 90% floor pass', () => {
    const author = withVerdict(runs(), 0, 'request_changes');
    const candidate = withVerdict(runs(), 0, 'request_changes');
    expect(compareCapabilityRuns(fixtures, author, candidate, floor)).toBe('not_weaker');

    expect(
      compareCapabilityRuns(fixtures, author, withVerdict(candidate, 1, 'request_changes'), floor),
    ).toBe('unknown');
  });

  it('calibrates a known weaker candidate against an author-reliable fixture', () => {
    const candidate = withVerdict(runs(), 1, 'request_changes');
    expect(compareCapabilityRuns(fixtures, runs(), candidate, floor)).toBe('weaker');
  });

  it('refuses incomplete or duplicated three-run evidence', () => {
    const candidate = runs();
    expect(compareCapabilityRuns(fixtures, runs(), candidate.slice(1), floor)).toBe('unknown');
    const previous = candidate[1];
    if (previous === undefined) throw new Error('Missing test run');
    candidate[1] = { ...previous, run: 1 };
    expect(compareCapabilityRuns(fixtures, runs(), candidate, floor)).toBe('unknown');
  });
});
