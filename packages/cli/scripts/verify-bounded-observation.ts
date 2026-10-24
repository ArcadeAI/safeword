import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import {
  expectCompleteObservation,
  observerRepo,
  runObserverCli,
} from '../tests/fixtures/bounded-observation.js';

function git(argv: string[]): string {
  return execFileSync('git', argv, { cwd: observerRepo, encoding: 'utf8' }).trim();
}

function historySnapshot(): string {
  const paths = git(['ls-files', '.project/tickets', 'features'])
    .split('\n')
    .filter(path =>
      /T3E4NS|5F5ZZA|82T411|C7HCN7|keep-bounded-planning|keep-plan-reviews/u.test(path),
    );
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(path).update('\0');
    hash.update(readFileSync(nodePath.join(observerRepo, path))).update('\0');
  }
  return hash.digest('hex');
}

assert.equal(git(['status', '--porcelain']), '', 'Commit the complete candidate before the pilot');
const commit = git(['rev-parse', 'HEAD']);
const before = historySnapshot();
const candidate = {
  root: observerRepo,
  directory: observerRepo,
  environment: process.env,
  commit,
  dispose: () => {
    // The pilot owns no disposable checkout; this repository belongs to the contributor.
  },
};
const result = runObserverCli(candidate, ['proof', 'observe-bounded-delivery']);
expectCompleteObservation(result, candidate);
const id = result.output.data?.attempt_id;
assert.ok(id);
const verified = runObserverCli(candidate, ['proof', 'verify-bounded-delivery', id]);
assert.equal(verified.exitCode, 0, verified.stdout + verified.stderr);
assert.equal(verified.output.ok, true);
assert.equal(verified.output.data?.current, true);
assert.equal(verified.output.data.attempt_id, id);
assert.equal(verified.output.data.authority, 'execution-only');
assert.equal(git(['rev-parse', 'HEAD']), commit, 'The producing commit must remain unchanged');
assert.equal(git(['status', '--porcelain']), '', 'The pilot must leave the checkout clean');
assert.equal(
  historySnapshot(),
  before,
  'Original history and deferral evidence must remain unchanged',
);
console.log(
  JSON.stringify(
    {
      producing_revision: commit,
      observation: result.output.data,
      verification: verified.output.data,
      history_sha256: before,
    },
    undefined,
    2,
  ),
);
