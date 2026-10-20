import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';

// Deliberately isolated pilot profile: the normal acceptance exclusions stay intact.
function buildNativeCursorProfile() {
  const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
  const featurePath = nodePath.join(repoRoot, 'features/consistent-host-contract.feature');
  const lines = readFileSync(featurePath, 'utf8').split('\n');
  const scenarioLine = lines.findIndex(line =>
    line.includes('Scenario Outline: Native delivery exposes the contracted catalogue'),
  );
  assert.notEqual(scenarioLine, -1, 'Native catalogue scenario must exist');
  const targets = JSON.parse(readFileSync(new URL('targets.json', import.meta.url), 'utf8'));
  const cursor = targets.targets.find(
    target => target.agent === 'cursor' && target.delivery_variants?.includes('native'),
  );
  assert.ok(cursor, 'Independent Cursor target must exist');
  const exampleLines = [];
  for (let index = scenarioLine + 1; index < lines.length; index++) {
    const line = lines[index];
    if (line.includes('Scenario:') || line.includes('Scenario Outline:')) break;
    const cells = line.split('|').map(cell => cell.trim());
    if (cells[1] === 'Cursor' && cells[2] === cursor.version && cells[3] === 'IDE') {
      exampleLines.push(index + 1);
    }
  }
  assert.equal(exampleLines.length, 1, 'Pilot must select exactly one actual Cursor example');

  return {
    paths: [`${featurePath}:${exampleLines[0]}`],
    import: [nodePath.join(repoRoot, 'steps/consistent-host-contract.steps.ts')],
    worldParameters: {
      cursorFixtureFile:
        process.env.SAFEWORD_CURSOR_TEST_CONFIG ??
        nodePath.join(tmpdir(), 'safeword-host-contract', 'cursor-fixture.json'),
    },
  };
}

export default buildNativeCursorProfile();
