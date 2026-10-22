import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import type * as Vitest from 'vitest';
import { afterEach, expect, it, vi } from 'vitest';

import { EXECUTION_PLAN_CONFORMANCE_CASES } from '../../src/review/execution-plan-conformance.js';
import { writeExecutionCheckpoint } from '../fixtures/execution-plan-live-checkpoint.js';

const harness = vi.hoisted(() => ({ setup: [] as (() => void)[] }));

// Capture the real live harness's setup without registering its paid test bodies.
// Assertions still use Vitest's real expect; no reviewer implementation is invoked.
vi.mock('vitest', async importOriginal => ({
  ...(await importOriginal<typeof Vitest>()),
  beforeAll: (setup: () => void) => {
    harness.setup.push(setup);
  },
  afterAll: () => {},
  describe: { skipIf: () => () => {} },
}));

vi.mock('../../src/review/runtime.js', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runHeadlessReviewerWithProvenance: () => {
    throw new Error('Paid inference is forbidden in this regression test');
  },
}));

const roots: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  harness.setup.length = 0;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function configureRetainedHarness(
  retained: string,
  destination: string | undefined,
  replayPath?: string,
): void {
  const environment = Object.entries({
    SAFEWORD_RUN_EXECUTION_PLAN_LIVE: '1',
    SAFEWORD_EXECUTION_PLAN_LIVE_REVIEWER: 'claude',
    SAFEWORD_EXECUTION_PLAN_LIVE_MODEL: 'claude-opus-5',
    SAFEWORD_EXECUTION_PLAN_RETAINED_RESULTS_PATH: retained,
    SAFEWORD_EXECUTION_PLAN_RESULTS_PATH: destination,
    SAFEWORD_EXECUTION_PLAN_ACCEPTANCE: '0',
    SAFEWORD_EXECUTION_PLAN_LIVE_CLI: '0',
  });
  for (const [key, value] of environment) vi.stubEnv(key, value);
  vi.stubEnv('SAFEWORD_EXECUTION_PLAN_REPLAY_PATH', replayPath);
}

it.each([false, true])(
  'checks retained output against the current oracle before replacing evidence (matches: %s)',
  async matchesOracle => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'execution-replay-oracle-'));
    roots.push(root);
    const retained = nodePath.join(root, 'retained.json');
    const destination = nodePath.join(root, 'current.json');
    const testCase = EXECUTION_PLAN_CONFORMANCE_CASES.find(row => row.id === 'generic-checklist');
    if (testCase === undefined) throw new Error('A rejection control is required');
    const { executionPlanConformanceDigests } =
      await import('../../src/review/execution-plan-conformance.js');
    writeExecutionCheckpoint(
      retained,
      [{ case_id: testCase.id, reviewer: 'claude', model: 'claude-opus-5', passed: true }],
      [
        {
          case_id: testCase.id,
          dispatch_mode: 'headless',
          confirmed_model: { provider: 'anthropic', model: 'claude-opus-5' },
          output: {
            schema_version: 1,
            dispatch_id: 'saved',
            reviewer_agent: 'claude',
            verdict: matchesOracle ? 'request_changes' : 'approve',
            summary: `Retained response: ${(testCase.expectation.finding_terms ?? []).join(' ')}`,
            findings: [],
            planning_destination: testCase.expectation.planning_destination,
            // The protocol requires a literal null record for rejected plans.
            // eslint-disable-next-line unicorn/no-null -- rejected reviewer protocol requires null
            execution_plan_record: null,
          },
        },
      ],
      {
        schema_version: 1,
        ...executionPlanConformanceDigests(),
        reviewer: 'claude',
        requested_model: 'claude-opus-5',
        oracle_sha256: 'older-oracle',
      },
    );
    writeExecutionCheckpoint(destination, [], [], { sentinel: 'must not be overwritten' });
    const original = readFileSync(`${destination}.metadata.json`, 'utf8');
    configureRetainedHarness(retained, destination);
    await import('../smoke/execution-plan.live.test.js');
    expect(harness.setup).toHaveLength(1);
    if (matchesOracle) {
      harness.setup[0]?.();
      expect(JSON.parse(readFileSync(destination, 'utf8'))).toEqual(
        JSON.parse(readFileSync(retained, 'utf8')),
      );
      expect(
        JSON.parse(readFileSync(`${destination}.metadata.json`, 'utf8')).oracle_sha256,
      ).not.toBe('older-oracle');
    } else {
      expect(harness.setup[0]).toThrow(/approve|request_changes/u);
      expect(readFileSync(`${destination}.metadata.json`, 'utf8')).toBe(original);
    }
  },
);

