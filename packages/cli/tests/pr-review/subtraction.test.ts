import { describe, expect, it } from 'vitest';

import { boundCompletenessSeverity } from '../../src/pr-review/certainty.js';
import { type Concern, subtractCoverage } from '../../src/pr-review/subtraction.js';

/** A concern the project's own tooling never touched — the control in every row. */
const concernY: Concern = { id: 'Y', coverage: 'uncovered', addsNewEvidence: false };

describe('autonomous-pr-review.TB1.R1 — subtract on coverage, not mention (36EEMY slice 5)', () => {
  const rows = [
    {
      otherTool: 'resolved by a deterministic tooling check',
      version: 'no new severity or evidence',
      coverage: 'tooling-resolved',
      addsNewEvidence: false,
      present: false,
    },
    {
      otherTool: 'resolved by a deterministic tooling check',
      version: 'verified and higher-severity',
      coverage: 'tooling-resolved',
      addsNewEvidence: true,
      present: true,
    },
    {
      otherTool: 'merely mentioned by a code-review bot',
      version: 'no new severity or evidence',
      coverage: 'bot-mentioned',
      addsNewEvidence: false,
      present: true,
    },
  ] as const;

  it.each(rows)(
    'autonomous-pr-review.TB1.R1.a_concern_is_dropped_only_when_the_tooling_actually_covered_it [$otherTool / $version]',
    ({ coverage, addsNewEvidence, present }) => {
      const concernX: Concern = { id: 'X', coverage, addsNewEvidence };

      const kept = subtractCoverage([concernX, concernY]).map(concern => concern.id);

      // Y is the discriminating positive: a subtractor that drops everything
      // would satisfy row 1 and fail here.
      expect(kept).toContain('Y');
      expect(kept.includes('X')).toBe(present);
    },
  );

  it('a bot merely naming a concern is not coverage, however loudly it names it', () => {
    // Dropping the reviewer's own verified version because a noisy bot mentioned
    // the same area discards the strongest signal available — a human acts on a
    // human-shaped finding far more often than on a bot's (rho=0.99).
    const kept = subtractCoverage([
      { id: 'X', coverage: 'bot-mentioned', addsNewEvidence: true },
      { id: 'Z', coverage: 'bot-mentioned', addsNewEvidence: false },
    ]);
    expect(kept.map(concern => concern.id)).toEqual(['X', 'Z']);
  });

  it('keeps everything when nothing is covered at all', () => {
    expect(subtractCoverage([concernY])).toHaveLength(1);
  });
});

describe('autonomous-pr-review.TB1.R7 — completeness certainty is bound by cardinality', () => {
  const rows = [
    { prCount: 3, label: 'more than one', severity: 'question' },
    { prCount: 1, label: 'exactly one', severity: 'finding' },
  ] as const;

  it.each(rows)(
    'autonomous-pr-review.TB1.R7.completeness_certainty_is_bound_by_ticket_to_pr_cardinality [$label]',
    ({ prCount, severity }) => {
      // Completeness (ticket → PR, "did it do everything?") false-positives
      // whenever the ticket is broader than this PR. Scope (PR → ticket) cannot
      // false-positive that way and is deliberately not capped here.
      expect(boundCompletenessSeverity(prCount)).toBe(severity);
    },
  );

  it('treats an unknown or zero reference count as the unsafe case', () => {
    // Zero referencing PRs is not "1:1", it means the detector could not see
    // the series. Defaulting to `finding` there would assert a gap on exactly
    // the evidence we do not have.
    expect(boundCompletenessSeverity(0)).toBe('question');
  });
});
