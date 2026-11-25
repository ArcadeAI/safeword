import nodePath from 'node:path';
import process from 'node:process';

import { claudeCases, hostContractFeature } from './native-contract-cases.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
export default {
  paths: claudeCases().map(row => `${hostContractFeature}:${row.line}`),
  import: [nodePath.join(repoRoot, 'steps/consistent-host-claude.steps.ts')],
  worldParameters: { claudeFixtureFile: process.env.SAFEWORD_CLAUDE_TEST_CONFIG },
};
