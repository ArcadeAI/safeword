import { resolveRunIdentity } from '../../templates/hooks/lib/run-identity.js';
import type { ProgressReporter } from '../cli-protocol/handler.js';
import { type CliResult, createResult, type Effect, type Finding } from '../cli-protocol/result.js';
import { retryCommand } from './command.js';
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
import {
  oppositeReviewPair,
  readAlternateReviewerModel,
  readPrimaryReviewerModel,
  readReviewPolicy,
} from './policy.js';
import { minimumRouteMs, ReviewRuntimeError, runBoundMs, runHeadlessReviewer } from './runtime.js';

/** The command runner owns reporter shutdown; review routing only updates it. */
type ReviewProgress = Pick<ProgressReporter, 'start' | 'heartbeat'>;

type ReviewRunInput = {
  readonly cwd: string;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly context?: readonly string[];
  readonly progress?: ReviewProgress;
};

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
  if (
    typeof output.reviewer_agent !== 'string' ||
    output.reviewer_agent === '' ||
    typeof output.dispatch_id !== 'string' ||
    output.dispatch_id === ''
  ) {
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
  readonly preferredModel?: string;
  readonly preferredFailure?: ReviewFailure;
}): CliResult {
  return createResult({
    state: input.output.verdict === 'approve' ? 'healthy' : 'action_required',
    findings: [
      {
        code: 'REVIEW_INDEPENDENCE',
        message: `A different agent (${agentName(input.reviewer)}) checked the work in a separate headless process.`,
        severity: 'info',
      },
      ...reviewerFeedback(input.output),
    ],
    effects: {
      network: [
        ...networkEffectsForFailure(input.reviewer, input.preferredFailure),
        reviewRequest(input.reviewer),
      ],
    },
    data: {
      command: 'review run',
      status: input.output.verdict === 'approve' ? 'approved' : 'changes_requested',
      author_agent: input.author,
      assigned_reviewer: input.reviewer,
      actual_reviewer: input.output.reviewer_agent,
      ...(input.model !== undefined && { reviewer_model: input.model }),
      ...(input.preferredModel !== undefined && { preferred_model: input.preferredModel }),
      ...(input.preferredFailure !== undefined && { preferred_failure: input.preferredFailure }),
      independence: 'cross-agent',
      reviewer_output: input.output,
    },
  });
}

/** Project validated reviewer feedback into the public result as well as typed metadata. */
function reviewerFeedback(output: ReviewerOutput): readonly Finding[] {
  return [
    {
      code: 'REVIEWER_SUMMARY',
      message: terminalSafeReviewerText(output.summary),
      severity: 'info',
    },
    ...output.findings.map(finding => ({
      code: 'REVIEWER_FINDING',
      message: terminalSafeReviewerText(finding.message),
      severity: finding.severity,
    })),
  ];
}

const MAX_TERMINAL_REVIEWER_TEXT_LENGTH = 2000;

