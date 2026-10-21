import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import process from 'node:process';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../../..');
const feature = nodePath.join(repoRoot, 'features/consistent-host-contract.feature');
const source = readFileSync(feature, 'utf8').split('\n');
const names = [
  'A denied action has no side effect',
  'An allowed action reaches the side-effect boundary',
];
const paths = names.map(name => {
  const start = source.findIndex(line => line.includes(`Scenario Outline: ${name}`));
  assert.notEqual(start, -1);
  const rows = [];
  for (let index = start + 1; index < source.length; index++) {
    if (/Scenario(?: Outline)?:/u.test(source[index])) break;
    const cells = source[index].split('|').map(cell => cell.trim());
    if (cells[1] === 'Cursor' && cells[2] === '3.24.18' && cells[3] === 'IDE') rows.push(index + 1);
  }
  assert.equal(rows.length, 1);
  return `${feature}:${rows[0]}`;
});
export default {
  paths,
  import: [nodePath.join(repoRoot, 'steps/consistent-host-native-write.steps.ts')],
  worldParameters: {
    cursorFixtureFile:
      process.env.SAFEWORD_CURSOR_TEST_CONFIG ??
      nodePath.join(tmpdir(), 'safeword-host-contract', 'cursor-fixture.json'),
  },
};
