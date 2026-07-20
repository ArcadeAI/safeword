import { describe, expect, it } from 'vitest';

import { assembleReviewBody, deriveVerdict } from '../../src/pr-review/decision.js';
import type { ReviewFinding } from '../../src/pr-review/verdict.js';

const finding = (id: string): ReviewFinding => ({
  path: `src/${id}.ts`,
  line: 1,
  consequence: `Consequence ${id}.`,
});

describe('autonomous-pr-review.TB2.R2 — size never buys a receipt on a sensitive surface', () => {
  const rows = [
    { state: 'holds an unresolved question', unresolved: true, verdict: 'needs-a-human' },
    { state: 'has every question resolved cleanly', unresolved: false, verdict: 'reviewed' },
  ] as const;

  it.each(rows)(
    'autonomous-pr-review.TB2.R2.size_never_buys_a_reviewed_receipt_on_a_sensitive_surface [$state]',
    ({ unresolved, verdict }) => {
      // A two-line diff touching an authorization control. Line count is not an
      // input at all — 11 of 14 small auth/infra PRs in the study got zero human
      // comments, which is the blind spot this Rule exists to close.
      expect(
        deriveVerdict({ findings: [], hasUnresolvedQuestion: unresolved, changedLines: 2 }),
      ).toBe(verdict);
    },
  );

  it('an unresolved question outranks an empty finding set — this is not a duplicate of R9', () => {
    // R9 keys the verdict on whether FINDINGS exist. This case has none and
    // still must not hand out a receipt, which is the rule R9 alone would miss.
    expect(deriveVerdict({ findings: [], hasUnresolvedQuestion: true })).toBe('needs-a-human');
    expect(deriveVerdict({ findings: [], hasUnresolvedQuestion: false })).toBe('reviewed');
  });

  it('a large diff with nothing open is still just reviewed', () => {
    // The inverse of the Rule: depth is set by what the change touches, so size
    // must not manufacture a verdict any more than it excuses one.
    expect(deriveVerdict({ findings: [], hasUnresolvedQuestion: false, changedLines: 4000 })).toBe(
      'reviewed',
    );
  });

  it('any finding routes to a human regardless of size', () => {
    expect(deriveVerdict({ findings: [finding('a')], hasUnresolvedQuestion: false })).toBe(
      'needs-a-human',
    );
  });
});

describe('autonomous-pr-review.NTB1.R4 — the review ends in a decision', () => {
  it('autonomous-pr-review.NTB1.R4.a_review_with_findings_ends_in_one_actionable_decision', () => {
    const body = assembleReviewBody({
      findings: [finding('a'), finding('b'), finding('c')],
      decision: 'push back',
    });

    const sections = body.trimEnd().split('\n\n');
    const last = sections.at(-1) ?? '';

    // Exactly one routing decision, and it is the FINAL element.
    expect(last).toMatch(/push back/i);
    expect(body.match(/^→ /gm) ?? []).toHaveLength(1);

    // After the findings, not instead of them — a decision that replaced the
    // evidence would leave the reader nothing to check it against.
    expect(sections).toHaveLength(4);
    for (const id of ['a', 'b', 'c']) expect(body).toContain(`Consequence ${id}.`);
    expect(body.indexOf('Consequence c.')).toBeLessThan(body.indexOf('push back'));
  });

  it('offers ask as the other flavour, never both at once', () => {
    const body = assembleReviewBody({ findings: [finding('a')], decision: 'ask' });
    expect(body).toMatch(/ask/i);
    expect(body).not.toMatch(/push back/i);
    expect(body.match(/^→ /gm) ?? []).toHaveLength(1);
  });

  it('a review with no findings carries no decision — silence is not a verdict to act on', () => {
    // R2: nothing worth saying means nothing posted, so there is no body to end
    // in a decision. Emitting one anyway would be the noise the receipt avoids.
    expect(assembleReviewBody({ findings: [], decision: undefined })).toBe('');
  });
});
