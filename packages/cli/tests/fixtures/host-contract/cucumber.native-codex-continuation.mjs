import assert from 'node:assert/strict';
import nodePath from 'node:path';
import process from 'node:process';

import { codexCases, hostContractFeature } from './native-contract-cases.js';

const root = nodePath.resolve(import.meta.dirname, '../../../../..');
function config() {
  const rows = codexCases().filter(
    row => row.scenario === 'A supported completion guard actually continues the conversation',
  );
  assert.equal(rows.length, 1);
  return {
    paths: rows.map(row => `${hostContractFeature}:${row.line}`),
    import: [nodePath.join(root, 'steps/consistent-host-native-continuation.steps.ts')],
    worldParameters: { codexGuardFixtureFile: process.env.SAFEWORD_CODEX_GUARD_FIXTURE },
  };
}
export default config();
