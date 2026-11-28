import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  type LifecycleCapabilities,
  supportsBehaviorGuarantee,
} from '../../src/lifecycle/integrations.js';
import {
  createContractRepoFixture,
  runContractRepoCheck,
} from '../helpers/contract-repo-fixture.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(nodePath.dirname(root), { recursive: true, force: true });
});
function report(root: string) {
  const result = runContractRepoCheck(root);
  // The shared fixture helper validates state/exit pairs and rejects unavailable proof.
  return JSON.parse(result.output) as {
    findings: { code: string; metadata?: { behavior_id?: string } }[];
    data: { behavior_adoptions: { behavior_id: string; host: string; guarantees: string[] }[] };
  };
}

it.each([
  [
    'observe',
    'prompt.timestamp',
    "(capabilities.lifecycle as Record<string,string>).prompt_submit = 'unavailable';",
    2,
  ],
  [
    'reject_action',
    'quality.pre-tool',
    '(capabilities as {blockableHooks:string[]}).blockableHooks = [];',
    4,
  ],
  [
    'bounded_continuation',
    'retrospective.filing',
    '(capabilities as {continuationHooks:string[]}).continuationHooks = [];',
    2,
  ],
  [
    'session_end observation',
    'session.quality-state-cleanup',
    "(capabilities.lifecycle as Record<string,string>).session_end = 'unavailable';",
    2,
  ],
] as const)(
  'rejects unsupported %s whole adoption and restores actual supported routes',
  (_kind, behavior, mutation, count) => {
    const root = createContractRepoFixture();
    roots.push(root);
    const path = nodePath.join(root, 'packages/cli/src/lifecycle/integrations.ts');
    const original = readFileSync(path, 'utf8');
    const baseline = report(root).data.behavior_adoptions.filter(
      row => row.host === 'claude' && row.behavior_id === behavior,
    );
    expect(baseline).toHaveLength(count);
    const expected = _kind === 'session_end observation' ? 'observe' : _kind;
    expect(baseline.map(row => row.guarantees)).toEqual(
      Array.from({ length: count }, () => [expected]),
    );
    writeFileSync(
      path,
      `${original}\nconst capabilities = PRODUCTION_INTEGRATIONS.find(row => row.id === 'claude')!.capabilities;\n${mutation}\n`,
    );
    const changed = report(root);
    expect(changed.findings, `UNSUPPORTED_WHOLE_${_kind}_ADOPTED`).toContainEqual(
      expect.objectContaining({
        code: 'HOST_CONTRACT_BINDING_CAPABILITY_UNSUPPORTED',
        metadata: expect.objectContaining({ behavior_id: behavior }),
      }),
    );
    expect(
      changed.data.behavior_adoptions.filter(
        row => row.host === 'claude' && row.behavior_id === behavior,
      ),
    ).toEqual([]);
    writeFileSync(path, original);
    expect(
      report(root).data.behavior_adoptions.filter(
        row => row.host === 'claude' && row.behavior_id === behavior,
      ),
    ).toEqual(baseline);
  },
);

const capability: LifecycleCapabilities = {
  lifecycle: {
    session_start: 'observe',
    prompt_submit: 'unavailable',
    pre_tool: 'block',
    post_tool: 'observe',
    stop: 'observe',
  },
  blockableHooks: ['pre_tool'],
  continuationHooks: ['stop'],
  activation: { availability: 'unavailable' },
  conformance: { availability: 'unavailable' },
};
it.each([
  ['session_start', 'observe', true],
  ['prompt_submit', 'observe', false],
  ['pre_tool', 'reject_action', true],
  ['stop', 'reject_action', false],
  ['stop', 'bounded_continuation', true],
  ['session_start', 'bounded_continuation', false],
  ['session_end', 'observe', false],
  ['stop', undefined, false],
] as const)('supports only declared %s / %s = %s', (trigger, guarantee, expected) => {
  expect(supportsBehaviorGuarantee(capability, trigger, guarantee)).toBe(expected);
  expect(supportsBehaviorGuarantee(undefined, trigger, guarantee)).toBe(false);
});
