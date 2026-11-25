import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { CliResult } from '../../src/cli-protocol/result.js';
import { prepareReviewPacket } from '../../src/review/packet.js';
import { productParentContextIdentity } from '../../src/review/planning-context-identity.js';
import { SAFEWORD_TRANSIENT_PATHS } from '../../src/schema.js';
import { readReviewReceipt } from '../../templates/hooks/lib/read-receipt.js';
import type { ReviewReceipt } from '../../templates/hooks/lib/review-receipt.js';
import { nativeWorkflowEnvironment } from './codex-internal-workflows.js';
import { correlatedReview } from './codex-review-receipt.js';
import type { NativeTurn } from './codex-workflow-observation.js';

export function reviewJobs(project: string): string[] {
  const relative = SAFEWORD_TRANSIENT_PATHS.find(path => path.endsWith('/reviews/'));
  assert.ok(relative);
  try {
    return readdirSync(nodePath.join(project, relative))
      .filter(file => /^[\da-f-]{36}\.json$/u.test(file))
      .map(file => file.slice(0, -5));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

interface ReviewLocations {
  project: string;
  profile: string;
  installed: string;
  artifacts: string;
  bun?: string;
  environment?: NodeJS.ProcessEnv;
}
interface StagedReviewRequirement {
  reviewId: string;
  targets: string[];
  context: string[];
  exact?: boolean;
}
interface ReviewedStagingInputs {
  receipt: ReviewReceipt;
  sourceFingerprint: string;
  context: string[];
}

function coversReviewPaths(project: string, wanted: string[], actual: readonly string[]): boolean {
  return (
    wanted.length > 0 &&
    wanted.every(wantedPath =>
      actual.some(
        candidate => nodePath.resolve(project, candidate) === nodePath.resolve(project, wantedPath),
      ),
    )
  );
}

function capturedStagingContext(
  project: string,
  required: StagedReviewRequirement,
  receipt: ReviewReceipt,
  context: string[],
): string[] {
  const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: staging review';
  // Reuse the normal capture owner; never infer captured scope from job.context.
  const captured = prepareReviewPacket(project, 'quality-review', receipt.targets ?? [], context);
  try {
    const projected = productParentContextIdentity(captured.packet);
    const fullFiles = captured.packet.logical_files.filter(
      file => file.representation === undefined,
    );
    const fullContext = (captured.packet.context_files ?? []).filter(
      file => !projected.has(file.path),
    );
    assert.ok(
      coversReviewPaths(
        project,
        required.targets,
        fullFiles.map(file => file.path),
      ),
      `${unavailable} targets incomplete`,
    );
    assert.ok(
      coversReviewPaths(
        project,
        required.context,
        fullContext.map(file => file.path),
      ),
      `${unavailable} context incomplete`,
    );
    if (required.exact) {
      assert.equal(captured.excludedTargets.length, 0, `${unavailable} excluded targets`);
      assert.equal(
        fullFiles.length,
        captured.packet.logical_files.length,
        `${unavailable} representations differ`,
      );
      assert.equal(
        fullContext.length,
        captured.packet.context_files?.length ?? 0,
        `${unavailable} representations differ`,
      );
      const absolute = (paths: readonly string[]) =>
        paths.map(file => nodePath.resolve(project, file)).toSorted((a, b) => a.localeCompare(b));
      assert.deepEqual(
        absolute(fullFiles.map(file => file.path)),
        absolute(required.targets),
        `${unavailable} targets differ`,
      );
      assert.deepEqual(
        absolute(fullContext.map(file => file.path)),
        absolute(required.context),
        `${unavailable} context differs`,
      );
    }
    // The normal verifier re-fingerprints this exact job after capture. A stable
    // snapshot then binds the returned scope to those authenticated current bytes.
    const current = readReviewReceipt(required.reviewId, project);
    assert.equal(current?.status, 'approved', `${unavailable} not approved/current`);
    assert.equal(captured.sourceChanged(), false, `${unavailable} sources changed during capture`);
    assert.equal(
      captured.snapshotChanged(),
      false,
      `${unavailable} snapshot changed during capture`,
    );
    return fullContext.map(file => file.path);
  } finally {
    captured.cleanup();
  }
}

/** Read coverage only after the normal, distribution-owned status verifier
 * authenticates this exact unchanged job and re-fingerprints its inputs.
 * This reads existing coordinator state; it never signs or approves anything.
 */
function stagedReview(project: string, required: StagedReviewRequirement): ReviewedStagingInputs {
  const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: staging review';
  assert.ok(reviewJobs(project).includes(required.reviewId), `${unavailable} missing`);
  const directory = SAFEWORD_TRANSIENT_PATHS.find(path => path.endsWith('/reviews/'));
  assert.ok(directory);
  const file = nodePath.join(project, directory, `${required.reviewId}.json`);
  const before = readFileSync(file, 'utf8');
  const receipt = readReviewReceipt(required.reviewId, project);
  assert.ok(receipt?.status === 'approved', `${unavailable} not approved/current`);
  assert.equal(readFileSync(file, 'utf8'), before, `${unavailable} changed during validation`);
  assert.equal(receipt.kind, 'quality-review', `${unavailable} kind differs`);
  assert.equal(receipt.independence, 'cross-agent', `${unavailable} not independent`);
  assert.ok(
    receipt.actualReviewer && receipt.actualReviewer !== receipt.authorAgent,
    `${unavailable} reviewer same as author`,
  );
  assert.equal(receipt.excludedTargets?.length ?? 0, 0, `${unavailable} excluded targets`);
  const record = JSON.parse(before) as {
    id: string;
    source_fingerprint: string;
    context?: string[];
  };
  assert.equal(record.id, required.reviewId, `${unavailable} foreign`);
  assert.ok(
    typeof record.source_fingerprint === 'string' && record.source_fingerprint.length > 0,
    `${unavailable} fingerprint missing`,
  );
  const context = capturedStagingContext(project, required, receipt, record.context ?? []);
  assert.equal(readFileSync(file, 'utf8'), before, `${unavailable} changed during validation`);
  return { receipt, sourceFingerprint: record.source_fingerprint, context };
}

/** Authentication/current fingerprint validation belongs to the normal installed coordinator. */
export function authenticatedReviewStatus(locations: ReviewLocations, before: string[]): CliResult;
export function authenticatedReviewStatus(
  locations: ReviewLocations,
  before: string[],
  staging: StagedReviewRequirement,
): ReviewedStagingInputs;
export function authenticatedReviewStatus(
  locations: ReviewLocations,
  before: string[],
  staging?: StagedReviewRequirement,
) {
  if (staging) return stagedReview(locations.project, staging);
  const { project, profile, installed, artifacts } = locations;
  const fresh = reviewJobs(project).filter(id => !before.includes(id));
  assert.equal(
    fresh.length,
    1,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: ambiguous or absent fresh review job',
  );
  const runtime = nodePath.join(installed, 'runtime/cli.js');
  const args = [
    ...(locations.bun ? [] : ['bun']),
    runtime,
    'review',
    'status',
    fresh[0] ?? '',
    '--cwd',
    project,
    '--json',
  ];
  const query = spawnSync(
    locations.bun ?? nodePath.resolve(import.meta.dirname, '../../../../scripts/dev'),
    args,
    {
      cwd: project,
      env: locations.environment ?? nativeWorkflowEnvironment(profile),
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
  writeFileSync(
    nodePath.join(artifacts, 'review-authentication.json'),
    JSON.stringify(
      {
        args,
        status: query.status,
        error: query.error?.message,
        stdout: query.stdout,
        stderr: query.stderr,
      },
      undefined,
      2,
    ),
  );
  assert.equal(query.error, undefined, 'HOST_CONTRACT_PROOF_UNAVAILABLE: review status process');
  const status = JSON.parse(query.stdout) as CliResult;
  const data = status.data as { status?: string; review_id?: string };
  assert.equal(data?.review_id, fresh[0], 'HOST_CONTRACT_PROOF_UNAVAILABLE: foreign review status');
  assert.equal(
    query.status,
    data.status === 'approved' ? 0 : 2,
    'HOST_CONTRACT_PROOF_UNAVAILABLE: review status exit',
  );
  return status;
}

export function authenticatedWiringReview(
  locations: Parameters<typeof authenticatedReviewStatus>[0],
  before: string[],
  turn: NativeTurn,
) {
  const status = authenticatedReviewStatus(locations, before);
  return correlatedReview(
    turn,
    nodePath.join(locations.installed, 'runtime/cli.js'),
    status,
    locations.project,
  );
}