function terminalSafeReviewerText(value: string): string {
  const sanitized = value.replaceAll(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ');
  const characters = sanitized.match(/[\s\S]/gu) ?? [];
  if (characters.length <= MAX_TERMINAL_REVIEWER_TEXT_LENGTH) return sanitized;
  return `${characters.slice(0, MAX_TERMINAL_REVIEWER_TEXT_LENGTH - 1).join('')}…`;
}

async function executeReview(
  reviewer: 'claude' | 'codex',
  prepared: ReturnType<typeof prepareReviewPacket>,
  model?: string,
  runDeadline?: number,
): Promise<{
  outcome:
    | { readonly kind: 'completed'; readonly output: UnverifiedReviewerOutput }
    | { readonly kind: 'failed'; readonly failure: ReviewFailure; readonly terminal: boolean };
  sourceChanged: boolean;
  snapshotChanged: boolean;
}> {
  let outcome:
    | { readonly kind: 'completed'; readonly output: UnverifiedReviewerOutput }
    | { readonly kind: 'failed'; readonly failure: ReviewFailure; readonly terminal: boolean };
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
    outcome = { kind: 'failed', failure: error.failure, terminal: error.terminal };
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

function assessReviewOutcome(
  outcome:
    | { readonly kind: 'completed'; readonly output: UnverifiedReviewerOutput }
    | { readonly kind: 'failed'; readonly failure: ReviewFailure; readonly terminal: boolean },
  reviewer: ReviewAgent,
  dispatchId: string,
):
  | { readonly kind: 'completed'; readonly output: ReviewerOutput }
  | { readonly kind: 'failed'; readonly failure: ReviewFailure; readonly terminal: boolean } {
  if (outcome.kind === 'failed') return outcome;
  const provenance = verifyProvenance(outcome.output, reviewer, dispatchId);
  return provenance.kind === 'failed'
    ? { kind: 'failed', failure: provenance.code, terminal: false }
    : { kind: 'completed', output: provenance.output };
}

/** How an agent is written for a reader: the product name, not the runtime id. */
function agentName(agent: ReviewAgent): string {
  return agent === 'codex' ? 'Codex' : 'Claude';
}

/** The vendor-owned interactive login flow for a reviewer profile. */
function reviewerLoginCommand(agent: ReviewAgent): string {
  return agent === 'codex' ? 'codex login' : 'claude auth login';
}

const FAILURE_CAUSES: Readonly<Record<string, string>> = {
  process_failed: 'exited before returning a review',
  timed_out: 'ran out of time',
  not_installed: 'was not found on PATH',
  untrusted_install: 'was found under an untrusted writable directory',
  unsupported: 'does not support the required review flags',
  probe_timed_out: 'did not complete its compatibility check in time',
  launch_failed: 'could not launch its compatibility check',
  not_authenticated: 'is not signed in',
  invalid_output: 'gave an answer that could not be accepted',
  REVIEWER_PROVENANCE_MISSING: 'gave an answer that did not identify it as the reviewer',
  REVIEWER_PROVENANCE_CONTRADICTORY: 'gave an answer that did not identify it as the reviewer',
};

/**
 * What went wrong on one route, in words a reader who cannot see the code can
 * act on. Built only from Safeword's own classification — never from anything
 * the reviewer printed, which may carry credentials or a rejected answer.
 */
function causePhrase(failure: string): string {
  return FAILURE_CAUSES[failure] ?? 'could not be run';
}

/** One sentence per attempted route, each naming its own cause. */
function exhaustedExplanation(
  routes: readonly {
    readonly agent: ReviewAgent;
    readonly role: string;
    readonly model?: string;
    readonly failure: string;
  }[],
): string {
  const sentences = routes.map(route => {
    const modelPhrase = route.model === undefined ? '' : ` using ${route.model}`;
    return `The ${route.role}${modelPhrase} (${agentName(route.agent)}) ${causePhrase(route.failure)}.`;
  });
  return [...sentences, 'No independent check was recorded.'].join(' ');
}

/** The single next step, chosen from the assigned reviewer's own failure. */
function nextStepFor(reviewer: ReviewAgent, failure: ReviewFailure): string {
  const name = agentName(reviewer);
  if (failure === 'not_installed') return `Install or update ${name}, then run the review again.`;
  if (failure === 'untrusted_install')
    return `Move ${name} to a trusted non-writable-by-group directory, then run the review again.`;
  if (failure === 'unsupported') return `Update ${name}, then run the review again.`;
  if (failure === 'probe_timed_out') return `Run ${name} --help to diagnose it, then retry review.`;
  if (failure === 'launch_failed')
    return `Run ${name} --help and fix its launch failure, then retry review.`;
  return 'Run the review again.';
}

function degradedDescription(
  assignedReviewer: ReviewAgent,
  actualReviewer: ReviewAgent,
  failure: ReviewFailure,
): string {
  // Every failure class earns its cause, not just a missing reviewer: a reader
  // deciding whether to retry needs to know the assigned reviewer timed out
  // rather than crashed. `causePhrase` already renders each class, and
  // `nextStepFor` already picks the matching action.
  return [
    `${agentName(assignedReviewer)} ${causePhrase(failure)}.`,
    `This review was not independent: the same agent (${agentName(actualReviewer)})`,
    'checked its own work in a separate headless process.',
    nextStepFor(assignedReviewer, failure),
  ].join(' ');
}

function unsupportedAuthorResult(input: {
  readonly author: ReviewAuthor;
  readonly policy: ReviewPolicy;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly context?: readonly string[];
}): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'REVIEW_ROUTES_EXHAUSTED',
        message: `No compatible independent CLI reviewer is configured for the ${input.author} author runtime. No independent check was recorded.`,
        severity: 'warning',
      },
    ],
    recovery:
      input.policy === 'require'
        ? [
            {
              command: retryCommand(input.kind, input.targets, input.context),
              description: 'Run this review in an environment with a usable independent reviewer.',
              requiresHuman: true,
            },
          ]
        : [],
    data: {
      command: 'review run',
      status: 'blocked',
      author_agent: input.author,
      review_policy: input.policy,
      independence: 'none',
    },
  });
}

