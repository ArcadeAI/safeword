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
      expect(message).toContain('No lists');
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
      expect(QUALITY_REVIEW_MESSAGE.toLowerCase()).toContain('no lists');
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
