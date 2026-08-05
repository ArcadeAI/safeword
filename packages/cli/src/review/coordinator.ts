import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { type CliResult, createResult } from '../cli-protocol/result.js';
import type {
  ReviewAgent,
  ReviewAuthor,
  ReviewerOutput,
  ReviewFailure,
  ReviewKind,
  ReviewPolicy,
  UnverifiedReviewerOutput,
} from './contract.js';
import { prepareReviewPacket } from './packet.js';
import { oppositeReviewPair, readReviewPolicy } from './policy.js';
import { ReviewRuntimeError, runHeadlessReviewer } from './runtime.js';

function verifyProvenance(
  output: UnverifiedReviewerOutput,
  assignedReviewer: ReviewAgent,
  dispatchId: string,
):
  | { readonly kind: 'verified'; readonly output: ReviewerOutput }
  | {
      readonly kind: 'failed';
      readonly code: 'REVIEWER_PROVENANCE_MISSING' | 'REVIEWER_PROVENANCE_CONTRADICTORY';
    } {
  if (typeof output.reviewer_agent !== 'string' || output.reviewer_agent === '') {
    return { kind: 'failed', code: 'REVIEWER_PROVENANCE_MISSING' };
  }
  if (output.reviewer_agent !== assignedReviewer || output.dispatch_id !== dispatchId) {
    return { kind: 'failed', code: 'REVIEWER_PROVENANCE_CONTRADICTORY' };
  }
  return { kind: 'verified', output: output as ReviewerOutput };
}

async function executeReview(
  reviewer: 'claude' | 'codex',
  prepared: ReturnType<typeof prepareReviewPacket>,
): Promise<{
  outcome:
    | { readonly kind: 'completed'; readonly output: UnverifiedReviewerOutput }
    | { readonly kind: 'failed'; readonly failure: ReviewFailure };
  sourceChanged: boolean;
  snapshotChanged: boolean;
}> {
  let outcome:
    | { readonly kind: 'completed'; readonly output: UnverifiedReviewerOutput }
    | { readonly kind: 'failed'; readonly failure: ReviewFailure };
  try {
    const output = await runHeadlessReviewer(
      reviewer,
      prepared.packet,
      prepared.workspace,
      prepared.sourceRoot,
    );
    outcome = { kind: 'completed', output };
  } catch (error) {
    if (!(error instanceof ReviewRuntimeError)) {
      prepared.cleanup();
      throw error;
    }
    outcome = { kind: 'failed', failure: error.failure };
  }
  try {
    return {
      outcome,
      sourceChanged: prepared.sourceChanged(),
      snapshotChanged: prepared.snapshotChanged(),
    };
  } finally {
    prepared.cleanup();
  }
}

function assessFallback(
  outcome:
    | { readonly kind: 'completed'; readonly output: UnverifiedReviewerOutput }
    | { readonly kind: 'failed'; readonly failure: ReviewFailure },
  reviewer: ReviewAgent,
  dispatchId: string,
):
  | { readonly kind: 'completed'; readonly output: ReviewerOutput }
  | { readonly kind: 'failed'; readonly failure: string } {
  if (outcome.kind === 'failed') return outcome;
  const provenance = verifyProvenance(outcome.output, reviewer, dispatchId);
  return provenance.kind === 'failed'
    ? { kind: 'failed', failure: provenance.code }
    : { kind: 'completed', output: provenance.output };
}

function shellQuote(value: string): string {
  if (/^[\w./-]+$/u.test(value)) return value;
  const escaped = value.replaceAll("'", `'"'"'`);
  return `'${escaped}'`;
}

function retryCommand(kind: ReviewKind, targets: readonly string[]): string {
  return `safeword review run ${kind} ${targets.map(target => shellQuote(target)).join(' ')}`;
}

function recoveryDescription(reviewer: ReviewAgent, failure: ReviewFailure): string {
  const name = reviewer === 'codex' ? 'Codex' : 'Claude';
  if (failure === 'not_installed') return `Install ${name}, then retry the independent review.`;
  if (failure === 'not_authenticated')
    return `Sign in to ${name}, then retry the independent review.`;
  return 'Retry the independent review.';
}

function unsupportedAuthorResult(input: {
  readonly author: ReviewAuthor;
  readonly policy: ReviewPolicy;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
}): CliResult {
  if (input.policy === 'require') {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'REVIEW_AUTHOR_UNSUPPORTED',
          message: 'A required opposite-agent review needs a Claude or Codex author identity.',
          severity: 'warning',
        },
      ],
      recovery: [
        {
          command: retryCommand(input.kind, input.targets),
          description: 'Run this review from Claude or Codex.',
          requiresHuman: true,
        },
      ],
      data: {
        command: 'review run',
        status: 'blocked',
        author_agent: input.author,
        independence: 'none',
      },
    });
  }
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
      author_agent: input.author,
      independence: 'none',
    },
  });
}

