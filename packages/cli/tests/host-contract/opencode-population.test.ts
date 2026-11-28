import { AssertionError, ok } from 'node:assert';
import { spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { expect, it, vi } from 'vitest';

import {
  gradeOpenCodePopulation,
  type OpenCodeCase,
  openCodePopulation,
  runOpenCodePopulation,
} from '../../scripts/lib/opencode-population.js';

const cases = openCodePopulation();
const passed = () => cases.map(row => ({ id: row.id, state: 'passed' as const }));
it('grades an executed retired plugin as failed while missing coexistence setup stays unavailable', async () => {
  const coexistence = cases.filter(row => row.kind === 'coexistence');
  expect(coexistence).toHaveLength(2);
  const failed = await runOpenCodePopulation(coexistence, () =>
    Promise.reject(new AssertionError({ message: 'RETIRED_PLUGIN_EXECUTED_IN_V2' })),
  );
  expect(failed.exit).toBe(2);
  expect(failed.results.map(row => row.state)).toEqual(['failed', 'failed']);
  const unavailable = await runOpenCodePopulation(coexistence, () =>
    Promise.reject(new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: missing host')),
  );
  expect(unavailable.exit).toBe(3);
  expect(unavailable.results.map(row => row.state)).toEqual(['unavailable', 'unavailable']);
});
it('requires the complete V2-only CLI/TUI case identities', () => {
  const obligations = [
    'allowed-write',
    'denied-write',
    'catalogue-helper',
    'v2-worker-fresh-context',
    'v2-worker-forbidden-action',
    'v2-required-registration',
    'v2-optional-registration',
    'v2-required-worker-registration',
    'commands',
    'coexistence',
  ];
  const expected = (['CLI', 'TUI'] as const).flatMap(runtime =>
    obligations.map(obligation => ({
      id: `opencode-v2-2.4.1-${runtime.toLowerCase()}-${obligation}`,
      version: '2.4.1',
      runtime,
    })),
  );
  const byId = (left: { id: string }, right: { id: string }) => left.id.localeCompare(right.id);
  expect(
    cases.map(({ id, version, runtime }) => ({ id, version, runtime })).toSorted(byId),
    'MISSING_EXPLICIT_OPENCODE_CASE',
  ).toEqual(expected.toSorted(byId));
});
it('reports an absent contracted case as a population failure, not unavailable setup', () => {
  expect(gradeOpenCodePopulation(cases, passed().slice(1))).toBe(2);
});
it('distinguishes a reached failed assertion from unavailable setup', () => {
  const failed = passed().map((row, index) =>
    index === 0 ? { ...row, state: 'failed' as const } : row,
  );
  expect(gradeOpenCodePopulation(cases, failed)).toBe(2);
  const unavailable = passed().map((row, index) =>
    index === 0 ? { ...row, state: 'unavailable' as const } : row,
  );
  expect(gradeOpenCodePopulation(cases, unavailable)).toBe(3);
});
it('rejects unknown and duplicate IDs without reducing the denominator', () => {
  expect(
    gradeOpenCodePopulation(cases, [...passed().slice(1), { id: 'foreign', state: 'passed' }]),
  ).toBe(2);
  expect(gradeOpenCodePopulation(cases, [...passed(), ...passed().slice(0, 1)])).toBe(2);
  expect(gradeOpenCodePopulation(cases, passed())).toBe(0);
});
it('invokes shared multi-assertion workers once and retains every exact case', async () => {
  const invoke = vi.fn<(batch: OpenCodeCase[]) => Promise<void>>().mockResolvedValue(undefined);
  const outcome = await runOpenCodePopulation(cases, invoke);
  expect(outcome.exit).toBe(0);
  expect(outcome.results).toEqual(passed());
  expect(invoke).toHaveBeenCalledTimes(
    new Set(cases.map(row => `${row.host}/${row.runtime}/${row.kind}`)).size,
  );
  expect(invoke.mock.calls.flatMap(call => call[0] ?? [])).toHaveLength(cases.length);
});
it('preserves failed and unavailable native execution instead of importing successes', async () => {
  const failed = await runOpenCodePopulation(
    cases.filter(row => row.kind === 'denied-write'),
    () => Promise.reject(new AssertionError({ message: 'DENIED_SIDE_EFFECT_OBSERVED' })),
  );
  expect(failed.exit).toBe(2);
  expect(failed.results.every(row => row.state === 'failed')).toBe(true);
  const unavailable = await runOpenCodePopulation(cases, () =>
    Promise.reject(new Error('HOST_CONTRACT_PROOF_UNAVAILABLE: missing host')),
  );
  expect(unavailable.exit).toBe(3);
  expect(unavailable.results.every(row => row.state === 'unavailable')).toBe(true);
});

it('rejects an empty required population', () => {
  expect(gradeOpenCodePopulation([], [])).toBe(2);
});

it('normal native group selects the complete manifest before reporting unavailable setup', () => {
  const repo = nodePath.resolve(import.meta.dirname, '../../../..');
  const env = { ...process.env };
  delete env.SAFEWORD_OPENCODE_TEST_CONFIG;
  const result = spawnSync(
    nodePath.join(repo, 'scripts/dev'),
    [
      'bun',
      'packages/cli/scripts/run-host-contract-proof.ts',
      '--proof',
      'native-opencode',
      '--require-targets',
    ],
    { cwd: repo, env, encoding: 'utf8', timeout: 30_000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(3);
  expect(result.stdout, 'OPENCODE_COMPLETE_ENTRY_WIRING_MISSING').toContain(
    `OPENCODE_REQUIRED_CASES: ${JSON.stringify(cases)}`,
  );
  expect(result.stderr).toContain('HOST_CONTRACT_PROOF_UNAVAILABLE');
});

it('keeps uncoded setup assertions unavailable rather than manufacturing executable RED', async () => {
  const result = await runOpenCodePopulation(cases, () =>
    Promise.reject(
      new AssertionError({ actual: 'unsupported', expected: 'verified', operator: 'strictEqual' }),
    ),
  );
  expect(result.exit).toBe(3);
  expect(result.results.every(row => row.state === 'unavailable')).toBe(true);
});

it('does not share non-worker executions for additional qualified feature rows', async () => {
  const row = cases.find(item => item.kind === 'allowed-write');
  ok(row);
  const invoke = vi.fn<(batch: OpenCodeCase[]) => Promise<void>>().mockResolvedValue(undefined);
  const result = await runOpenCodePopulation([row, { ...row, id: `${row.id}-qualified` }], invoke);
  expect(result.exit).toBe(0);
  expect(invoke).toHaveBeenCalledTimes(2);
});