function changedReviewResult(input: {
  readonly author: ReviewAgent;
  readonly reviewer: ReviewAgent;
  readonly policy: ReviewPolicy;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly context?: readonly string[];
  readonly sourceChanged: boolean;
  readonly snapshotChanged: boolean;
  readonly network?: readonly Effect[];
}): CliResult | undefined {
  const network = input.network ?? [
    { kind: 'review', target: input.reviewer, operation: 'request' },
  ];
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
        network,
      },
      data: {
        command: 'review run',
        status: 'blocked',
        author_agent: input.author,
        assigned_reviewer: input.reviewer,
        review_policy: input.policy,
        independence: 'none',
      },
    });
  }
  if (!input.sourceChanged) return undefined;
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'REVIEW_STALE',
        message: 'A reviewed source changed during the check; no passing evidence was recorded.',
        severity: 'warning',
      },
    ],
    effects: {
      network,
    },
    recovery: [
      {
        command: retryCommand(input.kind, input.targets, input.context),
        description: 'Retry the independent review against the current source.',
        requiresHuman: false,
      },
    ],
    data: {
      command: 'review run',
      status: 'stale',
      author_agent: input.author,
      assigned_reviewer: input.reviewer,
      review_policy: input.policy,
      independence: 'none',
    },
  });
}

function routeFailureData(input: {
  readonly preferredFailure: ReviewFailure;
  readonly preferredModel?: string;
  readonly alternateFailure?: ReviewFailure;
  readonly alternateModel?: string;
}): Record<string, unknown> {
  return {
    ...(input.preferredModel !== undefined && { preferred_model: input.preferredModel }),
    preferred_failure: input.preferredFailure,
    ...(input.alternateFailure !== undefined && {
      alternate_model_failure: input.alternateFailure,
      ...(input.alternateModel !== undefined && { alternate_model: input.alternateModel }),
    }),
  };
}

/**
 * Authentication is recoverable user state, not evidence that the review
 * route is unusable. The review worker is detached and cannot own an
 * interactive browser/device login, so hand that exact foreground action to
 * the calling agent before any same-agent fallback can weaken coverage.
 */
function authenticationRequiredResult(input: {
  readonly author: ReviewAgent;
  readonly assignedReviewer: ReviewAgent;
  readonly preferredFailure: ReviewFailure;
  readonly preferredModel?: string;
  readonly alternateFailure?: ReviewFailure;
  readonly alternateModel?: string;
  readonly policy: ReviewPolicy;
}): CliResult {
  const reviewer = agentName(input.assignedReviewer);
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'REVIEW_AUTHENTICATION_REQUIRED',
        message: `The independent ${reviewer} review needs authentication. Reauthenticate ${reviewer}, then retry the same review; no fallback or review evidence was recorded.`,
        severity: 'warning',
      },
    ],
    effects: {
      network: [
        ...networkEffectsForFailure(input.assignedReviewer, input.preferredFailure),
        ...networkEffectsForFailure(input.assignedReviewer, input.alternateFailure),
      ],
    },
    recovery: [
      {
        command: reviewerLoginCommand(input.assignedReviewer),
        description: `Reauthenticate ${reviewer}, then retry the original independent review.`,
        requiresHuman: true,
      },
    ],
    data: {
      command: 'review run',
      status: 'blocked',
      author_agent: input.author,
      assigned_reviewer: input.assignedReviewer,
      ...routeFailureData(input),
      review_policy: input.policy,
      independence: 'none',
    },
  });
}

function reviewRequest(reviewer: ReviewAgent): Effect {
  return { kind: 'review', target: reviewer, operation: 'request' };
}

