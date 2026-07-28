import { describe, expect, it, vi } from 'vitest';

import { commandCatalog } from '../../src/cli-protocol/catalog.js';
import { assertEffectPolicy, createProgressReporter } from '../../src/cli-protocol/policy.js';
import { createResult } from '../../src/cli-protocol/result.js';

function definition(name: string) {
  const match = commandCatalog.find(command => command.name === name && command.public);
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
    const emit = vi.fn();
    const progress = createProgressReporter({
      schedule: callback => {
        scheduled = callback;
        return 1;
      },
      cancel: vi.fn(),
      emit,
    });

    progress.start('Applying the confirmed plan…');
    expect(emit).not.toHaveBeenCalled();
    scheduled?.();
    expect(emit).toHaveBeenCalledWith('Applying the confirmed plan…');
    progress.stop();
  });
});
