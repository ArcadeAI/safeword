import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { cursorIdeCases, hostContractFeature } from './native-contract-cases.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
function config() {
  const paths = [
    'A denied action has no side effect',
    'An allowed action reaches the side-effect boundary',
  ].map(name => {
    const rows = cursorIdeCases().filter(row => row.scenario === name);
    assert.equal(rows.length, 1);
    return `${hostContractFeature}:${rows[0].line}`;
  });
  return {
    paths,
    import: [nodePath.join(repoRoot, 'steps/consistent-host-native-write.steps.ts')],
    worldParameters: {
      cursorFixtureFile:
        process.env.SAFEWORD_CURSOR_TEST_CONFIG ??
        nodePath.join(tmpdir(), 'safeword-host-contract', 'cursor-fixture.json'),
    },
  };
}
export default config();
