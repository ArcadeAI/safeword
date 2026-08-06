import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import { type CliResult, createResult, type Effect } from '../cli-protocol/result.js';
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
import { oppositeReviewPair, readAlternateReviewerModel, readReviewPolicy } from './policy.js';
import { minimumRouteMs, ReviewRuntimeError, runBoundMs, runHeadlessReviewer } from './runtime.js';

/**
 * Whether a route can still be funded. Below the minimum a route cannot produce
 * a real review, so it is left unattempted and reported honestly rather than
 * launched into a deadline it cannot meet.
 */
function canFundRoute(runDeadline: number): boolean {
  return runDeadline - Date.now() >= minimumRouteMs();
}

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

function independentReviewResult(input: {
  readonly author: ReviewAuthor;
  readonly reviewer: ReviewAgent;
  readonly output: ReviewerOutput;
  readonly model?: string;
  readonly preferredFailure?: ReviewFailure;
}): CliResult {
  return createResult({
    state: input.output.verdict === 'approve' ? 'healthy' : 'action_required',
    findings: [
      {
        code: 'REVIEW_INDEPENDENCE',
        message: 'An independent agent checked the work.',
        severity: 'info',
      },
    ],
    effects: {
      network: [{ kind: 'review', target: input.reviewer, operation: 'request' }],
    },
    data: {
      command: 'review run',
      status: input.output.verdict === 'approve' ? 'approved' : 'changes_requested',
      author_agent: input.author,
      assigned_reviewer: input.reviewer,
      actual_reviewer: input.output.reviewer_agent,
      ...(input.model !== undefined && { reviewer_model: input.model }),
      ...(input.preferredFailure !== undefined && { preferred_failure: input.preferredFailure }),
      independence: 'cross-agent',
      reviewer_output: input.output,
    },
  });
}

async function executeReview(
  reviewer: 'claude' | 'codex',
  prepared: ReturnType<typeof prepareReviewPacket>,
  model?: string,
  runDeadline?: number,
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
      { model, runDeadline },
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
  // `--` ends option parsing, so a reviewed file named `--help` or `-r` reaches
  // the command as a target rather than as a flag. Shell quoting cannot do this:
  // it is the argument parser, not the shell, that would misread the name.
  const quoted = targets.map(target => shellQuote(target)).join(' ');
  return `safeword review run ${kind} -- ${quoted}`;
}

/** How an agent is written for a reader: the product name, not the runtime id. */
function agentName(agent: ReviewAgent): string {
  return agent === 'codex' ? 'Codex' : 'Claude';
}

/**
 * What went wrong on one route, in words a reader who cannot see the code can
 * act on. Built only from Safe Word's own classification — never from anything
 * the reviewer printed, which may carry credentials or a rejected answer.
 */
function causePhrase(failure: string): string {
  switch (failure) {
    case 'timed_out': {
      return 'ran out of time';
    }
    case 'not_installed': {
      return 'is not installed, or is too old to be used';
    }
    case 'not_authenticated': {
      return 'is not signed in';
    }
    case 'invalid_output': {
      return 'gave an answer that could not be accepted';
    }
    case 'source_changed': {
      return 'was reviewing files that changed underneath it';
    }
    case 'REVIEWER_PROVENANCE_MISSING':
    case 'REVIEWER_PROVENANCE_CONTRADICTORY': {
      return 'gave an answer that did not identify it as the reviewer';
    }
    default: {
      return 'could not be run';
    }
  }
}

/** One sentence per attempted route, each naming its own cause. */
function exhaustedExplanation(
  routes: readonly {
    readonly agent: ReviewAgent;
    readonly role: string;
    readonly failure: string;
  }[],
): string {
  const sentences = routes.map(
    route => `The ${route.role} (${agentName(route.agent)}) ${causePhrase(route.failure)}.`,
  );
  return [...sentences, 'No independent check was recorded.'].join(' ');
}