const NON_ATTEMPT_FAILURES: ReadonlySet<ReviewFailure> = new Set([
  'not_installed',
  'untrusted_install',
  'unsupported',
  'launch_failed',
  'probe_timed_out',
]);
const ALTERNATE_MODEL_SKIP_FAILURES: ReadonlySet<ReviewFailure> = new Set([
  'not_installed',
  'untrusted_install',
  'unsupported',
]);

function networkEffectsForFailure(
  reviewer: ReviewAgent,
  failure: ReviewFailure | undefined,
): readonly Effect[] {
  return failure === undefined || NON_ATTEMPT_FAILURES.has(failure)
    ? []
    : [reviewRequest(reviewer)];
}

function degradedNetworkEffects(input: {
  readonly assignedReviewer: ReviewAgent;
  readonly author: ReviewAgent;
  readonly preferredFailure: ReviewFailure;
  readonly alternateFailure: ReviewFailure | undefined;
  readonly fallback:
    { readonly kind: 'completed' } | { readonly kind: 'failed'; failure: ReviewFailure };
}): readonly Effect[] {
  return [
    ...networkEffectsForFailure(input.assignedReviewer, input.preferredFailure),
    ...networkEffectsForFailure(input.assignedReviewer, input.alternateFailure),
    ...(input.fallback.kind === 'completed'
      ? [reviewRequest(input.author)]
      : networkEffectsForFailure(input.author, input.fallback.failure)),
  ];
}

function preparePrimaryReview(
  input: ReviewRunInput,
  reviewer: ReviewAgent,
): ReturnType<typeof prepareReviewPacket> {
  const name = agentName(reviewer);
  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets, input.context);
  input.progress?.start(`Requesting an independent ${name} review…`);
  input.progress?.heartbeat?.(`Still waiting for a response from ${name}…`);
  return prepared;
}

async function executePrimaryReview(
  input: ReviewRunInput,
  reviewer: ReviewAgent,
  primaryModel: string | undefined,
  runDeadline: number,
): Promise<
  Awaited<ReturnType<typeof executeReview>> & { model: string | undefined; dispatchId: string }
> {
  const prepared = preparePrimaryReview(input, reviewer);
  let execution = await executeReview(reviewer, prepared, primaryModel, runDeadline);
  let model = primaryModel;
  let dispatchId = prepared.packet.dispatch_id;
  // A configured model is an optional routing preference, not a prerequisite
  // for independent coverage. Alternate-model retries remain strict because
  // their only purpose is selecting that specific model.
  if (
    primaryModel !== undefined &&
    execution.outcome.kind === 'failed' &&
    execution.outcome.failure === 'unsupported' &&
    !execution.outcome.terminal &&
    canFundRoute(runDeadline)
  ) {
    const defaultPrepared = preparePrimaryReview(input, reviewer);
    const retried = await executeReview(reviewer, defaultPrepared, undefined, runDeadline);
    execution = {
      outcome: retried.outcome,
      sourceChanged: execution.sourceChanged || retried.sourceChanged,
      snapshotChanged: execution.snapshotChanged || retried.snapshotChanged,
    };
    model = undefined;
    dispatchId = defaultPrepared.packet.dispatch_id;
  }
  return { ...execution, model, dispatchId };
}

function prepareFallbackReview(
  input: ReviewRunInput,
  assignedReviewer: ReviewAgent,
  author: ReviewAgent,
): ReturnType<typeof prepareReviewPacket> {
  const fallbackName = agentName(author);
  input.progress?.start(
    `${agentName(assignedReviewer)} did not complete; trying a ${fallbackName} fallback…`,
  );
  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets, input.context);
  input.progress?.heartbeat?.(`Still waiting for a response from the ${fallbackName} fallback…`);
  return prepared;
}

