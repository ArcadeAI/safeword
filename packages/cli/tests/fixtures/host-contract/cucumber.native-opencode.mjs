import nodePath from 'node:path';
import process from 'node:process';

import { hostContractFeature, openCodeV2Cases } from './native-contract-cases.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
export default {
  paths: openCodeV2Cases().map(row => `${hostContractFeature}:${row.line}`),
  import: [
    nodePath.join(repoRoot, 'steps/consistent-host-contract.steps.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-native-write.steps.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-opencode-controls.steps.ts'),
  ],
  worldParameters: { opencodeFixtureFile: process.env.SAFEWORD_OPENCODE_TEST_CONFIG },
};
