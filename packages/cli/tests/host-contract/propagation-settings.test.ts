import assert from 'node:assert/strict';

import { expect, it } from 'vitest';

import { runArchitectureSettings } from '../../scripts/lib/propagation-settings.js';
import type {
  PolicyObservation,
  RetainedPolicyActor,
} from '../../scripts/lib/resource-propagation.js';
import combinations from '../fixtures/host-contract/documented-option-composition.json';

// Orchestration/grading doubles ONLY; this file supplies no guard or native proof.
it.each(['healthy', 'wrong', 'missing', 'identity', 'empty', 'replacement', 'protocol'] as const)(
  'grades six documented architecture composition inputs: %s',
  async fault => {
    const seen: unknown[] = [];
    const originals: PolicyObservation[] = [];
    const actor: RetainedPolicyActor = {
      observeVerification(evidence, setup, setting) {
        expect(evidence).toBe('ordinary valid verification');
        expect(setup).toBe(evidence);
        assert.ok(setting);
        expect(setting.kind).toBe('architecture-review');
        seen.push(setting.options);
        const enabled = setting.options.architectureReviewGate;
        const observed: PolicyObservation = {
          protocol: 'stop-json',
          observation: {
            installation: fault === 'replacement' && seen.length === 2 ? 'other' : 'retained',
            raw: fault === 'missing' ? '' : 'qualified process-edge raw',
            decisions:
              enabled && fault !== 'wrong'
                ? [{ decision: 'block', reason: 'missing cited evidence' }]
                : [{}],
            ticket: 'type: feature\nphase: verify\nstatus: in_progress',
            configuration: {
              path: '/owned/workspace/.safeword/config.json',
              bytes: JSON.stringify(setting.options),
            },
          },
        };
        const unavailable: Partial<Record<typeof fault, Partial<typeof observed.observation>>> = {
          identity: { installation: '' },
          empty: { decisions: [] },
        };
        Object.assign(observed.observation, unavailable[fault]);
        if (fault === 'protocol') Object.assign(observed, { protocol: 'permission-json' });
        originals.push(observed);
        return Promise.resolve(observed);
      },
      refreshResources() {
        throw new Error('settings must not replace installation');
      },
      observe() {
        throw new Error('resource observation is a separate phase');
      },
      fingerprint() {
        throw new Error('not a settings outcome');
      },
    };
    const result = await runArchitectureSettings(actor, 'ordinary valid verification');
    expect(seen).toEqual(combinations);
    const expected = {
      healthy: 0,
      wrong: 2,
      missing: 3,
      identity: 3,
      empty: 3,
      replacement: 2,
      protocol: 3,
    }[fault];
    expect(result.exit).toBe(expected);
    for (const [index, row] of result.observations.entries()) expect(row).toBe(originals[index]);
    expect(result.admission_eligible).toBe(false);
  },
);