/** The single next step, chosen from the assigned reviewer's own failure. */
function nextStepFor(reviewer: ReviewAgent, failure: ReviewFailure): string {
  const name = agentName(reviewer);
  if (failure === 'not_installed') return `Install or update ${name}, then run the review again.`;
  if (failure === 'not_authenticated') return `Sign in to ${name}, then run the review again.`;
  return 'Run the review again.';
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

function alternateFailureData(
  failure: string | undefined,
): Record<string, never> | { readonly alternate_model_failure: string } {
  return failure === undefined ? {} : { alternate_model_failure: failure };
}

function degradedNetworkEffects(
  assignedReviewer: ReviewAgent,
  author: ReviewAgent,
  alternateAttempted: boolean,
): readonly Effect[] {
  const preferred = { kind: 'review', target: assignedReviewer, operation: 'request' } as const;
  const fallback = { kind: 'review', target: author, operation: 'request' } as const;
  return alternateAttempted ? [preferred, preferred, fallback] : [preferred, fallback];
}

async function runDegradedFallback(input: {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly author: ReviewAgent;
  readonly assignedReviewer: ReviewAgent;
  readonly preferredFailure: ReviewFailure;
  readonly policy: ReviewPolicy;
  readonly runDeadline: number;
  readonly alternateFailure?: string;
}): Promise<CliResult> {
  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets);
  const { outcome, sourceChanged, snapshotChanged } = await executeReview(
    input.author,
    prepared,
    undefined,
    input.runDeadline,
  );
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
          message: exhaustedExplanation([
            {
              agent: input.assignedReviewer,
              role: 'independent reviewer',
              failure: input.preferredFailure,
            },
            ...(input.alternateFailure === undefined
              ? []
              : [
                  {
                    agent: input.assignedReviewer,
                    role: 'same reviewer on its alternate model',
                    failure: input.alternateFailure,
                  },
                ]),
            { agent: input.author, role: 'fallback review', failure: assessment.failure },
          ]),
          severity: 'warning',
        },
      ],
      recovery: [
        {
          command: retryCommand(input.kind, input.targets),
          description: nextStepFor(input.assignedReviewer, input.preferredFailure),
          requiresHuman: true,
        },
      ],
      data: {
        command: 'review run',
        status: 'blocked',
        author_agent: input.author,
        assigned_reviewer: input.assignedReviewer,
        preferred_failure: input.preferredFailure,
        ...alternateFailureData(input.alternateFailure),
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
        network: degradedNetworkEffects(
          input.assignedReviewer,
          input.author,
          input.alternateFailure !== undefined,
        ),
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
        ...alternateFailureData(input.alternateFailure),
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
      network: degradedNetworkEffects(
        input.assignedReviewer,
        input.author,
        input.alternateFailure !== undefined,
      ),
    },
    data: {
      command: 'review run',
      status: completedOutput.verdict === 'approve' ? 'approved' : 'changes_requested',
      author_agent: input.author,
      assigned_reviewer: input.assignedReviewer,
      actual_reviewer: completedOutput.reviewer_agent,
      preferred_failure: input.preferredFailure,
      ...alternateFailureData(input.alternateFailure),
      independence: 'degraded',
      reviewer_output: completedOutput,
    },
  });
}

/**
 * The reviewer agent retried on its configured alternate model. Returns
 * undefined when no model is configured or the retry did not produce a
 * verifiable review, leaving the caller to fall back to the author's own
 * runtime exactly as before.
 */
async function runAlternateModelRoute(input: {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly author: ReviewAgent;
  readonly reviewer: ReviewAgent;
  readonly preferredFailure: ReviewFailure;
  readonly runDeadline: number;
}): Promise<
  | { readonly kind: 'completed'; readonly result: CliResult }
  | { readonly kind: 'failed'; readonly failure: string }
  | { readonly kind: 'skipped' }
