import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

function buildNativeCodexContinuationProfile() {
  const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
  const feature = nodePath.join(repoRoot, 'features/consistent-host-contract.feature');
  const lines = readFileSync(feature, 'utf8').split('\n');
  const start = lines.findIndex(line =>
    line.includes(
      'Scenario Outline: A supported completion guard actually continues the conversation',
    ),
  );
  assert.notEqual(start, -1);
  const rows = [];
  for (let index = start + 1; index < lines.length; index++) {
    if (/Scenario(?: Outline)?:/u.test(lines[index])) break;
    const cells = lines[index].split('|').map(cell => cell.trim());
    if (cells[1] === 'Codex') {
      assert.equal(cells[2], '0.160.0');
      rows.push(index + 1);
    }
  }
  assert.equal(rows.length, 1);
  return {
    paths: [`${feature}:${rows[0]}`],
    import: [nodePath.join(repoRoot, 'steps/consistent-host-native-continuation.steps.ts')],
    worldParameters: { codexGuardFixtureFile: process.env.SAFEWORD_CODEX_GUARD_FIXTURE },
  };
}

export default buildNativeCodexContinuationProfile();
