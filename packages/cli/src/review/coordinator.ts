import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import type { ReviewerOutput, ReviewKind } from './contract.js';
import { buildReviewPacket } from './packet.js';
import { oppositeReviewer } from './policy.js';
import { assignedReviewerModel, runHeadlessReviewer } from './runtime.js';

function provenanceFailure(
  output: ReviewerOutput,
  assignedReviewer: 'claude' | 'codex',
  dispatchId: string,
): 'REVIEWER_PROVENANCE_MISSING' | 'REVIEWER_PROVENANCE_CONTRADICTORY' | undefined {
  if (output.reviewer_agent === undefined) return 'REVIEWER_PROVENANCE_MISSING';
  if (output.reviewer_agent !== assignedReviewer || output.dispatch_id !== dispatchId) {
    return 'REVIEWER_PROVENANCE_CONTRADICTORY';
  }
  return undefined;
}

export async function runReview(input: {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
}): Promise<CliResult> {
  const author = resolveRunIdentity({}, { env: process.env }).runtime;
  const reviewer = oppositeReviewer(author);
  if (reviewer === undefined) {
    return createResult({
      state: 'healthy',
      findings: [
        {
          code: 'REVIEW_EXISTING_ROUTE',
          message: 'An independent cross-agent check was not run for this author runtime.',
          severity: 'info',
        },
      ],
      data: {
        command: 'review run',
        status: 'existing_route',
        author_agent: author,
        independence: 'none',
      },
    });
  }

  const packet = buildReviewPacket(input.cwd, input.kind, input.targets);
  const output = await runHeadlessReviewer(reviewer, packet);
  const provenanceError = provenanceFailure(output, reviewer, packet.dispatch_id);
  if (provenanceError !== undefined) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: provenanceError,
          message:
            provenanceError === 'REVIEWER_PROVENANCE_MISSING'
              ? 'The reviewer result did not identify the reviewer.'
              : `The reviewer result contradicted the assigned ${reviewer} dispatch.`,
          retryable: false,
        },
      ],
      effects: {
        network: [{ kind: 'review', target: reviewer, operation: 'request' }],
      },
      data: {
        command: 'review run',
        status: 'blocked',
        author_agent: author,
        assigned_reviewer: reviewer,
        independence: 'none',
      },
    });
  }

  return createResult({
    state: output.verdict === 'approve' ? 'healthy' : 'action_required',
    findings: [
      {
        code: 'REVIEW_INDEPENDENCE',
        message: 'An independent agent checked the work.',
        severity: 'info',
      },
    ],
    effects: {
      network: [{ kind: 'review', target: reviewer, operation: 'request' }],
    },
    data: {
      command: 'review run',
      status: output.verdict === 'approve' ? 'approved' : 'changes_requested',
      author_agent: author,
      assigned_reviewer: reviewer,
      actual_reviewer: output.reviewer_agent,
      assigned_model: assignedReviewerModel(reviewer),
      independence: 'cross-agent',
      reviewer_output: output,
    },
  });
}
