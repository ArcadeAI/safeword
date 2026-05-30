/**
 * Unit tests for the review-firing policy (ticket SXSCJQ). Pure decision logic
 * shared by the PostToolUse per-step/per-phase review and the Stop backstop:
 *
 *  - selectMostAdvancedStep — given the newly-checked R/G/R transitions in one
 *    edit, pick which step's review to surface (S1.1–1.5).
 *  - shouldReviewPhase / shouldReviewStep — enter-semantics dedup across the two
 *    triggers (S2.1–2.2, S3.1, S3.3).
 */

import { describe, expect, it } from 'vitest';

import type { CheckboxTransition } from '../../templates/hooks/lib/checkbox-transitions.js';
import {
  selectMostAdvancedStep,
  shouldReviewPhase,
  shouldReviewStep,
} from '../../templates/hooks/lib/review-trigger.js';

function transition(step: string): CheckboxTransition {
  return { step, annotation: 'abc1234' };
}

describe('selectMostAdvancedStep (S1.1–1.5)', () => {
  it('selects red from a lone RED flip (S1.1)', () => {
    expect(selectMostAdvancedStep([transition('RED')])).toBe('red');
  });

  it('selects green from a lone GREEN flip (S1.2)', () => {
    expect(selectMostAdvancedStep([transition('GREEN')])).toBe('green');
  });

  it('selects refactor from a lone REFACTOR flip (S1.3)', () => {
    expect(selectMostAdvancedStep([transition('REFACTOR')])).toBe('refactor');
  });

  it('returns null when no transitions occurred (S1.4)', () => {
    expect(selectMostAdvancedStep([])).toBeNull();
  });

  it('selects the most-advanced step when several flip in one edit (S1.5)', () => {
    expect(selectMostAdvancedStep([transition('RED'), transition('GREEN')])).toBe('green');
    expect(selectMostAdvancedStep([transition('GREEN'), transition('RED')])).toBe('green');
    expect(
      selectMostAdvancedStep([transition('RED'), transition('REFACTOR'), transition('GREEN')]),
    ).toBe('refactor');
  });

  it('is case-insensitive on the step keyword', () => {
    expect(selectMostAdvancedStep([transition('red')])).toBe('red');
    expect(selectMostAdvancedStep([transition('Refactor')])).toBe('refactor');
  });

  it('ignores transitions whose step is not a TDD step', () => {
    expect(selectMostAdvancedStep([transition('REVIEW')])).toBeNull();
    expect(selectMostAdvancedStep([transition('REVIEW'), transition('GREEN')])).toBe('green');
  });
});

describe('shouldReviewPhase — enter-semantics dedup (S2.1–2.2, S3.3)', () => {
  it('fires when the current phase differs from the last reviewed phase (S2.1)', () => {
    expect(shouldReviewPhase('scenario-gate', 'define-behavior')).toBe(true);
  });

  it('does not fire when the current phase was already reviewed (S2.2, S3.3)', () => {
    expect(shouldReviewPhase('verify', 'verify')).toBe(false);
  });

  it('fires on the first phase seen this session (no marker yet)', () => {
    expect(shouldReviewPhase('implement')).toBe(true);
  });

  it('does not fire when there is no current phase', () => {
    expect(shouldReviewPhase(undefined, 'implement')).toBe(false);
  });
});

describe('shouldReviewStep — Stop step dedup (S3.1)', () => {
  it('fires when the current step differs from the last reviewed step', () => {
    expect(shouldReviewStep('green', 'red')).toBe(true);
  });

  it('does not fire when the current step was already reviewed by PostToolUse (S3.1)', () => {
    expect(shouldReviewStep('red', 'red')).toBe(false);
  });

  it('does not fire when there is no current step', () => {
    // eslint-disable-next-line unicorn/no-null -- deriveTddStep returns string | null; exercise the null branch
    expect(shouldReviewStep(null, 'red')).toBe(false);
  });
});
