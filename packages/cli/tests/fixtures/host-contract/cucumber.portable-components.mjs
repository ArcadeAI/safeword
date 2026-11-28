import nodePath from 'node:path';
import process from 'node:process';

import { hostContractFeature, portableCases } from './native-contract-cases.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
export default function portableProfiles() {
  return Object.fromEntries(
    portableCases().map(row => [
      row.id,
      {
        paths: [`${hostContractFeature}:${row.line}`],
        import: [nodePath.join(repoRoot, 'steps/consistent-host-portable.steps.ts')],
        worldParameters: {
          portableRuntime: row.runtime,
          codexFixtureFile: process.env.SAFEWORD_CODEX_TEST_CONFIG,
          cursorCli: process.env.SAFEWORD_CURSOR_CLI,
          cursorFixtureFile: process.env.SAFEWORD_CURSOR_TEST_CONFIG,
        },
      },
    ]),
  );
}
