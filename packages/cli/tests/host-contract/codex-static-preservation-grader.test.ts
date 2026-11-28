import { expect, it } from 'vitest';

import { invocationResult } from '../../scripts/check-codex-internal-workflows.js';
import { codexInternalCases } from '../fixtures/host-contract/native-contract-cases.js';
import { preservationControl } from '../fixtures/host-contract/preservation-control.js';

const cases = [
  ['internal-references-resolve-their-complete-installed-resource-closure', 'closure'],
  ['missing-internal-resources-prevent-a-clean-generated-delivery-check', 'missing'],
] as const;

function run(id: string, changes: Record<string, unknown> = {}, scenarioId = id) {
  const scenario = codexInternalCases().find(row => row.id === scenarioId)?.scenario;
  if (!scenario) throw new Error(`Missing scenario for ${scenarioId}`);
  const receipt = preservationControl(scenario);
  const observation = {
    ...receipt.observation,
    mode: 'isolated-behavior',
    fiveTrustedBindingsUnchanged: false,
    persistedHookTrustBypassed: false,
    originalFiveTrustedBindingsUnchanged: true,
    fiveEnabledBindingsUnchanged: true,
    nativeModelInvocation: 'not-applicable',
    nativeBehaviorArgv: [],
    resourceCaseId: id,
    resourceCheckKind: cases.find(row => row[0] === id)?.[1],
    resourceCheckCompleted: true,
    ...changes,
  };
  const embedding = {
    mime_type: 'application/json',
    data: Buffer.from(JSON.stringify({ ...receipt, observation })).toString('base64'),
  };
  return invocationResult(
    [
      {
        name: scenario,
        line: 1,
        steps: [
          { keyword: 'Given', result: { status: 'passed' } },
          {
            keyword: 'After',
            hidden: true,
            result: { status: 'passed' },
            embeddings: [embedding],
          },
        ],
      },
    ],
    0,
  );
}

it.each(cases)('accepts completed isolated static case %s', id => {
  expect(run(id)).toBe(0);
});

it.each([
  ['wrong mode', { mode: 'normal' }],
  ['wrong case', { resourceCaseId: 'foreign' }],
  ['wrong checker', { resourceCheckKind: 'missing' }],
  ['missing invocation classification', { nativeModelInvocation: undefined }],
  ['nonboolean completion', { resourceCheckCompleted: 'true' }],
  ['missing completion', { resourceCheckCompleted: false }],
  ['bypass asserted', { persistedHookTrustBypassed: true }],
  ['model invocation', { nativeBehaviorArgv: [['codex']] }],
  ['missing parent config', { originalConfigUnchanged: false }],
  ['missing parent runtime', { originalRuntimeUnchanged: false }],
  ['missing parent bundle', { originalBundleUnchanged: false }],
  ['untrusted original', { originalFiveTrustedBindingsUnchanged: false }],
  ['disabled child', { fiveEnabledBindingsUnchanged: false }],
  ['invented child trust', { fiveTrustedBindingsUnchanged: true }],
])('rejects %s for checker-only preservation', (_name, changes) => {
  expect(run(cases[0][0], changes)).toBe(3);
});

it('rejects a resource fact attached to the other scenario', () => {
  expect(run(cases[0][0], {}, cases[1][0])).toBe(3);
});

it('rejects resource facts attached to a non-resource scenario', () => {
  const other = codexInternalCases().find(row => cases.every(([id]) => id !== row.id));
  if (!other) throw new Error('Missing non-resource scenario');
  expect(run(cases[0][0], {}, other.id)).toBe(3);
});

it('retains the existing normal and model invocation branches', () => {
  expect(
    run(cases[0][0], {
      nativeModelInvocation: undefined,
      fiveTrustedBindingsUnchanged: true,
    }),
  ).toBe(0);
  expect(
    run(cases[0][0], {
      nativeModelInvocation: undefined,
      persistedHookTrustBypassed: true,
      nativeBehaviorArgv: [['codex', '--dangerously-bypass-hook-trust']],
    }),
  ).toBe(0);
});
