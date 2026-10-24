import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import {
  createObserverCandidate,
  type ObserverCandidate,
  type ObserverCommand,
  reviewedObserverMapping,
  runObserverCli,
} from './bounded-observation.js';

const title = 'asks every phase to check both omissions and overreach against accepted authority';
export const controlledAssertion = {
  file: 'packages/cli/tests/integration/planning-scope-review.test.ts',
  fullName: `planning scope review contract ${title}`,
};

/** Faults affect only a disposable committed candidate, never the original delivery tests. */
export function createRequiredOutcomeCandidate(
  outcome: 'absent' | 'skipped' | 'failed',
): ObserverCandidate {
  const candidate = createObserverCandidate();
  try {
    assert.ok(
      reviewedObserverMapping.cases.some(row =>
        row.required_assertions.some(
          assertion =>
            assertion.file === controlledAssertion.file &&
            assertion.full_name === controlledAssertion.fullName,
        ),
      ),
      'The controlled fault must affect a reviewed required assertion',
    );
    const path = nodePath.join(candidate.root, controlledAssertion.file);
    const original = readFileSync(path, 'utf8');
    const declaration = `it('${title}', () => {`;
    assert.equal(original.split(declaration).length, 2, 'Locate exactly one real assertion');
    const changed = {
      absent: `it('controlled renamed assertion', () => {`,
      skipped: `it.skip('${title}', () => {`,
      failed: `${declaration}\n    throw new Error('controlled required assertion failure');`,
    }[outcome];
    writeFileSync(
      path,
      original.replace(declaration, () => changed),
    );
    for (const argv of [
      ['add', '--', controlledAssertion.file],
      [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'user.name=SYNTHETIC_OBSERVER',
        '-c',
        'user.email=observer@example.invalid',
        'commit',
        '--quiet',
        '-m',
        `Controlled ${outcome} required result`,
      ],
    ]) {
      execFileSync('git', argv, { cwd: candidate.root, env: candidate.environment });
    }
    candidate.commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: candidate.root,
      env: candidate.environment,
      encoding: 'utf8',
    }).trim();
    return candidate;
  } catch (error) {
    candidate.dispose();
    throw error;
  }
}

export function expectNamedRequiredRecovery(
  candidate: ObserverCandidate,
  result: ObserverCommand,
): void {
  const summary = JSON.stringify({ exitCode: result.exitCode, errors: result.output.errors });
  assert.equal(result.exitCode, 2, summary);
  assert.equal(result.output.data?.status, 'refused', result.stdout);
  assert.equal(result.output.data.authority, 'execution-only');
  const message = result.output.errors?.map(error => error.message).join('\n') ?? '';
  assert.ok(
    message.includes(controlledAssertion.fullName),
    `Required-result refusal must name the exact assertion: ${message}`,
  );
  assert.equal(
    message.includes(
      'planning scope review contract makes persona outcomes and epistemic status Product approval questions',
    ),
    false,
    'A passing required assertion must not be named as the problem',
  );
  assert.match(message, /repair|correct/iu);
  assert.match(message, /rerun/iu);
  assert.ok(
    result.output.next_actions?.some(
      action => action.command === 'safeword proof observe-bounded-delivery',
    ),
  );
  const data = result.output.data;
  const diagnosticPath = nodePath.join(nodePath.dirname(data.report_path), 'diagnostic.log');
  const diagnostic = readFileSync(diagnosticPath);
  assert.ok(diagnostic.includes(controlledAssertion.fullName));
  const before = Buffer.from(diagnostic);
  const verified = runObserverCli(candidate, ['proof', 'verify-bounded-delivery', data.attempt_id]);
  assert.notEqual(verified.exitCode, 0, verified.stdout);
  assert.equal(verified.output.data?.current, false);
  assert.deepEqual(
    readFileSync(diagnosticPath),
    before,
    'Read-only verification must retain the failed diagnostic bytes',
  );
}
