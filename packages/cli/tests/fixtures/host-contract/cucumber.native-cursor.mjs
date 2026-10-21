import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

import { cursorContractFeature, cursorIdeCases } from './cursor-cli-cases.js';

// Deliberately isolated pilot profile: the normal acceptance exclusions stay intact.
function buildNativeCursorProfile() {
  const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
  return {
    paths: cursorIdeCases().map(row => `${cursorContractFeature}:${row.line}`),
    import: [
      nodePath.join(repoRoot, 'steps/consistent-host-contract.steps.ts'),
      nodePath.join(repoRoot, 'steps/consistent-host-native-write.steps.ts'),
      nodePath.join(repoRoot, 'steps/consistent-host-native-continuation.steps.ts'),
    ],
    worldParameters: {
      cursorFixtureFile:
        process.env.SAFEWORD_CURSOR_TEST_CONFIG ??
        nodePath.join(tmpdir(), 'safeword-host-contract', 'cursor-fixture.json'),
    },
  };
}

export default buildNativeCursorProfile();
