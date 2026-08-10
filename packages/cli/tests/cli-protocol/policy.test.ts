import { describe, expect, it, vi } from 'vitest';

import { commandCatalog } from '../../src/cli-protocol/catalog.js';
import {
  assertEffectPolicy,
  createProgressReporter,
  resolveHeartbeatIntervalMs,
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