async function runDegradedFallback(
  input: ReviewRunInput & {
    readonly author: ReviewAgent;
    readonly assignedReviewer: ReviewAgent;
    readonly preferredModel?: string;
    readonly preferredFailure: ReviewFailure;
    readonly policy: ReviewPolicy;
    readonly runDeadline: number;
    readonly alternateFailure?: ReviewFailure;
    readonly alternateModel?: string;
  },
): Promise<CliResult> {
  const prepared = prepareFallbackReview(input, input.assignedReviewer, input.author);
  const { outcome, sourceChanged, snapshotChanged } = await executeReview(
    input.author,
    prepared,
    undefined,
    input.runDeadline,
  );
  const fallback =
    outcome.kind === 'completed'
      ? ({ kind: 'completed' } as const)
      : ({ kind: 'failed', failure: outcome.failure } as const);
  const changedResult = changedReviewResult({
    author: input.author,
    reviewer: input.assignedReviewer,
    policy: input.policy,
    kind: input.kind,
    targets: input.targets,
    context: input.context,
    sourceChanged,
    snapshotChanged,
    network: degradedNetworkEffects({
      assignedReviewer: input.assignedReviewer,
      author: input.author,
      preferredFailure: input.preferredFailure,
      alternateFailure: input.alternateFailure,
      fallback,
    }),
  });
  if (changedResult !== undefined) return changedResult;
  const assessment = assessReviewOutcome(outcome, input.author, prepared.packet.dispatch_id);
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
              model: input.preferredModel,
              failure: input.preferredFailure,
            },
            ...(input.alternateFailure === undefined
              ? []
              : [
                  {
                    agent: input.assignedReviewer,
                    role: 'same reviewer on its alternate model',
                    model: input.alternateModel,
                    failure: input.alternateFailure,
                  },
                ]),
            { agent: input.author, role: 'fallback review', failure: assessment.failure },
          ]),
          severity: 'warning',
        },
      ],
      effects: {
        network: degradedNetworkEffects({
          assignedReviewer: input.assignedReviewer,
          author: input.author,
          preferredFailure: input.preferredFailure,
          alternateFailure: input.alternateFailure,
          fallback: { kind: 'failed', failure: assessment.failure },
        }),
      },
      recovery: [
        {
          command: retryCommand(input.kind, input.targets, input.context),
          description: nextStepFor(input.assignedReviewer, input.preferredFailure),
          requiresHuman: true,
        },
      ],
      data: {
        command: 'review run',
        status: 'blocked',
        author_agent: input.author,
        assigned_reviewer: input.assignedReviewer,
        ...routeFailureData(input),
        fallback_failure: assessment.failure,
        review_policy: input.policy,
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
          message: `This review was not independent: the same agent (${agentName(completedOutput.reviewer_agent)}) checked its own work in a separate headless process, so the cross-agent gate remains unsatisfied.`,
          severity: 'warning',
        },
        ...reviewerFeedback(completedOutput),
      ],
      effects: {
        network: degradedNetworkEffects({
          assignedReviewer: input.assignedReviewer,
          author: input.author,
          preferredFailure: input.preferredFailure,
          alternateFailure: input.alternateFailure,
          fallback: { kind: 'completed' },
        }),
      },
      recovery: [
        {
          command: retryCommand(input.kind, input.targets, input.context),
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
        ...routeFailureData(input),
        review_policy: input.policy,
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
      ...reviewerFeedback(completedOutput),
    ],
    effects: {
      network: degradedNetworkEffects({
        assignedReviewer: input.assignedReviewer,
        author: input.author,
        preferredFailure: input.preferredFailure,
        alternateFailure: input.alternateFailure,
        fallback: { kind: 'completed' },
      }),
    },
    data: {
      command: 'review run',
      status: completedOutput.verdict === 'approve' ? 'approved' : 'changes_requested',
      author_agent: input.author,
      assigned_reviewer: input.assignedReviewer,
      actual_reviewer: completedOutput.reviewer_agent,
      ...routeFailureData(input),
      independence: 'degraded',
      reviewer_output: completedOutput,
    },
  });
}

/**
 * The reviewer agent retries on its configured alternate model. The tagged
 * result either completes the review, records why the route failed, or leaves
 * the caller to continue to the author's fallback.
 */
async function runAlternateModelRoute(
  input: ReviewRunInput & {
    readonly author: ReviewAgent;
    readonly reviewer: ReviewAgent;
    readonly preferredModel?: string;
    readonly preferredFailure: ReviewFailure;
    readonly policy: ReviewPolicy;
    readonly runDeadline: number;
  },
): Promise<
  | { readonly kind: 'completed'; readonly result: CliResult }
  | {
      readonly kind: 'failed';
      readonly failure: ReviewFailure;
      readonly terminal: boolean;
      readonly model: string;
    }
  | { readonly kind: 'skipped' }
