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
import type { ReviewRoute } from './policy.js';
import {
  readAlternateReviewerModel,
  readConfiguredReviewRoutes,
  readPrimaryReviewerModel,
  readReviewPolicy,
  reviewRoutePlan,
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
  readonly preferredReviewer?: ReviewAgent;
  readonly preferredModel?: string;
  readonly preferredFailure?: ReviewFailure;
  readonly alternateReviewer?: ReviewAgent;
  readonly alternateModel?: string;
  readonly alternateFailure?: ReviewFailure;
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
        ...networkEffectsForFailure(
          input.preferredReviewer ?? input.reviewer,
          input.preferredFailure,
        ),
        ...networkEffectsForFailure(input.alternateReviewer, input.alternateFailure),
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
      ...(input.alternateFailure !== undefined && {
        alternate_model_failure: input.alternateFailure,
        ...(input.alternateModel !== undefined && { alternate_model: input.alternateModel }),
      }),
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
  reviewer: ReviewAgent,
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

function assessFallback(
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
  if (agent === 'codex') return 'Codex';
  if (agent === 'opencode') return 'OpenCode';
  return 'Claude';
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
  if (failure === 'not_authenticated') return `Sign in to ${name}, then run the review again.`;
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

type RankedRouteEvidence = {
  readonly reviewer: ReviewAgent;
  readonly model?: string;
  readonly independence: ReviewRoute['independence'];
  readonly status: 'attempted' | 'skipped' | 'unattempted';
  readonly failure?: ReviewFailure;
};

const RUNTIME_WIDE_FAILURES: ReadonlySet<ReviewFailure> = new Set([
  'not_installed',
  'untrusted_install',
  'unsupported',
  'probe_timed_out',
  'launch_failed',
  'not_authenticated',
]);

function invalidRouteConfigResult(error: unknown): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'REVIEW_ROUTE_CONFIG_INVALID',
        message: error instanceof Error ? error.message : 'Invalid review route configuration.',
        severity: 'warning',
      },
    ],
    data: { command: 'review run', status: 'blocked', independence: 'none' },
  });
}

// The result mirrors the evidence matrix deliberately; flattening these
// policy-dependent fields would make degraded proof easier to misreport.
// eslint-disable-next-line complexity -- Result fields vary together by review policy and proof state.
function rankedExhaustedResult(input: {
  readonly author: ReviewAgent;
  readonly policy: ReviewPolicy;
  readonly kind: ReviewKind;
  readonly targets: readonly string[];
  readonly context?: readonly string[];
  readonly evidence: readonly RankedRouteEvidence[];
  readonly degraded?: { readonly output: ReviewerOutput; readonly route: ReviewRoute };
}): CliResult {
  if (input.degraded !== undefined && input.policy === 'prefer') {
    return createResult({
      state: input.degraded.output.verdict === 'approve' ? 'healthy' : 'action_required',
      findings: [
        {
          code: 'REVIEW_INDEPENDENCE_DEGRADED',
          message: `This review was not independent: ${agentName(input.author)} checked its own work after the independent routes did not complete.`,
          severity: 'warning',
        },
        ...reviewerFeedback(input.degraded.output),
      ],
      data: {
        command: 'review run',
        status: input.degraded.output.verdict === 'approve' ? 'approved' : 'changes_requested',
        author_agent: input.author,
        assigned_reviewer: input.degraded.route.reviewer,
        actual_reviewer: input.degraded.output.reviewer_agent,
        ...(input.degraded.route.model !== undefined && {
          reviewer_model: input.degraded.route.model,
        }),
        independence: 'degraded',
        review_routes: input.evidence,
        reviewer_output: input.degraded.output,
      },
    });
  }

  const attempted = input.evidence.filter(route => route.status === 'attempted');
  const hasDegraded = input.degraded !== undefined;
  const attemptedLabel = attempted.length === 1 ? 'route was' : 'routes were';
  const code = hasDegraded ? 'REVIEW_INDEPENDENCE_REQUIRED' : 'REVIEW_ROUTES_EXHAUSTED';
  const message = hasDegraded
    ? 'A same-agent review completed, but the configured independent-review requirement remains unsatisfied.'
    : `${attempted.length} configured review ${attemptedLabel} attempted; no independent check was recorded.`;
  return createResult({
    state: 'action_required',
    findings: [
      {
        code,
        message,
        severity: 'warning',
      },
      ...(hasDegraded ? reviewerFeedback(input.degraded.output) : []),
    ],
    effects: {
      network: attempted.flatMap(route => networkEffectsForFailure(route.reviewer, route.failure)),
    },
    recovery: [
      {
        command: retryCommand(input.kind, input.targets, input.context),
        description: 'Restore a configured independent reviewer, then run the review again.',
        requiresHuman: true,
      },
    ],
    data: {
      command: 'review run',
      status: 'blocked',
      author_agent: input.author,
      review_policy: input.policy,
      independence: hasDegraded ? 'degraded' : 'none',
      review_routes: input.evidence,
      ...(input.degraded !== undefined && { reviewer_output: input.degraded.output }),
    },
  });
}

