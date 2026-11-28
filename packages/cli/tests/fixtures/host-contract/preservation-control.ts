import { codexInternalCases } from './native-contract-cases.js';

/** Synthetic formatter/classifier input only: main() rejects this nonexistent proof file. */
export function preservationControl(scenario: string, arm = 'single') {
  const artifacts = `/synthetic-unit-control-not-native-evidence/${arm}`;
  return {
    kind: 'codex-internal-preservation',
    scenario,
    arm,
    artifacts,
    file: `${artifacts}/preservation.json`,
    observation: {
      originalConfigUnchanged: true,
      originalRuntimeUnchanged: true,
      originalBundleUnchanged: true,
      fiveTrustedBindingsUnchanged: true,
    },
  };
}
export function preservationEmbedding(scenario: string) {
  const arms = codexInternalCases().find(row => row.scenario === scenario)?.preservationArms ?? [
    'single',
  ];
  return arms.map(arm => ({
    mime_type: 'application/json',
    data: Buffer.from(JSON.stringify(preservationControl(scenario, arm))).toString('base64'),
  }));
}
