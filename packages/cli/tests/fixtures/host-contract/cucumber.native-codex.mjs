import nodePath from 'node:path';
import process from 'node:process';

import { codexCases, hostContractFeature } from './native-contract-cases.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
export default {
  paths: codexCases().map(row => `${hostContractFeature}:${row.line}`),
  import: [
    nodePath.join(repoRoot, 'steps/consistent-host-contract.steps.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-native-write.steps.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-native-continuation.steps.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-portable.steps.ts'),
  ],
  worldParameters: {
    codexGuardFixtureFile: process.env.SAFEWORD_CODEX_GUARD_FIXTURE,
    codexFixtureFile: process.env.SAFEWORD_CODEX_TEST_CONFIG,
  },
};
