import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import type { ProgressReporter } from '../cli-protocol/handler.js';
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

function agentName(agent: ReviewAgent): 'Claude' | 'Codex' {
  return agent === 'codex' ? 'Codex' : 'Claude';
}

function recoveryDescription(reviewer: ReviewAgent, failure: ReviewFailure): string {
  const name = agentName(reviewer);
  if (failure === 'not_installed') return `Install ${name}, then retry the independent review.`;
  if (failure === 'not_authenticated')
    return `Sign in to ${name}, then retry the independent review.`;
  return 'Retry the independent review.';
}

function degradedDescription(
  assignedReviewer: ReviewAgent,
  actualReviewer: ReviewAgent,
  failure: ReviewFailure,
): string {
  if (failure === 'not_installed') {
    const assignedName = agentName(assignedReviewer);
    return `${assignedName} is not installed. Install ${assignedName} for fully independent reviews; Safe Word continued with a ${agentName(actualReviewer)} review.`;
  }
  return 'The check ran, but it was not fully independent.';
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

/**
 * The coordinator announces and keeps a wait visible, but never ends the
 * reporter — the command runner owns `stop()` in its `finally`.
 */
type ReviewProgress = Pick<ProgressReporter, 'start' | 'heartbeat'>;

type ReviewRunInput = {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly progress?: ReviewProgress;
};

/**
 * Prepare the primary reviewer's packet while narrating the wait.
 *
 * The dispatch announcement supersedes the preparation one: the reporter emits
 * only an announcement still pending after 100ms, so packet preparation is
 * announced when it is slow enough to matter and stays silent otherwise.
 */
function preparePrimaryReview(
  input: ReviewRunInput,
  reviewer: ReviewAgent,
): ReturnType<typeof prepareReviewPacket> {
  const name = agentName(reviewer);
  input.progress?.start(`Preparing the review packet for ${name}…`);
  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets);
  input.progress?.start(`Requesting an independent ${name} review…`);
  input.progress?.heartbeat?.(`Still waiting for a response from ${name}…`);
  return prepared;
}

/** Narrate the fallback the same way, so both routes read identically. */
function prepareFallbackReview(
  input: ReviewRunInput,
  assignedReviewer: ReviewAgent,
  author: ReviewAgent,
): ReturnType<typeof prepareReviewPacket> {
  const fallbackName = agentName(author);
  input.progress?.start(
    `${agentName(assignedReviewer)} did not complete; trying a ${fallbackName} fallback…`,
  );
  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets);
  input.progress?.heartbeat?.(`Still waiting for a response from the ${fallbackName} fallback…`);
  return prepared;
}

async function runDegradedFallback(
  input: ReviewRunInput & {
    readonly author: ReviewAgent;
    readonly assignedReviewer: ReviewAgent;
    readonly preferredFailure: ReviewFailure;
    readonly policy: ReviewPolicy;
  },
): Promise<CliResult> {
  const prepared = prepareFallbackReview(input, input.assignedReviewer, input.author);
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
          description: `Restore the ${agentName(input.assignedReviewer)} reviewer, then retry the independent review.`,
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
        message: degradedDescription(
          input.assignedReviewer,
          completedOutput.reviewer_agent,
          input.preferredFailure,
        ),
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

export async function runReview(input: ReviewRunInput): Promise<CliResult> {
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

  const prepared = preparePrimaryReview(input, reviewer);
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
