/**
 * Unit tests for the breakpoint orchestrator (ticket HPQ43R) — how a single
 * would-be HITL pause is handled given an axis posture, the always-confirm
 * denylist, and the fail-safe failure handling. Covers DEV3.AC1–AC5 and
 * DEV5.AC1 at the decision-contract level. The live-session wiring (actual
 * tool interception, work-log writes) rides on this contract.
 */

import { describe, expect, it, vi } from 'vitest';

import { isDenylisted, resolveBreakpoint } from './autonomy-breakpoint.js';

const success = vi.fn(() => ({
  outcome: 'success' as const,
  pick: 'use date-fns',
  options: ['date-fns', 'dayjs'],
  rationale: 'smaller bundle',
}));

describe('isDenylisted', () => {
  it('flags irreversible/outward actions', () => {
    expect(isDenylisted('git-push')).toBe(true);
    expect(isDenylisted('send-external-message')).toBe(true);
    expect(isDenylisted('mark-ticket-done')).toBe(true);
  });

  it('does not flag ordinary actions', () => {
    expect(isDenylisted('edit-file')).toBe(false);
  });
});

describe('resolveBreakpoint posture', () => {
  it('pauses on an ask axis without invoking figure-it-out', () => {
    const run = vi.fn();
    const result = resolveBreakpoint({ posture: 'ask', question: 'q', runFigureItOut: run });
    expect(result.action).toBe('pause');
    expect(run).not.toHaveBeenCalled();
  });

  it('resolves on an autonomous axis and records the decision', () => {
    const result = resolveBreakpoint({
      posture: 'autonomous',
      question: 'q',
      runFigureItOut: success,
    });
    expect(result.action).toBe('resolved');
    if (result.action === 'resolved') {
      expect(result.record.pick).toBe('use date-fns');
      expect(result.record.question).toBe('q');
    }
  });
});

describe('resolveBreakpoint fail-safe', () => {
  it('retries once then defers on repeated transient error', () => {
    const run = vi
      .fn()
      .mockReturnValueOnce({ outcome: 'transient-error' })
      .mockReturnValueOnce({ outcome: 'transient-error' });
    const result = resolveBreakpoint({ posture: 'autonomous', question: 'q', runFigureItOut: run });
    expect(run).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('defer');
  });

  it('succeeds on the retry after a single transient error', () => {
    const run = vi
      .fn()
      .mockReturnValueOnce({ outcome: 'transient-error' })
      .mockReturnValueOnce({ outcome: 'success', decision: 'retry won' });
    const result = resolveBreakpoint({ posture: 'autonomous', question: 'q', runFigureItOut: run });
    expect(run).toHaveBeenCalledTimes(2);
    expect(result.action).toBe('resolved');
  });

  it('defers immediately on an inconclusive verdict without retrying', () => {
    const run = vi.fn(() => ({ outcome: 'inconclusive' as const }));
    const result = resolveBreakpoint({ posture: 'autonomous', question: 'q', runFigureItOut: run });
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.action).toBe('defer');
  });
});

describe('resolveBreakpoint denylist overrides posture', () => {
  it('pauses for a denylisted action even when the axis is autonomous', () => {
    const run = vi.fn();
    const result = resolveBreakpoint({
      posture: 'autonomous',
      question: 'q',
      action: 'git-push',
      runFigureItOut: run,
    });
    expect(result.action).toBe('pause');
    expect(run).not.toHaveBeenCalled();
  });
});
