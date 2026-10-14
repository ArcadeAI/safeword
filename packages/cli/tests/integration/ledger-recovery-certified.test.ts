import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, expect, it, vi } from 'vitest';

import {
  fixtureGit,
  RECOVERY_SUMMARY,
  simulatedRecoveryFixture,
  writeObservation,
} from '../review/ledger-recovery-fixture.js';

const fixtures: Awaited<ReturnType<typeof simulatedRecoveryFixture>>[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.cleanup();
  vi.unstubAllEnvs();
});

function gate(root: string) {
  const result = spawnSync(
    process.execPath,
    [
      nodePath.resolve(import.meta.dirname, '../../dist/cli.js'),
      '--json',
      '--no-input',
      '--cwd',
      root,
      'review',
      'gate',
      'ledger-recovery',
      '--ticket',
      '5F5ZZA',
    ],
    { encoding: 'utf8', timeout: 30_000 },
  );
  return {
    status: result.status,
    envelope: JSON.parse(result.stdout),
    output: result.stdout + result.stderr,
  };
}

it('credits only matching signed observation and independent certification through the public gate', async () => {
  const fixture = await simulatedRecoveryFixture();
  fixtures.push(fixture);
  const positive = gate(fixture.root);
  expect(
    positive.envelope.data.status,
    'The public gate must validate matching observation and certification',
  ).toBe('approved');
  expect(positive.status, positive.output).toBe(0);
  expect(positive.envelope.data.summary.activeCases).toHaveLength(142);
  expect(positive.envelope.data.summary.deferredCases).toHaveLength(33);
  expect(
    positive.envelope.data.summary.deferredCases.every(
      (item: { status: string }) => item.status === 'deferred-unverified',
    ),
  ).toBe(true);
  const ledger = nodePath.join(
    fixture.root,
    '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/test-definitions.md',
  );
  const originalLedger = readFileSync(ledger, 'utf8');
  expect(originalLedger).toContain('- [x] REFACTOR 15a7c84aa');
  const reportBytes = readFileSync(fixture.reportPath, 'utf8');
  writeFileSync(fixture.reportPath, '[]');
  expect(gate(fixture.root).status).toBe(2);
  writeFileSync(fixture.reportPath, reportBytes);
  expect(gate(fixture.root).status).toBe(0);
  const summaryPath = nodePath.join(fixture.root, RECOVERY_SUMMARY);
  const summaryBytes = readFileSync(summaryPath, 'utf8');
  writeFileSync(summaryPath, summaryBytes.replace('deferred-unverified', 'passed'));
  expect(gate(fixture.root).status).toBe(2);
  writeFileSync(summaryPath, summaryBytes);
  expect(gate(fixture.root).status).toBe(0);
  const tagPath = fixture.observationPath.replace(/\.json$/, '.tag');
  const tag = readFileSync(tagPath, 'utf8');
  writeFileSync(tagPath, '0'.repeat(64));
  expect(gate(fixture.root).status).toBe(2);
  writeFileSync(tagPath, tag);
  expect(gate(fixture.root).status).toBe(0);
  writeObservation(fixture.root, fixture.observationPath, { ...fixture.observation, exitCode: 1 });
  expect(gate(fixture.root).status).toBe(2);
  writeObservation(fixture.root, fixture.observationPath, fixture.observation);
  expect(gate(fixture.root).status).toBe(0);
  const jobPath = nodePath.join(fixture.root, '.safeword/state/reviews', `${fixture.id}.json`);
  const job = readFileSync(jobPath, 'utf8');
  writeFileSync(jobPath, '{}');
  expect(gate(fixture.root).status).toBe(2);
  writeFileSync(jobPath, job);
  expect(gate(fixture.root).status).toBe(0);
  expect(readFileSync(ledger, 'utf8')).toBe(originalLedger);
}, 60_000);

it('preserves audit-only commits but rejects scope and product changes after observation', async () => {
  const fixture = await simulatedRecoveryFixture();
  fixtures.push(fixture);
  const audit = '.project/tickets/V2ZPV1-recover-accurate-completion-evidence/ticket.md';
  const auditPath = nodePath.join(fixture.root, audit);
  writeFileSync(auditPath, `${readFileSync(auditPath, 'utf8')}\nAudit-only recovery note.\n`);
  expect(gate(fixture.root).status).toBe(0);
  fixtureGit(fixture.root, ['add', '.project/tickets/V2ZPV1-recover-accurate-completion-evidence']);
  fixtureGit(fixture.root, [
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '-m',
    'Record unchanged recovery audit bytes',
  ]);
  expect(gate(fixture.root).status).toBe(0);

  const authorityPath = nodePath.join(
    fixture.root,
    '.project/tickets/5F5ZZA-keep-plan-reviews-current-and-trustworthy/ticket.md',
  );
  const authority = readFileSync(authorityPath, 'utf8');
  expect(authority).toContain('\nscope:\n');
  writeFileSync(authorityPath, authority.replace('\nscope:\n', '\nscope:\n  - new authority\n'));
  expect(gate(fixture.root).status).toBe(2);
  writeFileSync(authorityPath, authority);
  expect(gate(fixture.root).status).toBe(0);

  const inputPath = nodePath.join(fixture.root, 'steps/world.ts');
  const input = readFileSync(inputPath, 'utf8');
  writeFileSync(inputPath, `${input}\n// Changed execution input.\n`);
  expect(gate(fixture.root).status).toBe(2);
  writeFileSync(inputPath, input);
  expect(gate(fixture.root).status).toBe(0);

  const productPath = nodePath.join(fixture.root, 'README.md');
  writeFileSync(productPath, `${readFileSync(productPath, 'utf8')}\nChanged committed product.\n`);
  fixtureGit(fixture.root, ['add', 'README.md']);
  fixtureGit(fixture.root, [
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '-m',
    'Change product after observation',
  ]);
  const stale = gate(fixture.root);
  expect(stale.status).toBe(2);
  expect(stale.output).toContain('Producing product tree is no longer current');
}, 60_000);