function recordRankedFailure(
  route: ReviewRoute,
  failure: Extract<ReturnType<typeof assessFallback>, { readonly kind: 'failed' }>,
  evidence: RankedRouteEvidence[],
  unavailable: Set<ReviewAgent>,
): boolean {
  evidence.push({ ...route, status: 'attempted', failure: failure.failure });
  if (RUNTIME_WIDE_FAILURES.has(failure.failure)) unavailable.add(route.reviewer);
  return failure.terminal;
}

async function executeRankedRoute(input: {
  readonly run: ReviewRunInput;
  readonly author: ReviewAgent;
  readonly policy: ReviewPolicy;
  readonly route: ReviewRoute;
  readonly runDeadline: number;
}): Promise<
  ReturnType<typeof assessFallback> | { readonly kind: 'result'; readonly result: CliResult }
> {
  const independentLabel = input.route.independence === 'cross-agent' ? 'an independent ' : '';
  const modelLabel = input.route.model === undefined ? '' : ` with ${input.route.model}`;
  input.run.progress?.start(
    `Requesting ${independentLabel}${agentName(input.route.reviewer)} review${modelLabel}…`,
  );
  const prepared = prepareReviewPacket(
    input.run.cwd,
    input.run.kind,
    input.run.targets,
    input.run.context,
  );
  input.run.progress?.heartbeat?.(
    `Still waiting for a response from ${agentName(input.route.reviewer)}…`,
  );
  const execution = await executeReview(
    input.route.reviewer,
    prepared,
    input.route.model,
    input.runDeadline,
  );
  const changed = changedReviewResult({
    author: input.author,
    reviewer: input.route.reviewer,
    policy: input.policy,
    kind: input.run.kind,
    targets: input.run.targets,
    context: input.run.context,
    sourceChanged: execution.sourceChanged,
    snapshotChanged: execution.snapshotChanged,
    network:
      execution.outcome.kind === 'failed'
        ? networkEffectsForFailure(input.route.reviewer, execution.outcome.failure)
        : [reviewRequest(input.route.reviewer)],
  });
  if (changed !== undefined) return { kind: 'result', result: changed };
  return assessFallback(execution.outcome, input.route.reviewer, prepared.packet.dispatch_id);
}

async function runRankedRoutes(
  input: ReviewRunInput,
  author: ReviewAgent,
  policy: ReviewPolicy,
  routes: readonly ReviewRoute[],
): Promise<CliResult> {
  const evidence: RankedRouteEvidence[] = [];
  const unavailable = new Set<ReviewAgent>();
  let degraded: { readonly output: ReviewerOutput; readonly route: ReviewRoute } | undefined;
  const runDeadline = Date.now() + runBoundMs();

  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index];
    if (route === undefined) break;
    if (unavailable.has(route.reviewer)) {
      evidence.push({ ...route, status: 'skipped' });
      continue;
    }
    if (!canFundRoute(runDeadline)) {
      evidence.push(
        ...routes.slice(index).map(remaining => ({ ...remaining, status: 'unattempted' as const })),
      );
      break;
    }

    const assessment = await executeRankedRoute({
      run: input,
      author,
      policy,
      route,
      runDeadline,
    });
    if (assessment.kind === 'result') return assessment.result;
    if (assessment.kind === 'failed') {
      if (recordRankedFailure(route, assessment, evidence, unavailable)) break;
      continue;
    }

    evidence.push({ ...route, status: 'attempted' });
    if (route.independence === 'cross-agent') {
      const result = independentReviewResult({
        author,
        reviewer: route.reviewer,
        output: assessment.output,
        model: route.model,
      });
      return createResult({ ...result, data: { ...result.data, review_routes: evidence } });
    }
    degraded = { output: assessment.output, route };
  }

  return rankedExhaustedResult({
    author,
    policy,
    kind: input.kind,
    targets: input.targets,
    context: input.context,
    evidence,
    degraded,
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
  readonly independentFallbackFailure?: ReviewFailure;
}): Record<string, unknown> {
  return {
    ...(input.preferredModel !== undefined && { preferred_model: input.preferredModel }),
    preferred_failure: input.preferredFailure,
    ...(input.alternateFailure !== undefined && {
      alternate_model_failure: input.alternateFailure,
      ...(input.alternateModel !== undefined && { alternate_model: input.alternateModel }),
    }),
    ...(input.independentFallbackFailure !== undefined && {
      independent_fallback_failure: input.independentFallbackFailure,
    }),
  };
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
  reviewer: ReviewAgent | undefined,
  failure: ReviewFailure | undefined,
): readonly Effect[] {
  return reviewer === undefined || failure === undefined || NON_ATTEMPT_FAILURES.has(failure)
    ? []
    : [reviewRequest(reviewer)];
}

