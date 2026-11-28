import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

import { policyCompletion } from '../../scripts/lib/propagation-policy-grade.js';
import { PropagationOutcomeError } from '../../scripts/lib/propagation-policy-phases.js';
import * as propagation from '../../scripts/lib/resource-propagation.js';
import { prepareNativeResourceActor } from '../../scripts/lib/resource-propagation-run.js';
import hostReleases from '../../src/lifecycle/host-releases.json' with { type: 'json' };
import type { CanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { createCanonicalCatalogueInputs } from '../helpers/native-catalogue-probe.js';
import { requirePropagationVerificationMarker } from '../helpers/propagation-source.js';

// Orchestration doubles ONLY: no guard or native proof. Revisions are retained
// state, so omitting refresh actually leaves a lane stale rather than faking a row.
async function runUnitJoin(fault = 'none') {
  const before = {
    canonicalRoot: 'baseline',
    workflowMarker: 'A',
    guideMarker: 'A',
    helperMarker: 'A',
  };
  const policy = { ...before, canonicalRoot: 'policy' };
  const current = {
    ...before,
    canonicalRoot: 'current',
    workflowMarker: 'B',
    guideMarker: 'B',
    helperMarker: 'B',
  };
  const prepared: string[] = [];
  const seen: propagation.PolicyObservation[] = [];
  const calls: { lane: string; evidence: string; setup: string }[] = [];
  const result = await propagation.runResourcePropagation(
    before,
    current,
    (lane, initial) => {
      prepared.push(lane.id);
      let revision = initial;
      let resourceCalls = 0;
      let policyCalls = 0;
      return Promise.resolve({
        refreshResources: (next: CanonicalCatalogueInputs) => {
          revision = next;
          return Promise.resolve();
        },
        observe: () => {
          resourceCalls++;
          const markers = { ...revision };
          let delivery = lane.delivery;
          const heldLane = lane.id === propagation.propagationLanes().at(-1)?.id;
          if (fault === 'baselineStale' && resourceCalls === 1) markers.workflowMarker = 'stale';
          if (heldLane && resourceCalls === 2) {
            if (fault === 'heldCurrent') Object.assign(markers, current);
            else if (fault === 'heldWrongDelivery') delivery = 'unit-foreign-delivery';
          }
          if (fault === 'repairStale' && resourceCalls === 3) markers.workflowMarker = 'stale';
          return Promise.resolve({
            installation: lane.id,
            delivery,
            raw: 'unit-resource',
            markers,
          });
        },
        fingerprint: () => unitFingerprint(revision, fault),
        observeVerification: (evidence: string, setup: string) => {
          const phase = policyPhases[policyCalls++];
          calls.push({ lane: lane.id, evidence, setup });
          const denied = !(
            evidence.includes('VERIFICATION_ab') || revision.canonicalRoot === 'baseline'
          );
          const faulty = lane.id === prepared[0] && fault.startsWith(`${phase}:`);
          const observed = unitPolicy(lane, faulty && fault.endsWith(':wrong') ? !denied : denied);
          if (faulty && fault.endsWith(':missing')) observed.observation.raw = '';
          if (revision.canonicalRoot === 'policy') applyUnitFault(fault, observed);
          seen.push(observed);
          return Promise.resolve(observed);
        },
      });
    },
    { inputs: policy, marker: 'VERIFICATION_ab' },
  );
  return { result, prepared, seen, calls };
}

it('runs policy and resource phases on the same seven retained actors', async () => {
  const { result, prepared, seen, calls } = await runUnitJoin();
  expect(prepared).toEqual(propagation.propagationLanes().map(lane => lane.id));
  expect(result.exit, 'PROPAGATION_POLICY_RESOURCE_JOIN_MISSING').toBe(0);
  expect(result.policy?.changed).toHaveLength(7);
  expect(result.rejected).toEqual({
    exit: 2,
    failures: [`PROPAGATION_RESOURCE_STALE:${prepared.at(-1)}`],
  });
  expect(result.policy?.changed[0]?.observed.observation.raw).toBe('unit-policy');
  expect(result.policy?.changed[0]?.observed).toBe(seen[7]);
  const scope = '**PR Scope:** ✅ Synthetic fixture matches its scope\n';
  const valid = `${scope}\nVERIFICATION_ab\n`;
  const pairs = [
    [scope, scope],
    [scope, valid],
    [valid, valid],
    [scope, valid],
    [valid, valid],
  ];
  expect(calls).toEqual(
    pairs.flatMap(([evidence, setup]) => prepared.map(lane => ({ lane, evidence, setup }))),
  );
});

const policyPhases = ['baseline', 'changed', 'repaired', 'finalDenied', 'finalAllowed'] as const;
it.each(
  policyPhases.flatMap(phase => (['wrong', 'missing'] as const).map(kind => ({ phase, kind }))),
)(
  'rejects $kind observation in $phase through the controller with original carriers',
  async ({ phase, kind }) => {
    const { result, prepared, seen } = await runUnitJoin(`${phase}:${kind}`);
    expect(result.exit).toBe(kind === 'wrong' ? 2 : 3);
    expect(result.failures).toEqual([
      `PROPAGATION_POLICY_${kind === 'wrong' ? 'MISMATCH' : 'UNOBSERVED'}:${prepared[0]}`,
    ]);
    expect(result.baseline).toHaveLength(7);
    const index = policyPhases.indexOf(phase);
    const completedPhases = policyPhases.slice(0, index + 1);
    for (const prior of completedPhases) expect(result.policy?.[prior]).toHaveLength(7);
    expect(result.policy?.[phase][0]?.observed).toBe(seen[index * 7]);
  },
);

it.each(['heldCurrent', 'heldWrongDelivery', 'repairStale', 'baselineStale'])(
  'rejects the %s resource-cycle fault through the joined controller',
  async fault => {
    const { result } = await runUnitJoin(fault);
    const lanes = propagation.propagationLanes();
    const stale = (lane: string) => `PROPAGATION_RESOURCE_STALE:${lane}`;
    const expected = {
      heldCurrent: { exit: 2, failures: ['STALE_PROPAGATION_LANE_ACCEPTED'] },
      heldWrongDelivery: {
        exit: 3,
        failures: [`PROPAGATION_DELIVERY_UNOBSERVED:${lanes.at(-1)?.id}`],
      },
      repairStale: { exit: 2, failures: lanes.map(lane => stale(lane.id)) },
      baselineStale: { exit: 2, failures: lanes.map(lane => stale(lane.id)) },
    }[fault];
    expect(result.exit).toBe(expected?.exit);
    expect(result.failures).toEqual(expected?.failures);
  },
);

function unitFingerprint(revision: CanonicalCatalogueInputs, fault: string) {
  let resource = revision.workflowMarker === 'A' ? 'a' : 'b';
  let policy = revision.canonicalRoot === 'baseline' ? 'a' : 'b';
  let partial = false;
  switch (`${revision.canonicalRoot}:${fault}`) {
    case 'policy:policyResources': {
      resource = 'b';
      break;
    }
    case 'policy:policyStale': {
      policy = 'a';
      break;
    }
    case 'current:resourcePolicy': {
      policy = 'a';
      break;
    }
    case 'current:resourceStale': {
      partial = true;
      break;
    }
  }
  return {
    resources: [partial ? 'a' : resource, resource, resource].map(value => value.repeat(64)),
    policy: policy.repeat(64),
  };
}

function applyUnitFault(fault: string, observed: propagation.PolicyObservation) {
  switch (fault) {
    case 'identity': {
      observed.observation.installation = 'foreign';
      break;
    }
    case 'unknown': {
      throw new Error('unit unavailable');
    }
    case 'forged': {
      throw Object.assign(new Error('unit forged'), { grade: { exit: 0, failures: [] } });
    }
    case 'owned': {
      throw new PropagationOutcomeError({ exit: 2, failures: ['UNIT_OWNED_FAILURE'] });
    }
  }
}

it.each([
  ['policyResources', 2, 'PROPAGATION_POLICY_CHANGED_RESOURCES:'],
  ['policyStale', 2, 'PROPAGATION_POLICY_BYTES_STALE:'],
  ['resourcePolicy', 2, 'PROPAGATION_RESOURCES_CHANGED_POLICY:'],
  ['resourceStale', 2, 'PROPAGATION_RESOURCE_BYTES_STALE:'],
  ['identity', 2, 'PROPAGATION_INSTALLATION_REPLACED:'],
  ['unknown', 3, 'Error: unit unavailable'],
  ['forged', 3, 'Error: unit forged'],
  ['owned', 2, 'UNIT_OWNED_FAILURE'],
] as const)(
  'rejects the %s controller fault without losing baseline carriers',
  async (fault, exit, failure) => {
    const { result, prepared } = await runUnitJoin(fault);
    expect(result.exit).toBe(exit);
    const named = failure.endsWith(':') ? `${failure}${prepared[0]}` : failure;
    expect(result.failures).toEqual([named]);
    expect(result.baseline).toHaveLength(7);
    expect(result.policy?.baseline).toHaveLength(7);
  },
);

function unitPolicy(
  lane: propagation.PropagationLane,
  denied: boolean,
): Exclude<propagation.PolicyObservation, { protocol: 'cursor-stop' }> {
  const base = { installation: lane.id, raw: 'unit-policy' };
  if (['claude', 'codex'].includes(lane.agent))
    return {
      protocol: 'stop-json',
      observation: {
        ...base,
        decisions: denied
          ? [
              {
                decision: 'block',
                reason: 'PROPAGATION_VERIFICATION_MARKER_REQUIRED:VERIFICATION_ab',
              },
            ]
          : [{}],
        ticket: `status: ${denied ? 'in_progress' : 'done'}`,
      },
    };
  const effect = {
    ...base,
    effect: denied ? undefined : 'unit-effect',
    expectedEffect: 'unit-effect',
  };
  if (lane.agent === 'opencode')
    return {
      protocol: 'exit-status',
      observation: {
        ...effect,
        observations: [
          {
            status: denied ? 2 : 0,
            stdout: '',
            stderr: denied ? 'invalid verification evidence' : '',
          },
        ],
      },
    };
  return {
    protocol: 'permission-json',
    observation: {
      ...effect,
      decision: denied
        ? { permission: 'deny', user_message: 'invalid verification evidence' }
        : { permission: 'allow' },
      afterShellCount: denied ? 0 : 1,
    },
  };
}

it.each([false, true])(
  'grades distinct observed protocols, denying=%s, without accepting missing or duplicate rows',
  denied => {
    const lanes = propagation.propagationLanes();
    const rows = lanes.map(lane => ({ lane: lane.id, observed: unitPolicy(lane, denied) }));
    expect(policyCompletion(lanes, rows, denied, 'VERIFICATION_ab')).toEqual({
      exit: 0,
      failures: [],
    });
    expect(policyCompletion(lanes, rows.slice(1), denied, 'VERIFICATION_ab').exit).toBe(3);
    const first = rows[0];
    assert.ok(first);
    expect(policyCompletion(lanes, [...rows, first], denied, 'VERIFICATION_ab').exit).toBe(3);
    for (const lane of lanes) {
      const wrong = rows.map(row =>
        row.lane === lane.id ? { lane: lane.id, observed: unitPolicy(lane, !denied) } : row,
      );
      expect(policyCompletion(lanes, wrong, denied, 'VERIFICATION_ab')).toEqual({
        exit: 2,
        failures: [`PROPAGATION_POLICY_MISMATCH:${lane.id}`],
      });
    }
  },
);

it('reads installed resource and shared-policy bytes through the concrete factory', async () => {
  const root = mkdtempSync('/tmp/propagation-byte-factory-');
  try {
    const binary = nodePath.join(root, 'vendor');
    writeFileSync(
      binary,
      `#!/bin/sh\n[ "$1" = --version ] || exit 91\necho ${hostReleases.cursorCli.version}\n`,
      { mode: 0o755 },
    );
    const before = createCanonicalCatalogueInputs(root);
    const lane = propagation
      .propagationLanes()
      .find(row => row.agent === 'cursor' && row.runtime === 'CLI');
    assert.ok(lane);
    const actor = await prepareNativeResourceActor(lane, before, { binary }, root);
    const baseline = actor.fingerprint();
    requirePropagationVerificationMarker(before, 'VERIFICATION_ab');
    await actor.refreshResources(before);
    const policy = actor.fingerprint();
    expect(policy.resources).toEqual(baseline.resources);
    expect(policy.policy).not.toBe(baseline.policy);
    const nextRoot = nodePath.join(root, 'next');
    mkdirSync(nextRoot);
    const current = createCanonicalCatalogueInputs(nextRoot);
    cpSync(
      nodePath.join(before.canonicalRoot, 'hooks/lib/done-gate.ts'),
      nodePath.join(current.canonicalRoot, 'hooks/lib/done-gate.ts'),
    );
    await actor.refreshResources(current);
    const revised = actor.fingerprint();
    expect(revised.policy).toBe(policy.policy);
    expect(revised.resources.every((hash, index) => hash !== policy.resources[index])).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

it('distinguishes missing records from observed wrong reasons, effects and IDE dispatch counts', () => {
  for (const lane of propagation.propagationLanes()) {
    const observed = unitPolicy(lane, true);
    const grade = () =>
      policyCompletion([lane], [{ lane: lane.id, observed }], true, 'VERIFICATION_ab').exit;
    observed.observation.raw = '';
    expect(grade()).toBe(3);
    observed.observation.raw = 'unit-policy';
    if (observed.protocol === 'stop-json') {
      observed.observation.decisions = [{ decision: 'block', reason: 'unrelated' }];
      expect(grade()).toBe(2);
      observed.observation.decisions = [];
      expect(grade()).toBe(3);
    } else if (observed.protocol === 'exit-status') {
      observed.observation.observations = [{ status: 2, stdout: '', stderr: 'unrelated' }];
      expect(grade()).toBe(2);
      observed.observation.observations = [{ status: 7, stdout: '', stderr: '' }];
      expect(grade()).toBe(3);
    } else {
      observed.observation.effect = 'unexpected-effect';
      expect(grade()).toBe(2);
      observed.observation.effect = undefined;
      observed.observation.decision.user_message = 'unrelated';
      expect(grade()).toBe(2);
      observed.observation.decision.user_message = 'invalid verification evidence';
      if (lane.runtime === 'IDE') {
        observed.observation.afterShellCount = 1;
        expect(grade()).toBe(2);
        observed.observation.afterShellCount = undefined;
        expect(grade()).toBe(3);
      }
    }
  }
});
