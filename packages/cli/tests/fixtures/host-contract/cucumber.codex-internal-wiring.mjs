import assert from 'node:assert/strict';
import nodePath from 'node:path';
import process from 'node:process';

import { codexInternalCases, hostContractFeature } from './native-contract-cases.js';

function config() {
  const scenario = codexInternalCases().find(
    row => row.scenario === 'Missing internal resources prevent a clean generated-delivery check',
  );
  assert.ok(scenario, 'Missing accepted internal-resource scenario');
  return {
    paths: [`${hostContractFeature}:${scenario.line}`],
    import: [nodePath.join(import.meta.dirname, 'codex-internal-wiring.steps.ts')],
    worldParameters: {
      wiringRepo: process.env.SAFEWORD_WIRING_REPOSITORY,
      wiringBundle: process.env.SAFEWORD_WIRING_BUNDLE,
    },
  };
}
export default config();