function degradedNetworkEffects(input: {
  readonly assignedReviewer: ReviewAgent;
  readonly author: ReviewAgent;
  readonly preferredFailure: ReviewFailure;
  readonly alternateFailure: ReviewFailure | undefined;
  readonly independentFallback?: ReviewAgent;
  readonly independentFallbackFailure?: ReviewFailure;
  readonly fallback:
    { readonly kind: 'completed' } | { readonly kind: 'failed'; failure: ReviewFailure };
}): readonly Effect[] {
  return [
    ...networkEffectsForFailure(input.assignedReviewer, input.preferredFailure),
    ...networkEffectsForFailure(input.assignedReviewer, input.alternateFailure),
    ...(input.independentFallback === undefined
      ? []
      : networkEffectsForFailure(input.independentFallback, input.independentFallbackFailure)),
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
    readonly independentFallback?: ReviewAgent;
    readonly independentFallbackFailure?: ReviewFailure;
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
      independentFallback: input.independentFallback,
      independentFallbackFailure: input.independentFallbackFailure,
      fallback,
    }),
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
            ...(input.independentFallbackFailure === undefined ||
            input.independentFallback === undefined
              ? []
              : [
                  {
                    agent: input.independentFallback,
                    role: 'second independent reviewer',
                    failure: input.independentFallbackFailure,
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
          independentFallback: input.independentFallback,
          independentFallbackFailure: input.independentFallbackFailure,
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
          independentFallback: input.independentFallback,
          independentFallbackFailure: input.independentFallbackFailure,
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
        independentFallback: input.independentFallback,
        independentFallbackFailure: input.independentFallbackFailure,
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
 * The reviewer agent retried on its configured alternate model. Returns
 * undefined when no model is configured or the retry did not produce a
 * verifiable review, leaving the caller to fall back to the author's own
 * runtime exactly as before.
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
  const assessment = assessFallback(outcome, input.reviewer, prepared.packet.dispatch_id);
  if (assessment.kind === 'failed') {
    // A configured model is not a usable route when no installed candidate
    // advertises model selection. Capability rejection is a skip, not a review
    // attempt or failure, so it must not displace the funded fallback route.
    if (ALTERNATE_MODEL_SKIP_FAILURES.has(assessment.failure)) return { kind: 'skipped' };
    return { ...assessment, model };
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

async function runIndependentFallback(
  input: ReviewRunInput & {
    readonly author: ReviewAgent;
    readonly reviewer: ReviewAgent;
    readonly preferredReviewer: ReviewAgent;
    readonly preferredModel?: string;
    readonly preferredFailure: ReviewFailure;
    readonly alternateFailure?: ReviewFailure;
    readonly alternateModel?: string;
    readonly runDeadline: number;
  },
): Promise<
  | { readonly kind: 'completed'; readonly result: CliResult }
  | { readonly kind: 'failed'; readonly failure: ReviewFailure; readonly terminal: boolean }
  | { readonly kind: 'skipped' }
> {
  if (!canFundRoute(input.runDeadline)) return { kind: 'skipped' };
  input.progress?.start(
    `${agentName(input.preferredReviewer)} did not complete; trying an independent ${agentName(input.reviewer)} review…`,
  );
  const prepared = prepareReviewPacket(input.cwd, input.kind, input.targets, input.context);
  input.progress?.heartbeat?.(`Still waiting for a response from ${agentName(input.reviewer)}…`);
  const { outcome, sourceChanged, snapshotChanged } = await executeReview(
    input.reviewer,
    prepared,
    undefined,
    input.runDeadline,
  );
  const changedResult = changedReviewResult({
    author: input.author,
    reviewer: input.reviewer,
    policy: readReviewPolicy(input.cwd),
    kind: input.kind,
    targets: input.targets,
    context: input.context,
    sourceChanged,
    snapshotChanged,
    network:
      outcome.kind === 'failed'
        ? [
            ...networkEffectsForFailure(input.preferredReviewer, input.preferredFailure),
            ...networkEffectsForFailure(input.preferredReviewer, input.alternateFailure),
            ...networkEffectsForFailure(input.reviewer, outcome.failure),
          ]
        : [
            ...networkEffectsForFailure(input.preferredReviewer, input.preferredFailure),
            ...networkEffectsForFailure(input.preferredReviewer, input.alternateFailure),
            reviewRequest(input.reviewer),
          ],
  });
  if (changedResult !== undefined) return { kind: 'completed', result: changedResult };
  const assessment = assessFallback(outcome, input.reviewer, prepared.packet.dispatch_id);
  if (assessment.kind === 'failed') return assessment;
  return {
    kind: 'completed',
    result: independentReviewResult({
      author: input.author,
      reviewer: input.reviewer,
      output: assessment.output,
      preferredReviewer: input.preferredReviewer,
      preferredModel: input.preferredModel,
      preferredFailure: input.preferredFailure,
      alternateReviewer: input.preferredReviewer,
      alternateModel: input.alternateModel,
      alternateFailure: input.alternateFailure,
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
    readonly preferredTerminal?: boolean;
    readonly independentFallback: ReviewAgent;
    readonly policy: ReviewPolicy;
    readonly runDeadline: number;
  },
): Promise<CliResult> {
  const alternate = input.preferredTerminal
    ? ({ kind: 'skipped' } as const)
    : await runAlternateModelRoute({
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
  if (!canFundRoute(input.runDeadline)) {
    return exhaustedRunResult({ ...input, alternateFailure, alternateModel });
  }
  const independent = await runIndependentFallback({
    ...input,
    reviewer: input.independentFallback,
    preferredReviewer: input.assignedReviewer,
    alternateFailure,
    alternateModel,
  });
  if (independent.kind === 'completed') return independent.result;
  const independentFallbackFailure =
    independent.kind === 'failed' ? independent.failure : undefined;
  if (!canFundRoute(input.runDeadline)) {
    return exhaustedRunResult({
      ...input,
      alternateFailure,
      alternateModel,
      independentFallbackFailure,
    });
  }
  return runDegradedFallback({
    ...input,
    alternateFailure,
    alternateModel,
    independentFallbackFailure,
  });
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
  readonly independentFallback: ReviewAgent;
  readonly independentFallbackFailure?: ReviewFailure;
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
          ...(input.independentFallbackFailure === undefined
            ? []
            : [
                {
                  agent: input.independentFallback,
                  role: 'second independent reviewer',
                  failure: input.independentFallbackFailure,
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
        ...networkEffectsForFailure(input.independentFallback, input.independentFallbackFailure),
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
  const routes = reviewRoutePlan(author);
  if (routes === undefined) {
    return unsupportedAuthorResult({
      author,
      policy,
      kind: input.kind,
      targets: input.targets,
      context: input.context,
    });
  }
  let configuredRoutes: readonly ReviewRoute[] | undefined;
  try {
    configuredRoutes = readConfiguredReviewRoutes(input.cwd, routes.author);
  } catch (error) {
    return invalidRouteConfigResult(error);
  }
  if (configuredRoutes !== undefined) {
    return runRankedRoutes(input, routes.author, policy, configuredRoutes);
  }
  const reviewer = routes.preferred;
  const primaryModel = readPrimaryReviewerModel(input.cwd, reviewer);

  // One bound for packet preparation and reviewer work across the whole run.
  // Later probes and routes share it; final integrity checks and cleanup may
  // finish after it.
  const runDeadline = Date.now() + runBoundMs();
  const {
    outcome,
    sourceChanged,
    snapshotChanged,
    model: completedModel,
    dispatchId,
  } = await executePrimaryReview(input, reviewer, primaryModel, runDeadline);
  const changedResult = changedReviewResult({
    author: routes.author,
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
    // Before settling for the author reviewing its own work, give the reviewer
    // agent one more attempt on a configured alternate model. It is still not
    // the author, so a completed review there is fully independent.
    return runRemainingRoutes({
      ...input,
      author: routes.author,
      assignedReviewer: reviewer,
      independentFallback: routes.independentFallback,
      preferredModel: completedModel,
      preferredFailure: outcome.failure,
      preferredTerminal: outcome.terminal,
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
      author: routes.author,
      assignedReviewer: reviewer,
      independentFallback: routes.independentFallback,
      preferredModel: completedModel,
      preferredFailure: provenance.code,
      policy,
      runDeadline,
    });
  }
  const output = provenance.output;

  return independentReviewResult({
    author: routes.author,
    reviewer,
    output,
    model: completedModel,
  });
}
