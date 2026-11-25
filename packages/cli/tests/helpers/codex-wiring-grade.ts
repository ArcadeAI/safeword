import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { ReviewerOutput } from '../../src/review/contract.js';
import type { ConfirmedReviewerModel } from '../../src/review/runtime.js';
import { authenticatedReviewStatus } from './codex-review-authentication.js';
import {
  compareReviewerCapability,
  PACKAGED_CAPABILITY_PAIRS,
  PACKAGED_CAPABILITY_REVISION,
} from './codex-wiring-capability.js';

const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: current qualified claim review';
export const wiringReference = path.resolve(
  import.meta.dirname,
  '../fixtures/host-contract/codex-wiring-reference.md',
);
export interface CandidateModel {
  agent: string;
  confirmed: ConfirmedReviewerModel;
}
interface GradeData {
  review_id: string;
  review_kind: string;
  review_targets: string[];
  status: string;
  actual_reviewer: string;
  confirmed_reviewer_model?: ConfirmedReviewerModel;
  independence: string;
  reviewer_output: ReviewerOutput;
}

function qualified(data: GradeData, candidates: CandidateModel[]): void {
  const model = data.confirmed_reviewer_model;
  assert.ok(model && data.actual_reviewer === 'codex', unavailable);
  assert.deepEqual(model, { provider: 'openai', model: 'gpt-6-astra' }, unavailable);
  assert.ok(['cross-agent', 'degraded'].includes(data.independence), unavailable);
  assert.ok(candidates.length > 0 && candidates.length <= 2, unavailable);
  for (const candidate of candidates) {
    assert.equal(candidate.agent, 'claude', unavailable);
    assert.deepEqual(
      candidate.confirmed,
      { provider: 'anthropic', model: 'claude-opus-5' },
      unavailable,
    );
    assert.equal(
      compareReviewerCapability(
        candidate.confirmed,
        model,
        PACKAGED_CAPABILITY_REVISION,
        PACKAGED_CAPABILITY_PAIRS,
      ),
      'not_weaker',
      unavailable,
    );
  }
}

/** Status-reader component only. Producer must authenticate both original candidates
 * and supply the exact fresh dispatch ID/view; no aggregate JSON carries authority.
 */
export function authenticatedWiringGrade(
  locations: Parameters<typeof authenticatedReviewStatus>[0],
  before: string[],
  expected: { id: string; claim: string; candidates: CandidateModel[] },
) {
  assert.equal(
    readFileSync(path.join(locations.project, 'claim.json'), 'utf8'),
    expected.claim,
    unavailable,
  );
  assert.equal(
    readFileSync(path.join(locations.project, 'reference.md'), 'utf8'),
    readFileSync(wiringReference, 'utf8'),
    unavailable,
  );
  const result = authenticatedReviewStatus(locations, before);
  const data = result.data as GradeData;
  assert.equal(data?.review_id, expected.id, unavailable);
  assert.equal(data.review_kind, 'quality-review', unavailable);
  assert.deepEqual(data.review_targets, ['claim.json'], unavailable);
  qualified(data, expected.candidates);
  const approved = data.status === 'approved';
  assert.ok(approved || data.status === 'changes_requested', unavailable);
  assert.equal(result.state, approved ? 'healthy' : 'action_required', unavailable);
  assert.equal(data.reviewer_output?.reviewer_agent, data.actual_reviewer, unavailable);
  assert.ok(data.reviewer_output.dispatch_id, unavailable);
  assert.equal(data.reviewer_output.verdict, approved ? 'approve' : 'request_changes', unavailable);
  assert.equal(
    data.reviewer_output.findings.some(finding => finding.severity === 'error'),
    !approved,
    unavailable,
  );
  return { accepted: approved, reviewId: data.review_id, provenance: result.data };
}
