import { describe, expect, it } from 'vitest';

import {
  type AdversaryOutcome,
  type AdversaryRunner,
  runAdversary,
} from '../../src/pr-review/adversary.js';
import { renderFinding, type ReviewFinding } from '../../src/pr-review/verdict.js';

const findingA: ReviewFinding = {
  path: 'src/auth.ts',
  line: 12,
  consequence: 'A prefix match authenticates.',
};
const findingB: ReviewFinding = {
  path: 'src/db.ts',
  line: 7,
  consequence: 'The retry has no connection timeout.',
};

/** An adversary whose verdict per finding is fixed by the scenario, not by a model. */
function scriptedAdversary(script: Record<string, AdversaryOutcome>): {
  run: AdversaryRunner;
  callCount: () => number;
} {
  let calls = 0;
  return {
    callCount: () => calls,
    run: (finding: ReviewFinding) => {
      calls += 1;
      const outcome = script[finding.path];
      if (outcome === undefined) throw new Error(`no script for ${finding.path}`);
      if (outcome === 'error') return Promise.reject(new Error('adversary exploded'));
      return Promise.resolve(outcome);
    },
  };
}

describe('autonomous-pr-review.TB1.R14 — the adversarial pass (36EEMY slice 6)', () => {
  it('autonomous-pr-review.TB1.R14.a_refuted_finding_is_marked_contested_not_dropped', async () => {
    const adversary = scriptedAdversary({
      'src/auth.ts': 'refuted',
      'src/db.ts': 'affirmed',
    });

    const annotated = await runAdversary([findingA, findingB], adversary.run);

    // Both survive. With only two vendors, an author-was-Claude review runs on
    // Codex and the refuter IS Claude — the author's own lineage — so a
    // refutation can share the author's blind spot. The adversary may lower
    // confidence; it may never make a true finding vanish.
    expect(annotated).toHaveLength(2);
    const [refuted, affirmed] = annotated;
    if (!refuted || !affirmed) throw new Error('expected both findings to survive');

    expect(refuted.adversarial).toBe('contested');
    expect(affirmed.adversarial).toBe('affirmed');

    // "Contested" is worthless if the reader cannot see it.
    expect(renderFinding(refuted)).toMatch(/contested/i);
    expect(renderFinding(affirmed)).not.toMatch(/contested/i);
  });

  const outcomes = [
    { outcome: 'error', mark: 'unchecked' },
    { outcome: 'affirmed', mark: 'affirmed' },
  ] as const;

  it.each(outcomes)(
    'autonomous-pr-review.TB1.R14.the_adversary_outcome_sets_the_findings_check_mark [$outcome]',
    async ({ outcome, mark }) => {
      const adversary = scriptedAdversary({ 'src/auth.ts': outcome });
      const annotated = await runAdversary([findingA], adversary.run);

      // An adversary that errors leaves the finding posted-but-unchecked —
      // never dropped, and never silently upgraded to "verified".
      expect(annotated).toHaveLength(1);
      expect(annotated[0]?.adversarial).toBe(mark);
    },
  );

  const existence = [
    { label: 'one finding', findings: [findingA], expectedCalls: 1 },
    { label: 'no findings', findings: [], expectedCalls: 0 },
  ] as const;

  it.each(existence)(
    'autonomous-pr-review.TB1.R14.a_finding_is_adversarially_marked_only_when_a_finding_exists [$label]',
    async ({ findings, expectedCalls }) => {
      const adversary = scriptedAdversary({ 'src/auth.ts': 'affirmed' });
      const annotated = await runAdversary([...findings], adversary.run);

      // Cost is bounded because the adversary only runs when findings exist —
      // a second vendor spawn on every clean PR would be pure waste.
      expect(adversary.callCount()).toBe(expectedCalls);
      expect(annotated).toHaveLength(findings.length);
    },
  );
});
