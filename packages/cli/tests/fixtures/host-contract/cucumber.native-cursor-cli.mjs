import nodePath from 'node:path';
import process from 'node:process';

import { cursorCliCases, cursorContractFeature } from './cursor-cli-cases.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
export default {
  paths: cursorCliCases().map(row => `${cursorContractFeature}:${row.line}`),
  import: [
    nodePath.join(repoRoot, 'steps/consistent-host-native-write.steps.ts'),
    nodePath.join(repoRoot, 'steps/consistent-host-contract.steps.ts'),
  ],
  worldParameters: { cursorCli: process.env.SAFEWORD_CURSOR_CLI },
};