it.each([
  'A coherent contract can split into independently reviewable results; I would use separate changes.',
  'One coherent review result. No further discussion; split into independent changes.',
])('rejects a one-change rationale that does not justify inseparability: %s', async rationale => {
  vi.stubEnv('SAFEWORD_RUN_EXECUTION_PLAN_LIVE', '0');
  const { assertSlicingRationale } = await import('../smoke/execution-plan.live.test.js');
  expect(() => {
    assertSlicingRationale('one-coherent-change', rationale, expect);
  }).toThrow();
});

it.each([
  'One cohesive contract has a single reviewable result. It cannot be split into independently provable changes.',
  'This cohesive contract yields a reviewable result; splitting is not possible.',
  'The cohesive contract is independently reviewable, but these changes must ship together.',
])('accepts an explicit cohesion and inseparability explanation: %s', async rationale => {
  expect.hasAssertions();
  vi.stubEnv('SAFEWORD_RUN_EXECUTION_PLAN_LIVE', '0');
  const { assertSlicingRationale } = await import('../smoke/execution-plan.live.test.js');
  assertSlicingRationale('one-coherent-change', rationale, expect);
});

it.each(['same', 'normalized alias', 'symlink alias', 'sidecar overlap', 'combined replay'])(
  'refuses retained-source collisions or combined saved-input modes: %s',
  async kind => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'execution-source-preservation-'));
    roots.push(root);
    const retained = nodePath.join(root, 'retained.json');
    const alias = nodePath.join(root, 'alias.json');
    mkdirSync(nodePath.join(root, 'unused'));
    symlinkSync(retained, alias);
    const { executionPlanConformanceDigests } =
      await import('../../src/review/execution-plan-conformance.js');
    writeExecutionCheckpoint(
      retained,
      [{ case_id: 'generic-checklist', reviewer: 'claude', model: 'claude-opus-5', passed: false }],
      [
        {
          case_id: 'generic-checklist',
          dispatch_mode: 'headless',
          confirmed_model: { provider: 'anthropic', model: 'claude-opus-5' },
          output: {
            schema_version: 1,
            dispatch_id: 'failed-observation',
            reviewer_agent: 'claude',
            verdict: 'request_changes',
            summary: 'Recorded disagreement about the destination.',
            findings: [],
            planning_destination: 'plan-implementation',
            // eslint-disable-next-line unicorn/no-null -- rejected reviewer protocol requires null
            execution_plan_record: null,
          },
        },
      ],
      {
        schema_version: 1,
        ...executionPlanConformanceDigests(),
        reviewer: 'claude',
        requested_model: 'claude-opus-5',
      },
    );
    const paths = [retained, `${retained}.outputs.json`, `${retained}.metadata.json`];
    const originals = paths.map(path => readFileSync(path, 'utf8'));
    const destination = {
      same: retained,
      'normalized alias': `${root}/unused/../retained.json`,
      'symlink alias': alias,
      'sidecar overlap': `${retained}.outputs.json`,
      'combined replay': nodePath.join(root, 'destination.json'),
    }[kind];
    configureRetainedHarness(
      retained,
      destination,
      kind === 'combined replay' ? `${retained}.outputs.json` : undefined,
    );
    await expect(async () => {
      await import('../smoke/execution-plan.live.test.js');
      harness.setup[0]?.();
    }).rejects.toThrow(
      kind === 'combined replay'
        ? 'cannot combine replay and retained'
        : 'source and destination must be distinct',
    );
    expect(paths.map(path => readFileSync(path, 'utf8'))).toEqual(originals);
  },
);
