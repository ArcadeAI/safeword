import nodePath from 'node:path';
import process from 'node:process';

import { cursorCliCases, hostContractFeature } from './native-contract-cases.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
export default {
  paths: cursorCliCases().map(row => `${hostContractFeature}:${row.line}`),
  import: [
    nodePath.join(repoRoot, 'steps/consistent-host-native-write.steps.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-contract.steps.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-portable.steps.ts'),
  ],
  worldParameters: {
    cursorCli: process.env.SAFEWORD_CURSOR_CLI,
    cursorFixtureFile: process.env.SAFEWORD_CURSOR_TEST_CONFIG,
    portableRuntime: 'CLI',
  },
};
