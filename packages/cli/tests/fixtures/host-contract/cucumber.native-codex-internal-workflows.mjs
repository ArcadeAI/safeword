import nodePath from 'node:path';
import process from 'node:process';

import { codexInternalCases, hostContractFeature } from './native-contract-cases.js';

const repo = nodePath.resolve(import.meta.dirname, '../../../../..');
const cases = codexInternalCases();
const selected = process.env.SAFEWORD_CODEX_INTERNAL_CASE;
const population = selected ? cases.filter(row => row.id === selected) : cases;
if (population.length === 0) throw new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: unknown case');

export default {
  paths: population.map(row => `${hostContractFeature}:${row.line}`),
  import: [
    nodePath.join(repo, 'steps/consistent-host-contract.steps.ts'),
    nodePath.join(import.meta.dirname, 'codex-workflow-runtime.steps.ts'),
  ],
  worldParameters: {
    codexGuardFixtureFile: process.env.SAFEWORD_CODEX_GUARD_FIXTURE,
    codexProvisioningIdentityFile: process.env.SAFEWORD_CODEX_PROVISIONING_IDENTITY,
  },
};
