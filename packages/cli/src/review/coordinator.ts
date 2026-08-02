import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import type { ReviewAgent, ReviewerOutput, ReviewFailure, ReviewKind } from './contract.js';
import { prepareReviewPacket } from './packet.js';
import { oppositeReviewer } from './policy.js';
import { assignedReviewerModel, ReviewRuntimeError, runHeadlessReviewer } from './runtime.js';

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

async function executeReview(
  reviewer: 'claude' | 'codex',
  prepared: ReturnType<typeof prepareReviewPacket>,
): Promise<{ output?: ReviewerOutput; failure?: ReviewFailure; changed: boolean }> {
  let output: ReviewerOutput | undefined;
  let failure: ReviewFailure | undefined;
  try {
    output = await runHeadlessReviewer(reviewer, prepared.packet, prepared.workspace);
  } catch (error) {
    if (!(error instanceof ReviewRuntimeError)) {
      prepared.cleanup();
      throw error;
    }
    failure = error.failure;
  }
  const changed = prepared.changed();
  prepared.cleanup();
  return { output, failure, changed };
}

async function runDegradedFallback(input: {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly author: ReviewAgent;
  readonly assignedReviewer: ReviewAgent;
  readonly preferredFailure: ReviewFailure;
}): Promise<CliResult> {
  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets);
  const { output, failure, changed } = await executeReview(input.author, prepared);
  const provenanceError =
    output === undefined
      ? undefined
      : provenanceFailure(output, input.author, prepared.packet.dispatch_id);
  if (changed || failure !== undefined || output === undefined || provenanceError !== undefined) {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'REVIEW_ROUTES_EXHAUSTED',
          message: 'The independent check did not run, and the fallback did not complete safely.',
          severity: 'warning',
        },
      ],
      data: {
        command: 'review run',
        status: 'blocked',
        author_agent: input.author,
        assigned_reviewer: input.assignedReviewer,
        preferred_failure: input.preferredFailure,
        fallback_failure: changed ? 'source_changed' : (failure ?? provenanceError),
        independence: 'none',
      },
    });
  }

  return createResult({
    state: output.verdict === 'approve' ? 'healthy' : 'action_required',
    findings: [
      {
        code: 'REVIEW_INDEPENDENCE_DEGRADED',
        message: 'The check ran, but it was not fully independent.',
        severity: 'warning',
      },
    ],
    effects: {
      network: [
        { kind: 'review', target: input.assignedReviewer, operation: 'request' },
        { kind: 'review', target: input.author, operation: 'request' },
      ],
    },
    data: {
      command: 'review run',
      status: output.verdict === 'approve' ? 'approved' : 'changes_requested',
      author_agent: input.author,
      assigned_reviewer: input.assignedReviewer,
      actual_reviewer: output.reviewer_agent,
      assigned_model: assignedReviewerModel(input.author),
      preferred_failure: input.preferredFailure,
      independence: 'degraded',
      reviewer_output: output,
    },
  });
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

  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets);
  const { output, failure: preferredFailure, changed } = await executeReview(reviewer, prepared);
  if (changed) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'REVIEWER_WRITE_ATTEMPT',
          message:
            'The reviewer changed its disposable work packet; no passing evidence was recorded.',
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
  if (preferredFailure !== undefined) {
    return runDegradedFallback({
      ...input,
      author: author as ReviewAgent,
      assignedReviewer: reviewer,
      preferredFailure,
    });
  }
  if (output === undefined) throw new Error('Review completed without output or failure');
  const provenanceError = provenanceFailure(output, reviewer, prepared.packet.dispatch_id);
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
