import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import {
  assertWiringJudgment,
  proveWiringFixture,
  seedWiringReview,
  wiringReviewBytes,
} from '../helpers/codex-review-wiring.js';
import type { CapabilityRun } from '../helpers/codex-wiring-score.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const repo = path.resolve(import.meta.dirname, '../../../..');

it('covered seed rejects the observed endpoint mutant that passes the old four cases', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-wiring-endpoint-'));
  roots.push(root);
  writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  const before = seedWiringReview(root, 'covered');
  const source = before['clamp.js'];
  const tests = before['clamp.test.js'];
  if (!source || !tests) throw new Error('Covered seed source or tests missing');
  const run = (...args: string[]) =>
    spawnSync(path.join(repo, 'scripts/dev'), ['node', ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
    });
  const control = path.join(
    repo,
    'packages/cli/tests/fixtures/host-contract/codex-node-control.mjs',
  );
  const baseline = run(control, '(?!)');
  expect(baseline.status, baseline.stderr).toBe(0);
  try {
    writeFileSync(
      path.join(root, 'clamp.js'),
      source.replace(
        'return Math.min(max, Math.max(min, value));',
        'return value > min && value < max ? value : (value < min ? min : max);',
      ),
    );
    const witness = run(
      '--input-type=module',
      '-e',
      "import {clamp} from './clamp.js'; console.log(clamp(0,0,10));",
    );
    expect(witness.status, witness.stderr).toBe(0);
    expect(witness.stdout.trim()).toBe('10');
    const current = run(control, '(?!)');
    expect(current.status, 'COVERED_CONTROL_ENDPOINT_MUTANT_SURVIVED').toBe(1);
    expect(JSON.parse(current.stdout)).toMatchObject({ passed: 5, failed: 1, success: false });
    writeFileSync(
      path.join(root, 'clamp.test.js'),
      tests
        .split('\n')
        .filter(line => !/^test\('value (?:0|10)',/u.test(line))
        .join('\n'),
    );
    const oldFour = run(control, '(?!)');
    expect(oldFour.status, oldFour.stderr).toBe(0);
    expect(JSON.parse(oldFour.stdout)).toMatchObject({ passed: 4, failed: 0, success: true });
  } finally {
    for (const [name, bytes] of Object.entries(before)) writeFileSync(path.join(root, name), bytes);
  }
  expect(wiringReviewBytes(root)).toEqual(before);
});

it('green isolated collaborator tests conceal a real exported-entrypoint fault', () => {
  for (const arm of ['defective', 'covered'] as const) {
    const root = mkdtempSync(path.join(tmpdir(), 'safeword-wiring-control-'));
    roots.push(root);
    writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    const before = seedWiringReview(root, arm);
    const proof = proveWiringFixture(root, arm);
    expect(proof.stream).toMatchObject({ passed: 6, failed: 0, success: true });
    const run = (...args: string[]) =>
      spawnSync(path.join(repo, 'scripts/dev'), ['node', ...args], { cwd: root, encoding: 'utf8' });
    const suite = run('--test', 'clamp.test.js');
    expect(suite.status, suite.stderr).toBe(0);
    expect(suite.stdout).toMatch(/[#ℹ] pass 6/u);
    // An independent entrypoint call, absent from the isolated suite, exposes swapped bounds.
    const counterexample = run(
      '--input-type=module',
      '-e',
      "import {clamp} from './clamp.js'; if(clamp(4,0,10)!==4) process.exit(2);",
    );
    expect(counterexample.status).toBe(arm === 'defective' ? 1 : 0);
    expect(wiringReviewBytes(root)).toEqual(before);
  }
});

function judgment(message: string, severity: 'error' | 'warning' = 'error'): CapabilityRun {
  return {
    fixture_id: 'defective',
    run: 1,
    verdict: 'request_changes',
    findings: [{ severity, message }],
  };
}
it.each([
  'clamp has no tests through its real collaborator; add entrypoint coverage to catch the swapped bounds.',
  'Tests only test constrain, bypassing clamp. Exercise the entry point with integration tests using the real implementation.',
  '`clamp` has **no tests through** its real collaborator; **add** entrypoint coverage to catch the swapped bounds.',
])('accepts an actionable missing-collaborator finding: %s', message => {
  expect(() => {
    assertWiringJudgment('defective', judgment(message));
  }).not.toThrow();
});
it.each([
  'clamp swaps min and max; fix the argument order.',
  'Add tests for clamp.',
  'clamp has no test coverage.',
  'clamp has no real collaborator test coverage.',
  'clamp passes swapped bounds to constrain; add a regression test for argument order.',
  'clamp passes swapped bounds to constrain; missing reorder; address it with tests.',
  'clamp is not missing real collaborator coverage; add tests only for optional examples.',
  'clamp has no wiring coverage gap; exercise the entrypoint in an optional example.',
  'tests do not exercise clamp; no need to add coverage.',
])('rejects an incomplete or argument-only finding: %s', message => {
  expect(() => {
    assertWiringJudgment('defective', judgment(message));
  }).toThrow('INTERNAL_WORKFLOW_UNMET');
});
it.each([
  'clamp is not missing **real collaborator** coverage; add tests only for optional examples.',
  'clamp is not missing `real collaborator` coverage; add tests only for optional examples.',
  'clamp has no **wiring** coverage gap; exercise the entrypoint in an optional example.',
  'tests do not exercise clamp; no need **to add coverage**.',
])('rejects Markdown negation like its plain equivalent: %s', message => {
  for (const finding of [message.replaceAll(/[*`]/gu, ''), message]) {
    const run = judgment(finding);
    const before = structuredClone(run);
    expect(() => {
      assertWiringJudgment('defective', run);
    }).toThrow('INTERNAL_WORKFLOW_UNMET');
    expect(run).toEqual(before);
  }
});
it('does not pool coverage and remedy concepts across unrelated error findings', () => {
  const run = judgment('clamp lacks real collaborator tests.');
  expect(() => {
    assertWiringJudgment('defective', {
      ...run,
      findings: [
        ...run.findings,
        { severity: 'error', message: 'Add an integration test for a different entrypoint.' },
      ],
    });
  }).toThrow('INTERNAL_WORKFLOW_UNMET');
});
it('rejects always-approve and always-warn while accepting the covered control', () => {
  const approve: CapabilityRun = {
    fixture_id: 'covered',
    run: 1,
    verdict: 'approve',
    findings: [],
  };
  expect(() => {
    assertWiringJudgment('covered', approve);
  }).not.toThrow();
  expect(() => {
    assertWiringJudgment('defective', { ...approve, fixture_id: 'defective' });
  }).toThrow();
  expect(() => {
    assertWiringJudgment(
      'defective',
      judgment('clamp lacks real collaborator tests; add coverage.', 'warning'),
    );
  }).toThrow();
  expect(() => {
    assertWiringJudgment('covered', {
      ...judgment('clamp lacks real collaborator tests; add coverage.'),
      fixture_id: 'covered',
    });
  }).toThrow();
});