function changedReviewResult(input: {
  readonly author: ReviewAgent;
  readonly reviewer: ReviewAgent;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly sourceChanged: boolean;
  readonly snapshotChanged: boolean;
}): CliResult | undefined {
  if (input.snapshotChanged) {
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
        network: [{ kind: 'review', target: input.reviewer, operation: 'request' }],
      },
      data: {
        command: 'review run',
        status: 'blocked',
        author_agent: input.author,
        assigned_reviewer: input.reviewer,
        independence: 'none',
      },
    });
  }
  if (!input.sourceChanged) return undefined;
  return createResult({
    state: 'failed',
    errors: [
      {
        code: 'REVIEW_SOURCE_CHANGED',
        message: 'A reviewed source changed during the check; no passing evidence was recorded.',
        retryable: true,
      },
    ],
    effects: {
      network: [{ kind: 'review', target: input.reviewer, operation: 'request' }],
    },
    recovery: [
      {
        command: retryCommand(input.kind, input.targets),
        description: 'Retry the independent review against the current source.',
        requiresHuman: false,
      },
    ],
    data: {
      command: 'review run',
      status: 'blocked',
      author_agent: input.author,
      assigned_reviewer: input.reviewer,
      independence: 'none',
    },
  });
}

async function runDegradedFallback(input: {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly author: ReviewAgent;
  readonly assignedReviewer: ReviewAgent;
  readonly preferredFailure: ReviewFailure;
  readonly policy: ReviewPolicy;
}): Promise<CliResult> {
  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets);
  const { outcome, sourceChanged, snapshotChanged } = await executeReview(input.author, prepared);
  const changedResult = changedReviewResult({
    author: input.author,
    reviewer: input.author,
    kind: input.kind,
    targets: input.targets,
    sourceChanged,
    snapshotChanged,
  });
  if (changedResult !== undefined) return changedResult;
  const assessment = assessFallback(outcome, input.author, prepared.packet.dispatch_id);
  if (assessment.kind === 'failed') {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'REVIEW_ROUTES_EXHAUSTED',
          message: 'The independent check did not run, and the fallback did not complete safely.',
          severity: 'warning',
        },
      ],
      recovery: [
        {
          command: retryCommand(input.kind, input.targets),
          description: recoveryDescription(input.assignedReviewer, input.preferredFailure),
          requiresHuman: true,
        },
      ],
      data: {
        command: 'review run',
        status: 'blocked',
        author_agent: input.author,
        assigned_reviewer: input.assignedReviewer,
        preferred_failure: input.preferredFailure,
        fallback_failure: assessment.failure,
        independence: 'none',
      },
    });
  }
  const completedOutput = assessment.output;

  if (input.policy === 'require') {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'REVIEW_INDEPENDENCE_REQUIRED',
          message:
            'The check ran, but it was not fully independent, so the cross-agent gate remains unsatisfied.',
          severity: 'warning',
        },
      ],
      effects: {
        network: [
          { kind: 'review', target: input.assignedReviewer, operation: 'request' },
          { kind: 'review', target: input.author, operation: 'request' },
        ],
      },
      recovery: [
        {
          command: retryCommand(input.kind, input.targets),
          description: `Restore the ${input.assignedReviewer === 'codex' ? 'Codex' : 'Claude'} reviewer, then retry the independent review.`,
          requiresHuman: true,
        },
      ],
      data: {
        command: 'review run',
        status: 'blocked',
        author_agent: input.author,
        assigned_reviewer: input.assignedReviewer,
        actual_reviewer: completedOutput.reviewer_agent,
        preferred_failure: input.preferredFailure,
        independence: 'degraded',
        reviewer_output: completedOutput,
      },
    });
  }

  return createResult({
    state: completedOutput.verdict === 'approve' ? 'healthy' : 'action_required',
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
      status: completedOutput.verdict === 'approve' ? 'approved' : 'changes_requested',
      author_agent: input.author,
      assigned_reviewer: input.assignedReviewer,
      actual_reviewer: completedOutput.reviewer_agent,
      preferred_failure: input.preferredFailure,
      independence: 'degraded',
      reviewer_output: completedOutput,
    },
  });
}

export async function runReview(input: {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
}): Promise<CliResult> {
  const author = resolveRunIdentity({}, { env: process.env }).runtime;
  const policy = readReviewPolicy(input.cwd);
  if (policy === 'off') {
    return createResult({
      state: 'healthy',
      findings: [
        {
          code: 'REVIEW_NOT_REQUESTED',
          message: 'An independent agent check was not requested.',
          severity: 'info',
        },
      ],
      data: {
        command: 'review run',
        status: 'existing_route',
        author_agent: author,
        independence: 'none',
        cross_agent_review: 'not_requested',
      },
    });
  }
  const pair = oppositeReviewPair(author);
  if (pair === undefined) {
    return unsupportedAuthorResult({ author, policy, kind: input.kind, targets: input.targets });
  }
  const { reviewer } = pair;

  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets);
  const { outcome, sourceChanged, snapshotChanged } = await executeReview(reviewer, prepared);
  const changedResult = changedReviewResult({
    author: pair.author,
    reviewer,
    kind: input.kind,
    targets: input.targets,
    sourceChanged,
    snapshotChanged,
  });
  if (changedResult !== undefined) return changedResult;
  if (outcome.kind === 'failed') {
    return runDegradedFallback({
      ...input,
      author: pair.author,
      assignedReviewer: reviewer,
      preferredFailure: outcome.failure,
      policy,
    });
  }
  const provenance = verifyProvenance(outcome.output, reviewer, prepared.packet.dispatch_id);
  if (provenance.kind === 'failed') {
    const provenanceError = provenance.code;
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
  const output = provenance.output;

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
