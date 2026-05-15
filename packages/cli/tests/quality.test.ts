import { describe, expect, it } from 'vitest';

import {
  type BddPhase,
  getDisqualificationMessage,
  getQualityMessage,
  QUALITY_REVIEW_MESSAGE,
} from '../templates/hooks/lib/quality.js';

describe('getQualityMessage — universal binary terminal (143)', () => {
  describe('Rule: Every Stop emits the binary terminal across phases', () => {
    it('intake includes the universal header', () => {
      const message = getQualityMessage('intake');
      expect(message).toContain('CONFIDENT');
      expect(message).toContain('BLOCKED');
      expect(message).toContain('Tried:');
      expect(message).toContain('Need:');
      expect(message.toLowerCase()).toMatch(/not a list|no lists/);
    });

    it('implement GREEN includes universal header AND test-pass evidence', () => {
      const message = getQualityMessage('implement', 'green');
      expect(message).toContain('CONFIDENT');
      expect(message).toContain('BLOCKED');
      expect(message.toLowerCase()).toMatch(/test|pass/);
    });

    it('verify is a valid BddPhase and emits binary header', () => {
      // BddPhase enum check (compile-time): TS would fail if 'verify' weren't valid
      const phase: BddPhase = 'verify';
      const message = getQualityMessage(phase);
      expect(message).toContain('CONFIDENT');
      expect(message).toContain('BLOCKED');
    });

    it('done includes universal header AND cites /audit and /verify', () => {
      const message = getQualityMessage('done');
      expect(message).toContain('CONFIDENT');
      expect(message).toContain('/audit');
      expect(message).toContain('/verify');
    });

    it('no phase emits the legacy free-form list-style review prompt', () => {
      for (const phase of [
        'intake',
        'define-behavior',
        'scenario-gate',
        'decomposition',
        'implement',
        'verify',
        'done',
      ] as BddPhase[]) {
        const message = getQualityMessage(phase);
        expect(message).not.toContain('State what remains uncertain');
      }
    });

    it('universal header includes the "Think about evidence before declaring" nudge', () => {
      const message = getQualityMessage('intake');
      expect(message).toContain('Think about evidence before declaring');
    });

    it('unknown phase falls back to default (implement-style) binary form', () => {
      const message = getQualityMessage('unknown-phase');
      expect(message).toContain('CONFIDENT');
      expect(message).toContain('BLOCKED');
      expect(message).toBe(QUALITY_REVIEW_MESSAGE);
    });
  });

  describe('Rule: BLOCKED has required structure (Tried + Need; no lists)', () => {
    it('universal header includes literal token Tried:', () => {
      expect(QUALITY_REVIEW_MESSAGE).toContain('Tried:');
    });

    it('universal header includes literal token Need:', () => {
      expect(QUALITY_REVIEW_MESSAGE).toContain('Need:');
    });

    it('universal header forbids lists', () => {
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toMatch(/not a list|no lists/);
    });
  });

  describe('Rule: Propulsive verdicts (Next: on CONFIDENT, optional Meanwhile on BLOCKED)', () => {
    it('CONFIDENT line includes "Next:" directive for forward motion', () => {
      const message = getQualityMessage('intake');
      expect(message).toMatch(/CONFIDENT.*Next:/);
    });

    it('CONFIDENT Next: framing is "what you\'ll do or recommend" (not autonomous action)', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toMatch(/what you'll do or recommend|do or recommend/);
    });

    it('BLOCKED line includes optional Meanwhile parenthetical for parallel work', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('parallel action');
      expect(message.toLowerCase()).toMatch(/optional/);
    });
  });

  describe('Rule: Universal critical review applies at every phase', () => {
    it('header includes universal critical review (correctness, simplicity, latest docs/research)', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('correctness');
      expect(message.toLowerCase()).toContain('simplicity');
      expect(message.toLowerCase()).toMatch(/latest docs|docs\/research/);
    });

    it('header instructs the investigate-enumerate-debate-recommend loop on uncertainty', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('investigate primary sources');
      expect(message.toLowerCase()).toContain('enumerate');
      expect(message.toLowerCase()).toContain('options');
      expect(message.toLowerCase()).toContain('debate');
      expect(message.toLowerCase()).toContain('recommend');
    });

    it('header debate criteria are correctness, elegance, no-bloat', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('correctness/elegance/no-bloat');
    });
  });

  describe('Rule: BLOCKED unknown must be falsifiable', () => {
    it('BLOCKED template requires a question with a falsifiable answer', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('falsifiable answer');
    });
  });

  describe('Rule: Universal header applies to ALL phase variants (regression guard)', () => {
    const phaseVariants: [string, string | undefined][] = [
      ['intake', undefined],
      ['define-behavior', undefined],
      ['scenario-gate', undefined],
      ['decomposition', undefined],
      ['implement', undefined],
      ['implement', 'red'],
      ['implement', 'green'],
      ['implement', 'refactor'],
      ['verify', undefined],
      ['done', undefined],
      ['unknown-phase', undefined],
    ];

    it.each(phaseVariants)(
      'getQualityMessage(%s, %s) emits the full universal header',
      (phase, tddStep) => {
        const message = getQualityMessage(phase, tddStep);
        // Verdict shape
        expect(message).toContain('CONFIDENT');
        expect(message).toContain('BLOCKED');
        expect(message).toContain('Tried:');
        expect(message).toContain('Need:');
        expect(message).toContain('Next:');
        // Methodology
        expect(message.toLowerCase()).toContain('investigate primary sources');
        expect(message.toLowerCase()).toContain('correctness/elegance/no-bloat');
        // Research depth
        expect(message.toLowerCase()).toMatch(/primary\s+literature/);
        expect(message.toLowerCase()).toContain('blog posts');
        // BLOCKED sharpening
        expect(message.toLowerCase()).toContain('falsifiable answer');
        // Optional Meanwhile
        expect(message.toLowerCase()).toContain('parallel action');
        // No legacy free-form prompt leaked through
        expect(message).not.toContain('State what remains uncertain');
      },
    );
  });

  describe('Rule: Research depth matches claim weight', () => {
    it('header instructs to match research depth to claim weight', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('research depth');
      expect(message.toLowerCase()).toContain('claim weight');
    });

    it('header names primary literature for design/empirical claims', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toMatch(/primary\s+literature/);
      expect(message.toLowerCase()).toMatch(/peer-reviewed/);
    });

    it('header explicitly excludes blog posts, tweets, marketing as research', () => {
      const message = getQualityMessage('intake');
      expect(message.toLowerCase()).toContain('blog posts');
      expect(message.toLowerCase()).toContain('tweets');
      expect(message.toLowerCase()).toContain('marketing');
    });
  });

  describe('Rule: Per-phase criteria fully restored', () => {
    it('intake evidence cites scope/out_of_scope/done_when AND failure modes AND open questions', () => {
      const message = getQualityMessage('intake');
      expect(message).toContain('scope');
      expect(message).toContain('out_of_scope');
      expect(message).toContain('done_when');
      expect(message.toLowerCase()).toContain('failure modes');
      expect(message.toLowerCase()).toContain('open questions');
    });

    it('define-behavior evidence cites AODI AND coverage AND behaviors-not-implementation', () => {
      const message = getQualityMessage('define-behavior');
      expect(message).toContain('AODI');
      expect(message.toLowerCase()).toMatch(/happy.*failure.*edge|coverage/);
      expect(message.toLowerCase()).toContain('behaviors not implementation');
    });

    it('REFACTOR evidence cites one refactoring (not batched) AND smell-named AND no behavior change AND tests still pass', () => {
      const message = getQualityMessage('implement', 'refactor');
      expect(message.toLowerCase()).toContain('one refactoring');
      expect(message.toLowerCase()).toContain('not batched');
      expect(message.toLowerCase()).toContain('smell');
      expect(message.toLowerCase()).toContain('no behavior change');
      expect(message.toLowerCase()).toMatch(/tests.*pass/);
    });

    it('done evidence cites /audit AND /verify AND verify.md AND scope drift AND scenario coverage AND refactoring', () => {
      const message = getQualityMessage('done');
      expect(message).toContain('/audit');
      expect(message).toContain('/verify');
      expect(message).toContain('verify.md');
      expect(message.toLowerCase()).toContain('scope drift');
      expect(message.toLowerCase()).toContain('scenario coverage');
      expect(message.toLowerCase()).toContain('refactoring');
    });
  });

  describe('Rule: Disqualification flags block CONFIDENT explicitly', () => {
    it('returns explicit message when novelResearchReminder is unconsumed', () => {
      const result = getDisqualificationMessage({
        novelResearchReminderUnconsumed: true,
      });
      expect(result).toBeDefined();
      expect(result).toContain('CONFIDENT requires /quality-review first');
      expect(result).toContain('novel-claim flag is unconsumed');
    });

    it('returns explicit message naming the failure pattern when recentRelevantFailure is set', () => {
      const result = getDisqualificationMessage({
        novelResearchReminderUnconsumed: false,
        recentRelevantFailure: 'loc-exceeded',
      });
      expect(result).toBeDefined();
      expect(result).toContain('loc-exceeded');
      expect(result).toContain('CONFIDENT');
    });

    it('returns undefined when neither flag is set', () => {
      const result = getDisqualificationMessage({
        novelResearchReminderUnconsumed: false,
      });
      expect(result).toBeUndefined();
    });
  });
});
