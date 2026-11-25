import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { type CapabilityRun, scoreCapabilityRun } from './codex-wiring-score.js';

export type WiringArm = 'defective' | 'covered';
const launcher = nodePath.resolve(import.meta.dirname, '../../../../scripts/dev');
const targets = ['clamp.js', 'clamp.test.js'] as const;

/** One real collaborator and its exported entrypoint, both visible in the normal review packet. */
export function seedWiringReview(project: string, arm: WiringArm): Record<string, string> {
  const call = arm === 'defective' ? 'value, max, min' : 'value, min, max';
  writeFileSync(
    nodePath.join(project, targets[0]),
    'export function constrain(value, min, max) { if (min > max) throw new RangeError("min exceeds max"); return Math.min(max, Math.max(min, value)); }\n' +
      `export function clamp(value, min, max) { return constrain(${call}); }\n`,
  );
  const subject = arm === 'defective' ? 'constrain' : 'clamp';
  writeFileSync(
    nodePath.join(project, targets[1]),
    `import {test} from 'node:test'; import assert from 'node:assert/strict'; import {${subject}} from './clamp.js';\n${[
      [-2, 0, 10, 0],
      [12, 0, 10, 10],
      [4, 0, 10, 4],
      [0, 0, 10, 0],
      [10, 0, 10, 10],
    ]
      .map(
        ([value, min, max, expected]) =>
          `test('value ${value}',()=>assert.equal(${subject}(${value},${min},${max}),${expected}));\n`,
      )
      .join('')}test('invalid range',()=>assert.throws(()=>${subject}(0,2,1),RangeError));\n`,
  );
  return wiringReviewBytes(project);
}

export function wiringReviewBytes(project: string): Record<string, string> {
  return Object.fromEntries(
    targets.map(target => [target, readFileSync(nodePath.join(project, target), 'utf8')]),
  );
}

/** Trusted Given control, not a native task or a model judgment. */
export function proveWiringFixture(project: string, arm: WiringArm) {
  const run = (...args: string[]) =>
    spawnSync(launcher, ['node', ...args], { cwd: project, encoding: 'utf8', timeout: 30_000 });
  const suite = run(
    nodePath.resolve(import.meta.dirname, '../fixtures/host-contract/codex-node-control.mjs'),
    '(?!)',
  );
  assert.equal(suite.status, 0, `HOST_CONTRACT_PROOF_UNAVAILABLE: fixture tests ${suite.stderr}`);
  const stream = JSON.parse(suite.stdout) as { passed: number; failed: number; success: boolean };
  assert.deepEqual([stream.passed, stream.failed, stream.success], [6, 0, true]);
  const counterexample = run(
    '--input-type=module',
    '-e',
    'import assert from "node:assert/strict"; import {clamp} from "./clamp.js"; assert.equal(clamp(4,0,10),4);',
  );
  assert.equal(counterexample.error, undefined);
  assert.equal(counterexample.status, arm === 'defective' ? 1 : 0);
  if (arm === 'defective') assert.match(counterexample.stderr, /RangeError: min exceeds max/u);
  return {
    kind: 'fixture-control-not-native-judgment',
    stream,
    counterexample: { status: counterexample.status, stderr: counterexample.stderr },
  };
}

/** Fixed known-fact lexical calibration, not a general semantic grader or mutation score. */
export function assertWiringJudgment(arm: WiringArm, run: CapabilityRun): void {
  const accepted = scoreCapabilityRun(
    {
      id: arm,
      verdict: arm === 'defective' ? 'request_changes' : 'approve',
      required: [],
      forbidden:
        arm === 'defective'
          ? [
              'not missing real collaborator',
              'no wiring coverage gap',
              'no missing wiring',
              'no coverage gap',
              'no need to add coverage',
            ]
          : [],
      ...(arm === 'defective' && {
        finding_groups: [
          ['clamp'],
          [
            'no tests through',
            'only test constrain',
            'only cover constrain',
            'bypassing clamp',
            'tests bypass',
            'never calls clamp',
            'missing real collaborator coverage',
            'missing wiring coverage',
            'lacks entrypoint coverage',
            'untested entrypoint',
            'no tests call',
            'no test calls',
            'tests do not exercise',
          ],
          ['add ', 'exercise ', 'test through ', 'call clamp', 'invoke clamp'],
          ['test', 'coverage'],
        ],
      }),
    },
    {
      ...run,
      // Use the same word boundaries for this fixture's positive and forbidden phrases.
      // Normalize a scoring copy only; keep the authenticated observation unchanged.
      findings: run.findings.map(finding => ({
        ...finding,
        message: finding.message.replaceAll(/[^\p{L}\p{N}]+/gu, ' '),
      })),
    },
  );
  assert.ok(
    accepted,
    `INTERNAL_WORKFLOW_UNMET: ${arm} Wiring-gate judgment did not distinguish real-collaborator coverage`,
  );
}
