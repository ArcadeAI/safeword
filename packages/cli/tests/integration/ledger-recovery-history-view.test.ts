import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import { simulatedRecoveryFixture } from '../review/ledger-recovery-fixture.js';

const fixtures: Awaited<ReturnType<typeof simulatedRecoveryFixture>>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.cleanup();
  vi.unstubAllEnvs();
});

it('returns only the exact authorized historical erratum and preserves missing history', async () => {
  const fixture = await simulatedRecoveryFixture();
  fixtures.push(fixture);
  const ledger =
    '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/test-definitions.md';
  const original = readFileSync(nodePath.join(fixture.root, ledger), 'utf8');
  const result = spawnSync(
    process.execPath,
    [
      nodePath.resolve(import.meta.dirname, '../../dist/cli.js'),
      '--json',
      '--no-input',
      '--cwd',
      fixture.root,
      'review',
      'gate',
      'ledger-recovery',
      '--ticket',
      '5F5ZZA',
    ],
    { encoding: 'utf8', timeout: 30_000 },
  );
  const envelope = JSON.parse(result.stdout);
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const expected = original.replace(
    '- [x] REFACTOR 15a7c84aa',
    '- [x] REFACTOR skip: reviewed recovery erratum; no separate refactor was warranted',
  );
  expect(expected).not.toBe(original);
  expect(
    envelope.data.historicalView,
    'Authenticated recovery must expose only the sole exact historical erratum',
  ).toBe(expected);
  expect(envelope.data.missingHistory).toHaveLength(
    (original.match(/^- \[ \] (?:RED|GREEN|REFACTOR)\b/gm) ?? []).length,
  );
  expect(
    envelope.data.missingHistory.map((item: { annotation: string }) => item.annotation),
  ).toEqual(original.match(/^- \[ \] (?:RED|GREEN|REFACTOR)\b.*$/gm));
  for (const item of envelope.data.missingHistory) {
    expect(original.split('\n')[item.line - 1]).toBe(item.annotation);
    expect(item.scenario).not.toBe('');
  }
  expect(envelope.data.ticket).toBe('5F5ZZA');
  expect(envelope.data.ledger).toBe(ledger);
  expect(readFileSync(nodePath.join(fixture.root, ledger), 'utf8')).toBe(original);
}, 60_000);
