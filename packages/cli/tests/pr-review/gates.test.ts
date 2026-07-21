import { describe, expect, it } from 'vitest';

import { applyBaseReproGate, applyFixGate } from '../../src/pr-review/gates.js';
import { renderFinding, type ReviewFinding } from '../../src/pr-review/verdict.js';

const changeCaused: ReviewFinding = {
  path: 'src/retry.ts',
  line: 20,
  consequence: 'The retry has no connection timeout, so it waits indefinitely.',
};
const latent: ReviewFinding = {
  path: 'src/old.ts',
  line: 5,
  consequence: 'A goroutine leaks when the caller times out.',
};

describe('autonomous-pr-review.TB1.R12 — the base-reproduction gate (36EEMY slice 7)', () => {
  it('autonomous-pr-review.TB1.R12.a_latent_finding_is_dropped_while_the_change_caused_one_posts', async () => {
    // The prose version of this rule failed once in a live trial: a true,
    // verified defect was posted on a PR that merely touched the file, and the
    // maintainer called it noise. base+head turns judgment into a check.
    const kept = await applyBaseReproGate([changeCaused, latent], {
      reproducesOnBase: finding => Promise.resolve(finding.path === 'src/old.ts'),
    });

    expect(kept.map(finding => finding.path)).toEqual(['src/retry.ts']);
  });

  it('autonomous-pr-review.TB1.R12.change_caused_finding_is_posted_inline', async () => {
    const kept = await applyBaseReproGate([changeCaused], {
      reproducesOnBase: () => Promise.resolve(false),
    });

    expect(kept).toHaveLength(1);
    expect(kept[0]?.path).toBe('src/retry.ts');
  });

  const origins = [
    { origin: 'reproduces unchanged on the base branch', reproduces: true, remaining: 0 },
    { origin: 'appears only on a line the PR changed', reproduces: false, remaining: 1 },
  ] as const;

  it.each(origins)(
    'autonomous-pr-review.TB1.R12.the_same_defect_verdicts_differently_by_whether_the_pr_caused_it [$origin]',
    async ({ reproduces, remaining }) => {
      // Same defect, same text — only its ORIGIN differs, and that alone
      // decides whether a human is called.
      const kept = await applyBaseReproGate([changeCaused], {
        reproducesOnBase: () => Promise.resolve(reproduces),
      });

      expect(kept).toHaveLength(remaining);
    },
  );

  it('keeps a finding when the base check cannot run, rather than dropping it', async () => {
    // Fail-OPEN here, unlike the fix gate. A dropped finding is invisible; an
    // unverified one is merely noisy, and R5 already caps what it may claim.
    const kept = await applyBaseReproGate([changeCaused], {
      reproducesOnBase: () => Promise.reject(new Error('base checkout unavailable')),
    });

    expect(kept).toHaveLength(1);
  });
});

describe('autonomous-pr-review.TB1.R13 — the fix gate', () => {
  const withFix: ReviewFinding = { ...changeCaused, suggestedFix: 'connectTimeout: 5_000' };

  it('autonomous-pr-review.TB1.R13.a_fix_that_breaks_a_shipped_test_is_withheld', async () => {
    // The rule exists because a TRUE finding once shipped with a patch that
    // would have made a failure counter unable to increment and turned a
    // shipped test red. The finding survives; only the patch is withheld.
    const [gated] = await applyFixGate([withFix], {
      runAffectedTests: () => Promise.resolve({ passed: false }),
    });
    if (!gated) throw new Error('the finding itself must survive the gate');

    expect(gated.suggestedFix).toBeUndefined();
    expect(renderFinding(gated)).toMatch(/no validated fix|not run|withheld/i);
  });

  it('autonomous-pr-review.TB1.R13.a_verified_fix_is_posted_with_the_finding', async () => {
    const [gated] = await applyFixGate([withFix], {
      runAffectedTests: () => Promise.resolve({ passed: true }),
    });

    expect(gated?.suggestedFix).toBe('connectTimeout: 5_000');
  });

  it('does not run tests for a finding that carries no fix — the cost is bounded', async () => {
    let runs = 0;
    await applyFixGate([changeCaused], {
      runAffectedTests: () => {
        runs += 1;
        return Promise.resolve({ passed: true });
      },
    });

    expect(runs).toBe(0);
  });

  it('autonomous-pr-review.SM1.R3.the_fix_gate_degrades_on_a_fork_rather_than_running_fork_code', async () => {
    // The tripwire is executing untrusted code, so on a fork the gate does not
    // run at all. It withholds the fix rather than validating it — and says so,
    // because an unexplained missing patch reads as the reviewer having nothing
    // to offer.
    let executed = 0;
    const [gated] = await applyFixGate([withFix], {
      executionTier: 'degrade',
      runAffectedTests: () => {
        executed += 1;
        return Promise.resolve({ passed: true });
      },
    });

    if (!gated) throw new Error('the finding itself must survive the gate');
    expect(executed).toBe(0);
    expect(gated.suggestedFix).toBeUndefined();
    expect(renderFinding(gated)).toMatch(/not run|fork/i);
  });

  it('withholds the fix when the test run itself errors', async () => {
    // Fail-CLOSED, the opposite of the base gate. An unvalidated patch is the
    // dangerous artifact — code blocks are the strongest predictor that a
    // comment gets applied, so a wrong one lands.
    const [gated] = await applyFixGate([withFix], {
      runAffectedTests: () => Promise.reject(new Error('runner exploded')),
    });

    expect(gated?.suggestedFix).toBeUndefined();
  });
});
