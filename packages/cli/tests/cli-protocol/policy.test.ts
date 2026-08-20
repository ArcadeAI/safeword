import { describe, expect, it, vi } from 'vitest';

import { commandCatalog } from '../../src/cli-protocol/catalog.js';
import {
  assertEffectPolicy,
  consumeManagedProgressSignal,
  createBestEffortByteSink,
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
    const missingSignalEnvironment: Record<string, string> = {};
    expect(consumeManagedProgressSignal(missingSignalEnvironment)).toBe(false);
    expect(missingSignalEnvironment).not.toHaveProperty('SAFEWORD_REVIEW_PROGRESS');

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

  it('keeps human progress unchanged while consuming the private signal', () => {
    const environment = { SAFEWORD_REVIEW_PROGRESS: '1' };

    expect(consumeManagedProgressSignal(environment)).toBe(true);
    expect(environment).not.toHaveProperty('SAFEWORD_REVIEW_PROGRESS');
    expect(shouldReportProgress({ json: false, managedReview: false, quiet: false })).toBe(true);
  });

  it.each([
    { failureIndex: 0, error: 'EBADF' },
    { failureIndex: 1, error: 'EPIPE' },
  ])(
    'keeps descriptor write failures best-effort and retries later writes: $error at write $failureIndex',
    ({ failureIndex, error }) => {
      const writes: string[] = [];
      const write = vi.fn<(buffer: Uint8Array, offset: number, length: number) => number>(
        (buffer, offset, length) => {
          if (write.mock.calls.length - 1 === failureIndex) throw new Error(error);
          writes.push(Buffer.from(buffer.subarray(offset, offset + length)).toString());
          return length;
        },
      );
      const emit = createBestEffortProgressSink(write);

      expect(() => {
        emit('first');
        emit('second');
      }).not.toThrow();
      expect(write).toHaveBeenCalledTimes(2);
      expect(writes).toEqual(failureIndex === 0 ? ['second\n'] : ['first\n']);
    },
  );

  it('retries short descriptor writes synchronously without reordering UTF-8 progress', () => {
    const written: Buffer[] = [];
    const write = vi.fn((buffer: Uint8Array, offset: number, length: number) => {
      const chunkLength = Math.min(length, 2);
      written.push(Buffer.from(buffer.subarray(offset, offset + chunkLength)));
      return chunkLength;
    });
    const emit = createBestEffortProgressSink(write);

    emit('A→B');
    emit('next');

    expect(Buffer.concat(written).toString()).toBe('A→B\nnext\n');
    expect(write.mock.calls.length).toBeGreaterThan(2);
  });

  it('forwards raw byte chunks exactly without adding line framing', () => {
    const written: Buffer[] = [];
    const writeBytes = createBestEffortByteSink((buffer, offset, length) => {
      const chunkLength = Math.min(length, 2);
      written.push(Buffer.from(buffer.subarray(offset, offset + chunkLength)));
      return chunkLength;
    });

    writeBytes(Buffer.from('partial'));
    writeBytes(Buffer.from(' bytes'));

    expect(Buffer.concat(written).toString()).toBe('partial bytes');
  });

  it('abandons an invalid short-write result without spinning or blocking later progress', () => {
    const write = vi
      .fn<(buffer: Uint8Array, offset: number, length: number) => number>()
      .mockReturnValueOnce(0)
      .mockImplementation((_buffer, _offset, length) => length);
    const emit = createBestEffortProgressSink(write);

    emit('stalled');
    emit('later');

    expect(write).toHaveBeenCalledTimes(2);
  });

  it('marks managed JSON progress without changing lifecycle forwarding', () => {
    const progress = { start: vi.fn(), heartbeat: vi.fn(), stop: vi.fn() };
    const managed = createManagedReviewProgress(progress);

    managed.start('Requesting an independent Codex review…');
    managed.heartbeat?.('Still waiting for a response from Codex…');
    managed.stop();

    expect(managed.managed).toBe(true);
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

  it('names network effects without truncating the effect class', () => {
    const result = createResult({
      state: 'action_required',
      effects: { network: [{ kind: 'request', target: 'registry.npmjs.org' }] },
    });

    expect(() => {
      assertEffectPolicy({ ...definition('status'), networkPolicy: 'declared' }, result, {
        offline: false,
      });
    }).toThrow(/observe command status reported network effects/);
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

  it('cancels a previous stage heartbeat when a new stage starts', () => {
    const cancel = vi.fn();
    let nextHandle = 0;
    const progress = createProgressReporter({
      schedule: () => (nextHandle += 1),
      cancel,
      emit: vi.fn(),
    });

    progress.heartbeat?.('Still waiting for the preferred reviewer…');
    progress.start('Requesting the alternate reviewer…');

    expect(cancel).toHaveBeenCalledWith(1);
  });

  it('ignores a heartbeat interval override that is not a positive value under the default', () => {
    for (const value of ['0', '-5', 'soon', '', '30001', '1.5']) {
      expect(
        resolveHeartbeatIntervalMs({ NODE_ENV: 'test', SAFEWORD_PROGRESS_HEARTBEAT_MS: value }),
      ).toBe(30_000);
    }
    expect(resolveHeartbeatIntervalMs({})).toBe(30_000);
    expect(
      resolveHeartbeatIntervalMs({ NODE_ENV: 'test', SAFEWORD_PROGRESS_HEARTBEAT_MS: '250' }),
    ).toBe(250);
    expect(
      resolveHeartbeatIntervalMs({ NODE_ENV: 'production', SAFEWORD_PROGRESS_HEARTBEAT_MS: '1' }),
    ).toBe(30_000);
  });
});
