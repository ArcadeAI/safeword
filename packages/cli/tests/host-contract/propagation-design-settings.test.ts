import { expect, it } from 'vitest';

import { runDesignApprovalSettings } from '../../scripts/lib/propagation-settings.js';
import type {
  DesignApprovalObservation,
  RetainedPolicyActor,
} from '../../scripts/lib/resource-propagation.js';
import combinations from '../fixtures/host-contract/documented-option-composition.json';

// Orchestration doubles ONLY: these are not native dispatch/guard evidence.
it.each([
  ['healthy', 0],
  ['mutated request', 2],
  ['wrong permission', 2],
  ['wrong reason', 2],
  ['denied effect', 2],
  ['allowed effect missing', 2],
  ['missing raw', 3],
  ['missing identity', 3],
  ['replacement', 2],
  ['payload changed', 2],
] as const)('grades six pre-action design settings: %s', async (fault, exit) => {
  const originals: DesignApprovalObservation[] = [];
  const before = JSON.stringify(combinations);
  let turns = 0;
  const actor = {
    fingerprint: () => ({
      resources: ['workflow', 'guide', 'helper'],
      policy: fault === 'payload changed' && turns ? 'changed' : 'policy',
    }),
    observeDesignApproval(options) {
      if (fault === 'mutated request') options.designApprovalGate = false;
      const enabled = options.designApprovalGate;
      const actual: DesignApprovalObservation = {
        protocol: 'pre-tool-json',
        observation: {
          installation: 'same-owned-package',
          raw: 'unit-double-only',
          configuration: { path: '/unit/config.json', bytes: JSON.stringify(options) },
          decision: enabled
            ? {
                hookSpecificOutput: {
                  hookEventName: 'PreToolUse',
                  permissionDecision: 'deny',
                  permissionDecisionReason: 'design approval requires approve-plan',
                },
              }
            : {},
          before: 'plan-implementation',
          expectedEffect: 'plan-execution',
          effect: enabled ? 'plan-implementation' : 'plan-execution',
        },
      };
      const o = actual.observation;
      changeDecision(fault, o, enabled);
      changeIdentity(fault, o, turns);
      turns++;
      originals.push(actual);
      return Promise.resolve(actual);
    },
  } satisfies Pick<RetainedPolicyActor, 'fingerprint' | 'observeDesignApproval'>;
  const grade = await runDesignApprovalSettings(actor as RetainedPolicyActor);
  expect(grade.exit).toBe(exit);
  expect(grade.observations).toHaveLength(6);
  for (const [index, observed] of grade.observations.entries())
    expect(observed).toBe(originals[index]);
  expect(JSON.stringify(combinations)).toBe(before);
  const exactFailures: Partial<Record<typeof fault, string[]>> = {
    'mutated request': [
      'PROPAGATION_DESIGN_SETTING:1:MISMATCH',
      'PROPAGATION_DESIGN_SETTING:2:MISMATCH',
      'PROPAGATION_DESIGN_SETTING:5:MISMATCH',
    ],
    'missing identity': [
      'PROPAGATION_DESIGN_SETTING:0:UNOBSERVED',
      'PROPAGATION_DESIGN_SETTING:1:UNOBSERVED',
      'PROPAGATION_DESIGN_SETTING:2:UNOBSERVED',
      'PROPAGATION_DESIGN_SETTING:3:UNOBSERVED',
      'PROPAGATION_DESIGN_SETTING:4:UNOBSERVED',
      'PROPAGATION_DESIGN_SETTING:5:UNOBSERVED',
    ],
    healthy: [],
  };
  const exact = exactFailures[fault];
  if (exact) expect(grade.failures).toEqual(exact);
});

function changeDecision(
  fault: string,
  o: DesignApprovalObservation['observation'],
  enabled: boolean,
) {
  if (fault === 'wrong permission') o.decision = {};
  const decision = o.decision.hookSpecificOutput;
  if (fault === 'wrong reason' && decision) decision.permissionDecisionReason = 'unrelated';
  else if (fault === 'denied effect' && enabled) o.effect = o.expectedEffect;
  else if (fault === 'allowed effect missing' && !enabled) o.effect = o.before;
}
function changeIdentity(fault: string, o: DesignApprovalObservation['observation'], turns: number) {
  if (fault === 'missing raw') o.raw = '';
  else if (fault === 'missing identity') o.installation = '';
  else if (fault === 'replacement' && turns) o.installation = 'replacement';
}
