import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';

import { authenticatedWiringReview } from './codex-review-authentication.js';
import { wiringReviewBytes } from './codex-review-wiring.js';
import type { CandidateModel } from './codex-wiring-grade.js';

export interface NativeWiringCandidate {
  locations: Parameters<typeof authenticatedWiringReview>[0];
  before: string[];
  turn: Parameters<typeof authenticatedWiringReview>[2];
  bytes: Record<string, string>;
}

/** Both inputs are producer-owned dispatch snapshots, never candidate-supplied claims.
 * Reauthenticate current signed status AND native call/output before creating the view.
 */
export function pairedWiringClaim(inputs: [NativeWiringCandidate, NativeWiringCandidate]) {
  const unavailable = 'HOST_CONTRACT_PROOF_UNAVAILABLE: paired current native claim';
  assert.notEqual(
    realpathSync(inputs[0].locations.project),
    realpathSync(inputs[1].locations.project),
    unavailable,
  );
  const candidates: CandidateModel[] = [];
  const provenance: ReturnType<typeof authenticatedWiringReview>[] = [];
  const projects = inputs.map(input => {
    assert.deepEqual(wiringReviewBytes(input.locations.project), input.bytes, unavailable);
    const receipt = authenticatedWiringReview(input.locations, input.before, input.turn);
    const data = receipt.provenance as {
      actual_reviewer: string;
      confirmed_reviewer_model?: CandidateModel['confirmed'];
      independence: string;
    };
    assert.equal(data.actual_reviewer, 'claude', unavailable);
    assert.deepEqual(
      data.confirmed_reviewer_model,
      { provider: 'anthropic', model: 'claude-opus-5' },
      unavailable,
    );
    assert.ok(['cross-agent', 'degraded'].includes(data.independence), unavailable);
    assert.deepEqual(wiringReviewBytes(input.locations.project), input.bytes, unavailable);
    candidates.push({ agent: data.actual_reviewer, confirmed: data.confirmed_reviewer_model });
    provenance.push(receipt);
    return {
      id: randomUUID(),
      files: input.bytes,
      review: {
        verdict: receipt.output.verdict,
        findings: receipt.output.findings.map(({ severity, message }) => ({ severity, message })),
      },
    };
  });
  // Shuffle only the neutral view; original roles and receipt order stay in provenance.
  if (randomInt(2) === 1) projects.reverse();
  return {
    claim: `${JSON.stringify({ claim: 'Each candidate review satisfies reference.md for its supplied source and tests.', projects }, undefined, 2)}\n`,
    candidates,
    provenance,
  };
}
