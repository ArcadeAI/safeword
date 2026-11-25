import { expect, it } from 'vitest';

import { runDesignApprovalSettings } from '../../scripts/lib/propagation-settings.js';
import type {
  ExitStatusDesignApprovalObservation,
  RetainedPolicyActor,
} from '../../scripts/lib/resource-propagation.js';
import combinations from '../fixtures/host-contract/documented-option-composition.json';

// Orchestration doubles only; installed OpenCode dispatch is exercised separately.
it.each([
  ['healthy', 0],
  ['mutated request', 2],
  ['wrong status', 2],
  ['wrong reason', 2],
  ['wrong effect', 2],
  ['missing dispatch', 3],
  ['duplicate dispatch', 3],
  ['failed dispatch', 3],
  ['missing identity', 3],
] as const)('grades OpenCode design callback facts: %s', async (fault, exit) => {
  const originals: ExitStatusDesignApprovalObservation[] = [];
  const oracle = JSON.stringify(combinations);
  const actor = {
    fingerprint: () => ({ resources: ['workflow', 'guide', 'helper'], policy: 'policy' }),
    observeDesignApproval: options => {
      if (fault === 'mutated request') options.designApprovalGate = false;
      const actual = designDouble(options);
      changeDispatch(fault, actual);
      originals.push(actual);
      return Promise.resolve(actual);
    },
  } satisfies Pick<RetainedPolicyActor, 'fingerprint' | 'observeDesignApproval'>;
  const grade = await runDesignApprovalSettings(actor as RetainedPolicyActor);
  expect(grade.exit).toBe(exit);
  expect(grade.observations).toHaveLength(6);
  for (const [index, actual] of grade.observations.entries()) expect(actual).toBe(originals[index]);
  if (fault === 'mutated request')
    expect(grade.failures).toEqual(
      [1, 2, 5].map(index => `PROPAGATION_DESIGN_SETTING:${index}:MISMATCH`),
    );
  else if (fault === 'missing dispatch')
    expect(grade.failures).toEqual(
      [0, 1, 2, 3, 4, 5].map(index => `PROPAGATION_DESIGN_SETTING:${index}:UNOBSERVED`),
    );
  expect(JSON.stringify(combinations)).toBe(oracle);
});

function designDouble(
  options: NonNullable<(typeof combinations)[0]>,
): ExitStatusDesignApprovalObservation {
  const enabled = options.designApprovalGate;
  return {
    protocol: 'exit-status',
    observation: {
      installation: 'same-installation',
      raw: 'orchestration-double',
      configuration: { path: '/unit/config.json', bytes: JSON.stringify(options) },
      observations: [
        {
          status: enabled ? 2 : 0,
          stdout: '',
          stderr: enabled ? 'design approval requires approve-plan' : '',
        },
      ],
      before: 'plan-implementation',
      expectedEffect: 'plan-execution',
      effect: enabled ? 'plan-implementation' : 'plan-execution',
    },
  };
}
function changeDispatch(fault: string, actual: ExitStatusDesignApprovalObservation) {
  const o = actual.observation;
  const row = o.observations[0];
  if (!row) throw new Error('Double lacks its initial dispatch');
  switch (fault) {
    case 'wrong status': {
      row.status = 2 - Number(row.status);
      break;
    }
    case 'wrong reason': {
      row.stderr = 'unrelated reason';
      break;
    }
    case 'wrong effect': {
      o.effect = o.effect === o.before ? o.expectedEffect : o.before;
      break;
    }
    case 'missing dispatch': {
      o.observations = [];
      break;
    }
    case 'duplicate dispatch': {
      o.observations = [row, row];
      break;
    }
    case 'failed dispatch': {
      row.status = 1;
      break;
    }
    case 'missing identity': {
      o.installation = '';
      break;
    }
  }
}
