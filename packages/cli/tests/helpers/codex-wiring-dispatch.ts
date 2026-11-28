import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { reviewJobs } from './codex-review-authentication.js';
import {
  authenticatedWiringGrade,
  type CandidateModel,
  wiringReference,
} from './codex-wiring-grade.js';

/** Existing coordinator only; caller owns a NEW isolated grading project/profile.
 * This component binds actual dispatch context, not just reference-file existence.
 */
export function dispatchWiringClaim(
  locations: Parameters<typeof authenticatedWiringGrade>[0],
  claim: string,
  candidates: CandidateModel[],
) {
  const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: immutable fresh claim dispatch';
  const before = reviewJobs(locations.project);
  assert.deepEqual(before, [], unavailable);
  const reference = readFileSync(wiringReference, 'utf8');
  const models = structuredClone(candidates);
  const claimPath = path.join(locations.project, 'claim.json');
  const referencePath = path.join(locations.project, 'reference.md');
  writeFileSync(claimPath, claim, { flag: 'wx' });
  writeFileSync(referencePath, reference, { flag: 'wx' });
  const unchanged = () => {
    assert.equal(readFileSync(claimPath, 'utf8'), claim, unavailable);
    assert.equal(readFileSync(referencePath, 'utf8'), reference, unavailable);
    assert.equal(readFileSync(wiringReference, 'utf8'), reference, unavailable);
  };
  assert.ok(locations.bun && locations.environment, unavailable);
  const budget = Number(locations.environment.SAFEWORD_REVIEW_RUN_BOUND_MS);
  const foreground = Number(locations.environment.SAFEWORD_REVIEW_FOREGROUND_MS);
  assert.ok(
    Number.isFinite(budget) && budget > 0 && foreground <= 540_000 && foreground >= budget + 60_000,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: unsafe isolated review wait budget',
  );
  const runtime = path.join(locations.installed, 'runtime/cli.js');
  const owned = {
    ...locations,
    environment: { ...locations.environment, SAFEWORD_CLI_ENTRYPOINT: runtime },
  };
  const run = spawnSync(
    locations.bun,
    [
      runtime,
      'review',
      'run',
      'quality-review',
      '--agent-handoff',
      '--json',
      '--context',
      'reference.md',
      '--',
      'claim.json',
    ],
    {
      cwd: locations.project,
      env: owned.environment,
      encoding: 'utf8',
      timeout: 600_000,
    },
  );
  writeFileSync(
    path.join(locations.artifacts, 'claim-dispatch.json'),
    JSON.stringify({
      status: run.status,
      error: run.error?.message,
      stdout: run.stdout,
      stderr: run.stderr,
    }),
  );
  assert.equal(run.error, undefined, unavailable);
  assert.equal(run.status, 0, unavailable);
  const response = JSON.parse(run.stdout);
  const id = (response.data as { review_id?: string })?.review_id;
  assert.ok(id && /^[\da-f-]{36}$/u.test(id), unavailable);
  assert.deepEqual(reviewJobs(locations.project), [id], unavailable);
  unchanged();
  return {
    id,
    response,
    read() {
      unchanged();
      return authenticatedWiringGrade(owned, before, { id, claim, candidates: models });
    },
  };
}
