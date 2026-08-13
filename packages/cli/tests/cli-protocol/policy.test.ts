import { describe, expect, it, vi } from 'vitest';

import { commandCatalog } from '../../src/cli-protocol/catalog.js';
import {
  assertEffectPolicy,
  consumeManagedProgressSignal,
  createBestEffortProgressSink,
  createManagedReviewProgress,
  createProgressReporter,
  resolveHeartbeatIntervalMs,
  shouldReportProgress,
} from '../../src/cli-protocol/policy.js';
import { createResult } from '../../src/cli-protocol/result.js';

function definition(name: string) {
  const match = commandCatalog.find(
    command => command.name === name && command.classification !== 'internal',
  );
  if (match === undefined) throw new Error(`Missing ${name}`);
  return match;
}

describe('CLI execution policy', () => {
  it('consumes only the exact managed-progress signal and always removes it', () => {
    for (const [value, expected] of [
      ['1', true],
      [' ', false],
      ['0', false],
      ['01', false],
      ['1 ', false],
      ['TRUE', false],
      ['true', false],
      ['false', false],
      ['', false],
    ] as const) {
      const environment = { SAFEWORD_REVIEW_PROGRESS: value };
      expect(consumeManagedProgressSignal(environment)).toBe(expected);
      expect(environment).not.toHaveProperty('SAFEWORD_REVIEW_PROGRESS');
    }
  });

  it('reports JSON progress only for an opted-in managed review and never in quiet mode', () => {
    expect(shouldReportProgress({ json: true, managedReview: true, quiet: false })).toBe(true);
    expect(shouldReportProgress({ json: true, managedReview: false, quiet: false })).toBe(false);
    expect(shouldReportProgress({ json: false, managedReview: false, quiet: false })).toBe(true);
    expect(shouldReportProgress({ json: true, managedReview: true, quiet: true })).toBe(false);
  });

  it('keeps descriptor write failures best-effort and retries later writes', () => {
    const write = vi
      .fn<(message: string) => void>()
      .mockImplementationOnce(() => {
        throw new Error('EBADF');
      })
      .mockImplementation(() => {});
    const emit = createBestEffortProgressSink(write);

    expect(() => {
      emit('first');
    }).not.toThrow();
    expect(() => {
      emit('second');
    }).not.toThrow();
    expect(write).toHaveBeenNthCalledWith(1, 'first\n');
    expect(write).toHaveBeenNthCalledWith(2, 'second\n');
  });

  it('suppresses packet preparation only for managed JSON progress', () => {
    const progress = { start: vi.fn(), heartbeat: vi.fn(), stop: vi.fn() };
    const managed = createManagedReviewProgress(progress);

    managed.start('Preparing the review packet for quality review…');
    managed.start('Requesting an independent Codex review…');
    managed.heartbeat?.('Still waiting for a response from Codex…');
    managed.stop();

    expect(progress.start).toHaveBeenCalledTimes(1);
    expect(progress.start).toHaveBeenCalledWith('Requesting an independent Codex review…');
    expect(progress.heartbeat).toHaveBeenCalledTimes(1);
    expect(progress.stop).toHaveBeenCalledTimes(1);
  });

  it('rejects effects from an observe command', () => {
    const result = createResult({
      state: 'healthy',
      effects: { files: [{ kind: 'write', target: 'unexpected' }] },
    });

    expect(() => {
      assertEffectPolicy(definition('status'), result, { offline: false });
    }).toThrow(/observe command status reported file effects/);
  });

  it('rejects network effects in offline mode', () => {
    const result = createResult({
      state: 'action_required',
      effects: { network: [{ kind: 'request', target: 'registry.npmjs.org' }] },
    });

    expect(() => {
      assertEffectPolicy(definition('setup'), result, { offline: true });
    }).toThrow(/offline/);
  });

  it('rejects completed effects from a plan command', () => {
    const result = createResult({
      state: 'action_required',
      effects: { files: [{ kind: 'write', target: 'unexpected' }] },
    });

    expect(() => {
      assertEffectPolicy(definition('plan'), result, { offline: false });
    }).toThrow(/plan command plan reported file effects/);
  });

  it('allows a declared mutating result online', () => {
    const result = createResult({
      state: 'changed',
      effects: { files: [{ kind: 'write', target: '.safeword/version' }] },
    });

    expect(() => {
      assertEffectPolicy(definition('setup'), result, { offline: false });
    }).not.toThrow();
  });

  it('reports meaningful progress at 100ms using an injected scheduler', () => {
    let scheduled: (() => void) | undefined;
    let scheduledDelay: number | undefined;
    const emit = vi.fn();
    const progress = createProgressReporter({
      schedule: (callback, delay) => {
        scheduled = callback;
        scheduledDelay = delay;
        return 1;
      },
      cancel: vi.fn(),
      emit,
    });

    progress.start('Applying the confirmed plan…');
    expect(scheduledDelay).toBe(100);
    expect(emit).not.toHaveBeenCalled();
    scheduled?.();
    expect(emit).toHaveBeenCalledWith('Applying the confirmed plan…');
    progress.stop();
  });

  it('keeps a long-running operation visibly alive without claiming completion progress', () => {
    const scheduled = new Map<number, () => void>();
    const delays = new Map<number, number>();
    const emit = vi.fn();
    const cancel = vi.fn();
    let nextHandle = 0;
    const progress = createProgressReporter({
      schedule: (callback, delay) => {
        nextHandle += 1;
        scheduled.set(nextHandle, callback);
        delays.set(nextHandle, delay);
        return nextHandle;
      },
      cancel,
      emit,
    });

    progress.heartbeat?.('Still waiting for a response from Codex…');
    expect(delays.get(1)).toBe(30_000);
    scheduled.get(1)?.();
    expect(emit).toHaveBeenCalledWith('Still waiting for a response from Codex…');
    expect(delays.get(2)).toBe(30_000);

    progress.stop();
    expect(cancel).toHaveBeenCalledWith(2);
  });

  it('cancels a pending announcement as well as the heartbeat when the command ends', () => {
    const emit = vi.fn();
    const cancel = vi.fn();
    let nextHandle = 0;
    const progress = createProgressReporter({
      schedule: () => {
        nextHandle += 1;
        return nextHandle;
      },
      cancel,
      emit,
    });

    progress.start('Requesting an independent Codex review…');
    progress.heartbeat?.('Still waiting for a response from Codex…');
    progress.stop();

    expect(cancel).toHaveBeenCalledWith(1);
    expect(cancel).toHaveBeenCalledWith(2);
    expect(emit).not.toHaveBeenCalled();
  });

  it('ignores a heartbeat interval override that is not a positive value under the default', () => {
    for (const value of ['0', '-5', 'soon', '', '30001', '1.5']) {
      expect(resolveHeartbeatIntervalMs({ SAFEWORD_PROGRESS_HEARTBEAT_MS: value })).toBe(30_000);
    }
    expect(resolveHeartbeatIntervalMs({})).toBe(30_000);
    expect(resolveHeartbeatIntervalMs({ SAFEWORD_PROGRESS_HEARTBEAT_MS: '250' })).toBe(250);
  });
});
