import { describe, expect, it } from 'vitest';

import {
  type CheckRun,
  computeCiState,
  evaluateTrigger,
  isMaterialChange,
  resolveRequiredChecks,
} from '../../src/pr-review/trigger.js';
import { RECEIPT_CHECK_NAME } from '../../src/pr-review/verdict.js';

const green = (name: string): CheckRun => ({ name, conclusion: 'success' });
const red = (name: string): CheckRun => ({ name, conclusion: 'failure' });
/** A check that has not concluded yet — GitHub reports a null conclusion. */
const pending = (name: string): CheckRun => ({ name });

/** The paths a given row's push touched, kept out of the row loop's ternaries. */
function pathsFor(event: string): string[] | undefined {
  if (!event.includes('after the first review')) return undefined;
  return event.includes('docs-only') ? ['README.md', 'docs/guide.md'] : ['src/auth.ts'];
}

describe('autonomous-pr-review.TB1.R8 — trigger gating (36EEMY slice 2)', () => {
  // The Rule's own table. Each row is a distinct reason to fire or stay quiet,
  // so a runner that always fires (or never does) fails several rows.
  const rows = [
    { event: 'a push while still a draft', ci: 'green', fires: false },
    { event: 'being marked ready for review', ci: 'red', fires: false },
    { event: 'being marked ready for review', ci: 'pending', fires: false },
    { event: 'being marked ready for review', ci: 'green', fires: true },
    { event: 'a docs-only push after the first review', ci: 'green', fires: false },
    { event: 'a source-file push after the first review', ci: 'red', fires: false },
    { event: 'a source-file push after the first review', ci: 'green', fires: true },
  ] as const;

  it.each(rows)(
    'autonomous-pr-review.TB1.R8.fires_once_on_a_ready_green_pr_and_re_fires_only_on_a_material_re_green [$event / $ci]',
    ({ event, ci, fires }) => {
      const afterFirstReview = event.includes('after the first review');
      const decision = evaluateTrigger({
        isDraft: event.includes('draft'),
        ciState: ci,
        headSha: 'head2',
        reviewedSha: afterFirstReview ? 'head1' : undefined,
        changedPathsSinceReview: pathsFor(event),
      });

      expect(decision.fire).toBe(fires);
      // Every decision explains itself — "why didn't it review?" must be
      // answerable from one line of output, not by re-deriving the state.
      expect(decision.reason).not.toHaveLength(0);
    },
  );

  it('fires once per head SHA — a re-run on an already-reviewed SHA stays quiet', () => {
    const already = evaluateTrigger({
      isDraft: false,
      ciState: 'green',
      headSha: 'head1',
      reviewedSha: 'head1',
    });
    expect(already.fire).toBe(false);
    expect(already.reason).toMatch(/already reviewed/i);
  });
});

describe('the green gate reads the required set, not every check', () => {
  it('a failing OPTIONAL check does not make CI red', () => {
    const checks = [green('build'), green('test'), red('optional-lint')];
    expect(computeCiState(checks, ['build', 'test'])).toBe('green');
  });

  it('a missing required check is pending, not green', () => {
    expect(computeCiState([green('build')], ['build', 'test'])).toBe('pending');
  });

  it('with no required set known, every check must pass', () => {
    expect(computeCiState([green('build'), red('lint')], undefined)).toBe('red');
    expect(computeCiState([green('build'), green('lint')], undefined)).toBe('green');
  });

  it('an empty check set is NOT green — the gate fails closed', () => {
    // A repo whose CI reports only through the legacy commit-status API creates
    // zero check runs. Reading that as green would review red code, which is the
    // one thing R8 exists to prevent. `[].every(...)` is true, so this has to be
    // handled explicitly rather than falling out of the reduction.
    expect(computeCiState([], undefined)).toBe('pending');
  });

  it('a required set that is empty after excluding the receipt is NOT green', () => {
    // Reachable from prReview.requiredChecks: configure only the reviewer's own
    // check and the required set filters down to nothing.
    expect(computeCiState([green('build')], [RECEIPT_CHECK_NAME])).toBe('pending');
  });

  const satisfying = ['success', 'skipped', 'neutral'] as const;
  it.each(satisfying)('a required check concluding %s satisfies the gate', conclusion => {
    // GitHub treats success, skipped AND neutral as satisfying a required check.
    // Skipped required jobs are routine (path filters, `if:` guards), so demanding
    // `success` alone is a permanent silent no-fire.
    expect(computeCiState([{ name: 'build', conclusion }], ['build'])).toBe('green');
  });

  it("the reviewer's own receipt is never part of the green it waits on", () => {
    // Self-deadlock guard: the receipt is written by this reviewer AFTER it
    // runs, so counting it would mean CI is never green until the review that
    // is waiting for green has already happened.
    const checks = [green('build'), pending(RECEIPT_CHECK_NAME)];
    expect(computeCiState(checks, undefined)).toBe('green');
    expect(computeCiState(checks, ['build', RECEIPT_CHECK_NAME])).toBe('green');
  });
});

describe('resolving which checks are required — three tiers, and the tier is reported', () => {
  it('prefers rulesets, which an ordinary workflow token can read', () => {
    const resolved = resolveRequiredChecks({
      rulesetChecks: ['build', 'test'],
      configuredChecks: ['ignored'],
    });
    expect(resolved).toEqual({ checks: ['build', 'test'], tier: 'rulesets' });
  });

  it('falls back to configured checks when no ruleset applies (classic branch protection)', () => {
    const resolved = resolveRequiredChecks({
      rulesetChecks: [],
      configuredChecks: ['ci/build'],
    });
    expect(resolved).toEqual({ checks: ['ci/build'], tier: 'config' });
  });

  it('falls back to all-checks-must-pass, the over-strict last resort', () => {
    const resolved = resolveRequiredChecks({ rulesetChecks: [], configuredChecks: [] });
    // `undefined` means "no known required set" — computeCiState then demands
    // every check pass. Over-strict on purpose: it can never review red code.
    expect(resolved).toEqual({ checks: undefined, tier: 'all-checks' });
  });
});

describe('material change — a docs-only push never re-fires the reviewer', () => {
  it('classifies documentation-only changes as immaterial', () => {
    expect(isMaterialChange(['README.md', 'docs/a.md', 'CHANGELOG.md'])).toBe(false);
  });

  it('classifies any source change as material', () => {
    expect(isMaterialChange(['README.md', 'src/auth.ts'])).toBe(true);
  });

  it.each([
    'src/licenses.ts',
    'src/changelog.ts',
    'src/readme-generator.ts',
    'LICENSE-checker.js',
    'READMEish.ts',
  ])('does not mistake source named like a doc for a doc: %s', path => {
    // A prefix match on README/CHANGELOG/LICENSE swallows real source files whose
    // names merely start the same way, and a push touching only those would
    // never re-fire the review.
    expect(isMaterialChange([path])).toBe(true);
  });

  it.each(['README.md', 'docs/guide.md', 'LICENSE', 'CHANGELOG.md', 'sub/docs/a.png'])(
    'still classifies genuine documentation as immaterial: %s',
    path => {
      expect(isMaterialChange([path])).toBe(false);
    },
  );

  it('treats an empty change set as immaterial', () => {
    expect(isMaterialChange([])).toBe(false);
  });
});
