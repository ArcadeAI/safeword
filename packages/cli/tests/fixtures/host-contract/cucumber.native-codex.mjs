import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

function buildNativeCodexProfile() {
  const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
  const featurePath = nodePath.join(repoRoot, 'features/consistent-host-contract.feature');
  const lines = readFileSync(featurePath, 'utf8').split('\n');
  const scenario = lines.findIndex(line =>
    line.includes('Scenario Outline: Portable package loading proves only its portable components'),
  );
  assert.notEqual(scenario, -1);
  const rows = [];
  for (let index = scenario + 1; index < lines.length; index++) {
    if (/Scenario(?: Outline)?:/u.test(lines[index])) break;
    if (lines[index].split('|').map(cell => cell.trim())[1] === 'Codex') rows.push(index + 1);
  }
  assert.equal(rows.length, 1);
  return {
    paths: [`${featurePath}:${rows[0]}`],
    import: [nodePath.join(repoRoot, 'steps/consistent-host-portable.steps.ts')],
    worldParameters: {
      codexFixtureFile:
        process.env.SAFEWORD_CODEX_TEST_CONFIG ??
        nodePath.join(tmpdir(), 'safeword-host-contract', 'codex-fixture.json'),
    },
  };
}

export default buildNativeCodexProfile();