> {
  const model = readAlternateReviewerModel(input.cwd, input.reviewer);
  if (model === undefined || !canFundRoute(input.runDeadline)) return { kind: 'skipped' };

  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets);
  const { outcome, sourceChanged, snapshotChanged } = await executeReview(
    input.reviewer,
    prepared,
    model,
    input.runDeadline,
  );
  const changedResult = changedReviewResult({
    author: input.author,
    reviewer: input.reviewer,
    kind: input.kind,
    targets: input.targets,
    sourceChanged,
    snapshotChanged,
  });
  if (changedResult !== undefined) return { kind: 'completed', result: changedResult };
  const assessment = assessFallback(outcome, input.reviewer, prepared.packet.dispatch_id);
  if (assessment.kind === 'failed') return { kind: 'failed', failure: assessment.failure };
  const output = assessment.output;

  const result = independentReviewResult({
    author: input.author,
    reviewer: input.reviewer,
    output,
    model,
    preferredFailure: input.preferredFailure,
  });
  return { kind: 'completed', result };
}

/**
 * Everything after the assigned reviewer failed: the alternate model, then the
 * author's own runtime, each only while the run bound can still fund it.
 */
async function runRemainingRoutes(input: {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly author: ReviewAgent;
  readonly assignedReviewer: ReviewAgent;
  readonly preferredFailure: ReviewFailure;
  readonly policy: ReviewPolicy;
  readonly runDeadline: number;
}): Promise<CliResult> {
  const alternate = await runAlternateModelRoute({
    cwd: input.cwd,
    kind: input.kind,
    targets: input.targets,
    author: input.author,
    reviewer: input.assignedReviewer,
    preferredFailure: input.preferredFailure,
    runDeadline: input.runDeadline,
  });
  if (alternate.kind === 'completed') return alternate.result;
  // An attempted-and-failed alternate model is part of the story; a skipped one
  // never happened and must not be reported as a route that failed.
  const alternateFailure = alternate.kind === 'failed' ? alternate.failure : undefined;
  if (!canFundRoute(input.runDeadline)) return exhaustedRunResult({ ...input, alternateFailure });
  return runDegradedFallback({ ...input, alternateFailure });
}

/** The run bound arrived before a later route could be funded. */
function exhaustedRunResult(input: {
  readonly author: ReviewAgent;
  readonly assignedReviewer: ReviewAgent;
  readonly preferredFailure: ReviewFailure;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly alternateFailure?: string;
}): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'REVIEW_ROUTES_EXHAUSTED',
        message: exhaustedExplanation([
          {
            agent: input.assignedReviewer,
            role: 'independent reviewer',
            failure: input.preferredFailure,
          },
          ...(input.alternateFailure === undefined
            ? []
            : [
                {
                  agent: input.assignedReviewer,
                  role: 'same reviewer on its alternate model',
                  failure: input.alternateFailure,
                },
              ]),
        ]),
        severity: 'warning',
      },
    ],
    recovery: [
      {
        command: retryCommand(input.kind, input.targets),
        description: nextStepFor(input.assignedReviewer, input.preferredFailure),
        requiresHuman: true,
      },
    ],
    data: {
      command: 'review run',
      status: 'blocked',
      author_agent: input.author,
      assigned_reviewer: input.assignedReviewer,
      preferred_failure: input.preferredFailure,
      independence: 'none',
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

  // One bound for the whole run, set before the first route starts.
  const runDeadline = Date.now() + runBoundMs();
  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets);
  const { outcome, sourceChanged, snapshotChanged } = await executeReview(
    reviewer,
    prepared,
    undefined,
    runDeadline,
  );
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
    // Before settling for the author reviewing its own work, give the reviewer
    // agent one more attempt on a configured alternate model. It is still not
    // the author, so a completed review there is fully independent.
    return runRemainingRoutes({
      ...input,
      author: pair.author,
      assignedReviewer: reviewer,
      preferredFailure: outcome.failure,
      policy,
      runDeadline,
    });
  }
  const provenance = verifyProvenance(outcome.output, reviewer, prepared.packet.dispatch_id);
  if (provenance.kind === 'failed') {
    // Missing or contradictory provenance is invalid reviewer output: never
    // accept it as evidence, but give the remaining bounded routes the same
    // opportunity they receive after parse- or schema-invalid output.
    return runRemainingRoutes({
      ...input,
      author: pair.author,
      assignedReviewer: reviewer,
      preferredFailure: 'invalid_output',
      policy,
      runDeadline,
    });
  }
  const output = provenance.output;

  return independentReviewResult({ author, reviewer, output });
}
