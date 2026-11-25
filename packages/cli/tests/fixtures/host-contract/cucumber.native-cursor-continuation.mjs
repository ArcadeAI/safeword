import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { cursorIdeCases, hostContractFeature } from './native-contract-cases.js';

const root = nodePath.resolve(import.meta.dirname, '../../../../..');
function config() {
  const rows = cursorIdeCases().filter(
    row => row.scenario === 'A supported completion guard actually continues the conversation',
  );
  assert.equal(rows.length, 1);
  return {
    paths: rows.map(row => `${hostContractFeature}:${row.line}`),
    import: [nodePath.join(root, 'steps/consistent-host-native-continuation.steps.ts')],
    worldParameters: {
      cursorFixtureFile:
        process.env.SAFEWORD_CURSOR_TEST_CONFIG ??
        nodePath.join(tmpdir(), 'safeword-host-contract/cursor-fixture.json'),
    },
  };
}
export default config();
