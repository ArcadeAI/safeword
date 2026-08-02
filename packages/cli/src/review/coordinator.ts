import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import type { ReviewerOutput, ReviewKind } from './contract.js';
import { buildReviewPacket } from './packet.js';
import { oppositeReviewer } from './policy.js';
import { runHeadlessReviewer } from './runtime.js';

function validatedOutput(
  output: ReviewerOutput,
  assignedReviewer: 'claude' | 'codex',
  dispatchId: string,
): boolean {
  return (
    output.schema_version === 1 &&
    output.reviewer_agent === assignedReviewer &&
    output.dispatch_id === dispatchId &&
    (output.verdict === 'approve' || output.verdict === 'request_changes')
  );
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
      state: 'action_required',
      findings: [
        {
          code: 'REVIEW_EXISTING_ROUTE',
          message: 'An independent cross-agent check was not run for this author runtime.',
          severity: 'warning',
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
  if (!validatedOutput(output, reviewer, packet.dispatch_id)) {
    throw new Error(`Review output did not match the assigned ${reviewer} dispatch`);
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
      independence: 'cross-agent',
      reviewer_output: output,
    },
  });
}
