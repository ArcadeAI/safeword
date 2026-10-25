/* eslint-disable vitest/no-import-node-test -- A Node parent avoids nesting the observed Vitest lane. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createObserverCandidate,
  expectCompleteObservation,
  expectFixedRequestRefusal,
  runObserverCli,
  runSubstitutedCommand,
} from '../fixtures/bounded-observation.js';

for (const placement of ['boolean', 'separate-value', 'attached-value'] as const) {
  void test(`interleaved global options preserve fixed observation recovery (${placement})`, () => {
    const candidate = createObserverCandidate();
    try {
      const options = {
        boolean: ['--json'],
        'separate-value': ['--cwd', candidate.root, '--json'],
        'attached-value': [`--cwd=${candidate.root}`, '--json'],
      }[placement];
      const result = runObserverCli(candidate, [
        'proof',
        ...options,
        'observe-bounded-delivery',
        '--command',
        `touch ${candidate.directory}/caller-command-ran`,
      ]);
      assert.equal(result.exitCode, 1, result.stdout);
      assert.ok(
        result.output.errors?.some(
          error => error.code === 'CLI_ARGUMENT_INVALID' && error.message.includes('--command'),
        ),
        result.stdout,
      );
      assert.ok(
        result.output.next_actions?.some(
          action => action.command === 'safeword proof observe-bounded-delivery',
        ),
        `Interleaved global options must preserve fixed observation recovery: ${result.stdout}`,
      );
      expectFixedRequestRefusal(result, candidate);
    } finally {
      candidate.dispose();
    }
  });
}

void test('real profile produces complete verifiable evidence', { timeout: 900_000 }, () => {
  const candidate = createObserverCandidate();
  try {
    const observation = runObserverCli(candidate, ['proof', 'observe-bounded-delivery']);
    expectCompleteObservation(observation, candidate);
    const attempt = observation.output.data?.attempt_id;
    assert.ok(attempt);
    const verified = runObserverCli(candidate, ['proof', 'verify-bounded-delivery', attempt]);
    assert.equal(verified.exitCode, 0, verified.stdout + verified.stderr);
    assert.equal(verified.output.ok, true);
    assert.equal(verified.output.data?.status, 'observed');
    assert.equal(verified.output.data.current, true);
    assert.equal(verified.output.data.attempt_id, attempt);
    assert.equal(verified.output.data.authority, 'execution-only');
  } finally {
    candidate.dispose();
  }
});

void test('caller command substitution is refused with the fixed recovery request', () => {
  const candidate = createObserverCandidate();
  try {
    expectFixedRequestRefusal(runSubstitutedCommand(candidate), candidate);
  } finally {
    candidate.dispose();
  }
});
