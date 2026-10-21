import assert from 'node:assert/strict';
import nodePath from 'node:path';
import process from 'node:process';

import { cursorCliCases, cursorContractFeature } from './cursor-cli-cases.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
function selectedPath() {
  const rows = cursorCliCases().filter(row => row.id.endsWith('-catalogue-helper'));
  assert.equal(rows.length, 1);
  return `${cursorContractFeature}:${rows[0].line}`;
}
export default {
  paths: [selectedPath()],
  import: [nodePath.join(repoRoot, 'steps/consistent-host-contract.steps.ts')],
  worldParameters: { cursorCli: process.env.SAFEWORD_CURSOR_CLI },
};
