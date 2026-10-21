import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

function profile() {
  const root = nodePath.resolve(import.meta.dirname, '../../../../..');
  const feature = nodePath.join(root, 'features/consistent-host-contract.feature');
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
    if (cells[1] === 'Cursor' && cells[2] === '3.24.18') rows.push(index + 1);
  }
  assert.equal(rows.length, 1);
  return {
    paths: [`${feature}:${rows[0]}`],
    import: [nodePath.join(root, 'steps/consistent-host-native-continuation.steps.ts')],
    worldParameters: {
      cursorFixtureFile:
        process.env.SAFEWORD_CURSOR_TEST_CONFIG ??
        nodePath.join(tmpdir(), 'safeword-host-contract/cursor-fixture.json'),
    },
  };
}
export default profile();