> {
  const model = readAlternateReviewerModel(input.cwd, input.reviewer);
  if (model === undefined || !canFundRoute(input.runDeadline)) return { kind: 'skipped' };

  input.progress?.start(
    `Trying ${agentName(input.reviewer)} again with the configured alternate model…`,
  );
  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets, input.context);
  input.progress?.heartbeat?.(
    `Still waiting for ${agentName(input.reviewer)} on the alternate model…`,
  );
  const { outcome, sourceChanged, snapshotChanged } = await executeReview(
    input.reviewer,
    prepared,
    model,
    input.runDeadline,
  );
  const changedResult = changedReviewResult({
    author: input.author,
    reviewer: input.reviewer,
    policy: input.policy,
    kind: input.kind,
    targets: input.targets,
    context: input.context,
    sourceChanged,
    snapshotChanged,
    network: [
      ...networkEffectsForFailure(input.reviewer, input.preferredFailure),
      ...(outcome.kind === 'failed'
        ? networkEffectsForFailure(input.reviewer, outcome.failure)
        : [reviewRequest(input.reviewer)]),
    ],
  });
  if (changedResult !== undefined) return { kind: 'completed', result: changedResult };
  const assessment = assessReviewOutcome(outcome, input.reviewer, prepared.packet.dispatch_id);
  if (assessment.kind === 'failed') {
    return resolveAlternateModelFailure(input, model, assessment);
  }
  const output = assessment.output;

  const result = independentReviewResult({
    author: input.author,
    reviewer: input.reviewer,
    output,
    model,
    preferredModel: input.preferredModel,
    preferredFailure: input.preferredFailure,
  });
  return { kind: 'completed', result };
}

function resolveAlternateModelFailure(
  input: ReviewRunInput & {
    readonly author: ReviewAgent;
    readonly reviewer: ReviewAgent;
    readonly preferredModel?: string;
    readonly preferredFailure: ReviewFailure;
    readonly policy: ReviewPolicy;
  },
  model: string,
  assessment: {
    readonly kind: 'failed';
    readonly failure: ReviewFailure;
    readonly terminal: boolean;
  },
):
  | { readonly kind: 'completed'; readonly result: CliResult }
  | {
      readonly kind: 'failed';
      readonly failure: ReviewFailure;
      readonly terminal: boolean;
      readonly model: string;
    }
  | { readonly kind: 'skipped' } {
  // A configured model is not a usable route when no installed candidate
  // advertises model selection. Capability rejection is a skip, not a review
  // attempt or failure, so it must not displace the funded fallback route.
  if (ALTERNATE_MODEL_SKIP_FAILURES.has(assessment.failure)) return { kind: 'skipped' };
  if (assessment.failure !== 'not_authenticated') return { ...assessment, model };
  return {
    kind: 'completed',
    result: authenticationRequiredResult({
      author: input.author,
      assignedReviewer: input.reviewer,
      preferredModel: input.preferredModel,
      preferredFailure: input.preferredFailure,
      alternateModel: model,
      alternateFailure: assessment.failure,
      policy: input.policy,
    }),
  };
}

/**
 * Everything after the assigned reviewer failed: the alternate model, then the
 * author's own runtime, each only while the run bound can still fund it.
 */
async function runRemainingRoutes(
  input: ReviewRunInput & {
    readonly author: ReviewAgent;
    readonly assignedReviewer: ReviewAgent;
    readonly preferredModel?: string;
    readonly preferredFailure: ReviewFailure;
    readonly policy: ReviewPolicy;
    readonly runDeadline: number;
  },
): Promise<CliResult> {
  const alternate = await runAlternateModelRoute({
    cwd: input.cwd,
    kind: input.kind,
    targets: input.targets,
    context: input.context,
    progress: input.progress,
    author: input.author,
    reviewer: input.assignedReviewer,
    preferredModel: input.preferredModel,
    preferredFailure: input.preferredFailure,
    policy: input.policy,
    runDeadline: input.runDeadline,
  });
  if (alternate.kind === 'completed') return alternate.result;
  // An attempted-and-failed alternate model is part of the story; a skipped one
  // never happened and must not be reported as a route that failed.
  const alternateFailure = alternate.kind === 'failed' ? alternate.failure : undefined;
  const alternateModel = alternate.kind === 'failed' ? alternate.model : undefined;
  if (alternate.kind === 'failed' && alternate.terminal) {
    return exhaustedRunResult({ ...input, alternateFailure, alternateModel });
  }
  if (!canFundRoute(input.runDeadline)) {
    return exhaustedRunResult({ ...input, alternateFailure, alternateModel });
  }
  return runDegradedFallback({ ...input, alternateFailure, alternateModel });
}

/** The run bound arrived before a later route could be funded. */
function exhaustedRunResult(input: {
  readonly author: ReviewAgent;
  readonly assignedReviewer: ReviewAgent;
  readonly preferredModel?: string;
  readonly preferredFailure: ReviewFailure;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly context?: readonly string[];
  readonly policy: ReviewPolicy;
  readonly alternateFailure?: ReviewFailure;
  readonly alternateModel?: string;
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
            model: input.preferredModel,
            failure: input.preferredFailure,
          },
          ...(input.alternateFailure === undefined
            ? []
            : [
                {
                  agent: input.assignedReviewer,
                  role: 'same reviewer on its alternate model',
                  model: input.alternateModel,
                  failure: input.alternateFailure,
                },
              ]),
        ]),
        severity: 'warning',
      },
    ],
    effects: {
      network: [
        ...networkEffectsForFailure(input.assignedReviewer, input.preferredFailure),
        ...networkEffectsForFailure(input.assignedReviewer, input.alternateFailure),
      ],
    },
    recovery: [
      {
        command: retryCommand(input.kind, input.targets, input.context),
        description: nextStepFor(input.assignedReviewer, input.preferredFailure),
        requiresHuman: true,
      },
    ],
    data: {
      command: 'review run',
      status: 'blocked',
      author_agent: input.author,
      assigned_reviewer: input.assignedReviewer,
      ...routeFailureData(input),
      review_policy: input.policy,
      independence: 'none',
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
    return unsupportedAuthorResult({
      author,
      policy,
      kind: input.kind,
      targets: input.targets,
      context: input.context,
    });
  }
  const { reviewer } = pair;
  const primaryModel = readPrimaryReviewerModel(input.cwd, reviewer);

  // One bound starts before initial packet sealing and covers reviewer work
  // across every route; bounded cleanup may finish after it.
  const runDeadline = Date.now() + runBoundMs();
  const {
    outcome,
    sourceChanged,
    snapshotChanged,
    model: completedModel,
    dispatchId,
  } = await executePrimaryReview(input, reviewer, primaryModel, runDeadline);
  const changedResult = changedReviewResult({
    author: pair.author,
    reviewer,
    policy,
    kind: input.kind,
    targets: input.targets,
    context: input.context,
    sourceChanged,
    snapshotChanged,
    network:
      outcome.kind === 'failed'
        ? networkEffectsForFailure(reviewer, outcome.failure)
        : [reviewRequest(reviewer)],
  });
  if (changedResult !== undefined) return changedResult;
  if (outcome.kind === 'failed') {
    if (outcome.failure === 'not_authenticated') {
      return authenticationRequiredResult({
        author: pair.author,
        assignedReviewer: reviewer,
        preferredModel: completedModel,
        preferredFailure: outcome.failure,
        policy,
      });
    }
    if (outcome.terminal) {
      return exhaustedRunResult({
        ...input,
        author: pair.author,
        assignedReviewer: reviewer,
        preferredModel: completedModel,
        preferredFailure: outcome.failure,
        policy,
      });
    }
    // Before settling for the author reviewing its own work, give the reviewer
    // agent one more attempt on a configured alternate model. It is still not
    // the author, so a completed review there is fully independent.
    return runRemainingRoutes({
      ...input,
      author: pair.author,
      assignedReviewer: reviewer,
      preferredModel: completedModel,
      preferredFailure: outcome.failure,
      policy,
      runDeadline,
    });
  }
  const provenance = verifyProvenance(outcome.output, reviewer, dispatchId);
  if (provenance.kind === 'failed') {
    // Missing or contradictory provenance is invalid reviewer output: never
    // accept it as evidence, but give the remaining bounded routes the same
    // opportunity they receive after parse- or schema-invalid output.
    return runRemainingRoutes({
      ...input,
      author: pair.author,
      assignedReviewer: reviewer,
      preferredModel: completedModel,
      preferredFailure: provenance.code,
      policy,
      runDeadline,
    });
  }
  const output = provenance.output;

  return independentReviewResult({ author: pair.author, reviewer, output, model: completedModel });
}
