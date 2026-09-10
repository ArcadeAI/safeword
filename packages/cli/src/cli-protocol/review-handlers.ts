/**
 * Handlers for the `review` command family — run, status, cancel, the ranked
 * route configuration commands, and the review-pr publication commands.
 *
 * A sibling module, matching retro-handlers.ts and codex-handlers.ts: the
 * routing table stays in public-handlers.ts, and heavy implementations stay
 * behind dynamic imports.
 */

import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { retryCommand } from '../review/command.js';
import type {
  RedEvidenceClass,
  RedExecutionAttestation,
  RedExecutionRequest,
  ReviewKind,
} from '../review/contract.js';
import type { CommandInvocation } from './handler.js';
import { onlineRequired } from './online-required.js';
import { shellQuote } from './replay-command.js';
import { type CliResult, createResult, invalidOperand } from './result.js';

export async function reviewRunHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('review run');
  const [rawKind, rawTargets] = invocation.operands;
  const { isReviewKind } = await import('../review/contract.js');
  if (!isReviewKind(rawKind)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'REVIEW_KIND_INVALID',
          message:
            'Review kind must be quality-review, scenario-gate, plan-implementation, or executable-red.',
          retryable: false,
        },
      ],
    });
  }
  const targets = Array.isArray(rawTargets)
    ? rawTargets.filter((target): target is string => typeof target === 'string')
    : [];
  const context = reviewContext(invocation.options.context);
  if (process.env.SAFEWORD_REVIEW_WORKER === '1') return runReviewWorker(invocation);
  const execution = redExecutionRequest(rawKind, invocation.options);
  if (execution instanceof Error) return invalidOperand('review run', execution.message);
  return startReviewInBackground(invocation, rawKind, targets, context, execution);
}

export async function executableRedGateHandler(invocation: CommandInvocation): Promise<CliResult> {
  const scenario = invocation.options.scenario;
  if (typeof scenario !== 'string' || scenario.trim() === '')
    return invalidOperand(
      'review gate executable-red',
      'Executable RED gate requires a non-empty --scenario.',
    );
  const ledger = invocation.options.ledger;
  if (typeof ledger !== 'string' || ledger.trim() === '')
    return invalidOperand(
      'review gate executable-red',
      'Executable RED gate requires a non-empty --ledger.',
    );
  const { executableRedGate } = await import('../review/job.js');
  return executableRedGate(invocation.cwd, scenario, ledger);
}

function reviewRouteAuthor(value: unknown): 'claude' | 'codex' | 'opencode' | undefined {
  return typeof value === 'string' && ['claude', 'codex', 'opencode'].includes(value)
    ? (value as 'claude' | 'codex' | 'opencode')
    : undefined;
}

function reviewRoutesFailure(command: string, error: unknown): CliResult {
  const message = error instanceof Error ? error.message : 'Review route configuration is invalid.';
  const invalid =
    message.startsWith('Invalid ') ||
    message.startsWith('Cannot locate the Safeword user configuration directory.');
  const readFailure = command === 'review routes list' && !invalid;
  let code = 'REVIEW_ROUTE_CONFIG_WRITE_FAILED';
  if (invalid) code = 'REVIEW_ROUTE_CONFIG_INVALID';
  else if (readFailure) code = 'REVIEW_ROUTE_CONFIG_READ_FAILED';
  return createResult({
    state: 'failed',
    errors: [
      {
        code,
        message,
        retryable: !invalid,
      },
    ],
    data: { command },
  });
}

export async function reviewRoutesSetHandler(invocation: CommandInvocation): Promise<CliResult> {
  const author = reviewRouteAuthor(invocation.options.author);
  const scope = invocation.options.scope;
  const routeValues = invocation.options.route;
  if (
    author === undefined ||
    (scope !== 'user' && scope !== 'project') ||
    !Array.isArray(routeValues) ||
    routeValues.length === 0
  ) {
    return invalidOperand(
      'review routes set',
      'Provide --author and at least one --route; scope must be user or project.',
    );
  }
  const [{ parseRouteText }, { scopedConfigPath, setScopedReviewRoutes }] = await Promise.all([
    import('../review/route-config.js'),
    import('../review/preferences.js'),
  ]);
  let routes: ReturnType<typeof parseRouteText>[];
  let target: string;
  let existed: boolean;
  try {
    routes = routeValues.map(value => parseRouteText(String(value), author));
    target = scopedConfigPath(invocation.cwd, scope);
    existed = existsSync(target);
    setScopedReviewRoutes(invocation.cwd, scope, author, routes);
  } catch (error) {
    return reviewRoutesFailure('review routes set', error);
  }
  return createResult({
    state: 'changed',
    changed: true,
    effects: {
      files: [
        {
          kind: existed ? 'update' : 'create',
          target: scope === 'project' ? nodePath.relative(invocation.cwd, target) : target,
        },
      ],
    },
    data: {
      command: 'review routes set',
      scope,
      author,
      routes: routes.map(({ reviewer, model, independence }) => ({
        reviewer,
        ...(model !== undefined && { model }),
        independence,
      })),
    },
  });
}

const REVIEW_ROUTE_AUTHORS = ['claude', 'codex', 'opencode'] as const;
const REVIEW_ROUTE_CONFIG_KEY = 'crossAgentReviewRoutes';

export async function reviewRoutesListHandler(invocation: CommandInvocation): Promise<CliResult> {
  const requested = reviewRouteAuthor(invocation.options.author);
  if (requested === undefined && invocation.options.author !== undefined)
    return invalidOperand('review routes list', 'Provide --author as claude, codex, or opencode.');
  // Without --author, list every author. Reviewer routing is the thing users
  // come here to discover, so the read-only command should answer without
  // first requiring the vocabulary it exists to teach.
  const authors = requested === undefined ? REVIEW_ROUTE_AUTHORS : [requested];
  const [{ effectiveConfiguredRoutes, scopedConfigPath }, { builtInReviewRoutes }] =
    await Promise.all([import('../review/preferences.js'), import('../review/policy.js')]);

  const listed: {
    author: (typeof REVIEW_ROUTE_AUTHORS)[number];
    source: string;
    routes: readonly { reviewer: string; model?: string; independence: string }[];
  }[] = [];
  for (const author of authors) {
    let configured: ReturnType<typeof effectiveConfiguredRoutes>;
    try {
      configured = effectiveConfiguredRoutes(invocation.cwd, author);
    } catch (error) {
      return reviewRoutesFailure('review routes list', error);
    }
    listed.push({
      author,
      ...(configured ?? {
        source: 'built-in',
        routes: builtInReviewRoutes(invocation.cwd, author),
      }),
    });
  }

  // Project-scoped paths travel relative to the project, matching `routes set`
  // and keeping the JSON envelope identical on every machine.
  const projectConfig = nodePath.relative(
    invocation.cwd,
    scopedConfigPath(invocation.cwd, 'project'),
  );
  const body = [
    ...listed.flatMap(entry => [
      `${entry.author} review routes (${entry.source}):`,
      ...entry.routes.map(
        (route, index) =>
          `${index + 1}. ${route.reviewer} (${route.model ?? 'runtime default'}) [${route.independence}]`,
      ),
      '',
    ]),
    `Change these with \`safeword review routes set --author <agent> --scope project --route <reviewer>\`,`,
    `or edit the \`${REVIEW_ROUTE_CONFIG_KEY}\` key in ${projectConfig}.`,
  ].join('\n');

  const single = requested === undefined ? undefined : listed[0];
  return createResult({
    state: 'healthy',
    presentation: { kind: 'raw', body },
    data: {
      command: 'review routes list',
      config_key: REVIEW_ROUTE_CONFIG_KEY,
      config_path: projectConfig,
      authors: listed,
      ...(single !== undefined && {
        author: single.author,
        source: single.source,
        routes: single.routes,
      }),
    },
  });
}

export async function reviewRoutesResetHandler(invocation: CommandInvocation): Promise<CliResult> {
  const author = reviewRouteAuthor(invocation.options.author);
  const scope = invocation.options.scope;
  if (author === undefined || (scope !== 'user' && scope !== 'project'))
    return invalidOperand(
      'review routes reset',
      'Provide --author; scope must be user or project.',
    );
  const { resetScopedReviewRoutes, scopedConfigPath } = await import('../review/preferences.js');
  let target: string;
  let changed: boolean;
  try {
    target = scopedConfigPath(invocation.cwd, scope);
    changed = resetScopedReviewRoutes(invocation.cwd, scope, author);
  } catch (error) {
    return reviewRoutesFailure('review routes reset', error);
  }
  return createResult({
    state: changed ? 'changed' : 'healthy',
    changed,
    ...(changed && {
      effects: {
        files: [
          {
            kind: 'update',
            target: scope === 'project' ? nodePath.relative(invocation.cwd, target) : target,
          },
        ],
      },
    }),
    data: { command: 'review routes reset', scope, author },
  });
}

function reviewContext(rawContext: unknown): string[] {
  if (Array.isArray(rawContext))
    return rawContext.filter((target): target is string => typeof target === 'string');
  return typeof rawContext === 'string' ? [rawContext] : [];
}

const RED_EVIDENCE_CLASSES = new Set<RedEvidenceClass>([
  'pure-contract',
  'simulated-host',
  'local-live-host',
  'external-live-host',
]);

// eslint-disable-next-line complexity -- Every user-controlled execution field fails closed here.
function redExecutionRequest(
  kind: ReviewKind,
  options: Readonly<Record<string, unknown>>,
): RedExecutionRequest | undefined | Error {
  if (kind !== 'executable-red') return undefined;
  const scenario = options.scenario;
  if (typeof scenario !== 'string' || scenario.trim() === '')
    return new Error('Executable-red review requires a non-empty --scenario.');
  const ledger = options.ledger;
  if (typeof ledger !== 'string' || ledger.trim() === '')
    return new Error('Executable-red review requires a non-empty --ledger.');
  const rawArgv = options.execute;
  let argv: unknown;
  try {
    argv = typeof rawArgv === 'string' ? JSON.parse(rawArgv) : undefined;
  } catch {
    argv = undefined;
  }
  if (!Array.isArray(argv) || argv.length === 0 || argv.some(value => typeof value !== 'string'))
    return new Error('Executable-red review requires --execute with exact argv.');
  const cwd = options.proofCwd;
  if (typeof cwd !== 'string' || cwd.trim() === '')
    return new Error('Executable-red review requires a project-contained --proof-cwd.');
  const evidenceClass = options.evidenceClass;
  if (
    typeof evidenceClass !== 'string' ||
    !RED_EVIDENCE_CLASSES.has(evidenceClass as RedEvidenceClass)
  )
    return new Error('Executable-red review requires a valid --evidence-class.');
  const expectedFailure = options.expectedFailure;
  if (typeof expectedFailure !== 'string' || expectedFailure === '')
    return new Error('Executable-red review requires a non-empty --expected-failure literal.');
  const timeoutMs = Number(options.executionTimeout);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000)
    return new Error('--execution-timeout must be an integer from 1 to 600000 milliseconds.');
  return {
    scenario,
    ledger,
    argv: argv as [string, ...string[]],
    cwd,
    evidenceClass: evidenceClass as RedEvidenceClass,
    expectedFailure,
    timeoutMs,
  };
}

async function collectWorkerRedAttestation(input: {
  readonly cwd: string;
  readonly execution?: RedExecutionRequest;
  readonly sourceFingerprint: string;
}): Promise<RedExecutionAttestation | undefined> {
  if (input.execution === undefined) return undefined;
  const { executeRedProof } = await import('../review/red-execution.js');
  return executeRedProof({
    projectRoot: input.cwd,
    request: input.execution,
    sourceFingerprint: input.sourceFingerprint,
  });
}

function withExecutionAttestation(
  result: CliResult,
  attestation: RedExecutionAttestation | undefined,
  input?: {
    readonly request: RedExecutionRequest;
    readonly targets: readonly string[];
    readonly context: readonly string[];
  },
): CliResult {
  if (attestation === undefined) return result;
  const exactRetry =
    input === undefined
      ? undefined
      : retryCommand('executable-red', input.targets, input.context, input.request);
  const preserveExecution = (command: string): string =>
    exactRetry !== undefined && command.startsWith('safeword review run executable-red')
      ? exactRetry
      : command;
  return {
    ...result,
    recovery: result.recovery.map(action => ({
      ...action,
      command: preserveExecution(action.command),
    })),
    nextActions: result.nextActions.map(action =>
      'command' in action ? { ...action, command: preserveExecution(action.command) } : action,
    ),
    data: {
      ...(typeof result.data === 'object' && result.data !== null && result.data),
      execution_attestation: attestation,
    },
  };
}

async function runReviewWorker(invocation: CommandInvocation): Promise<CliResult> {
  const id = process.env.SAFEWORD_REVIEW_JOB_ID;
  if (id === undefined) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'REVIEW_WORKER_ID_MISSING',
          message: 'The detached review worker has no job ID.',
          retryable: false,
        },
      ],
      data: { command: 'review run', status: 'failed' },
    });
  }
  if (invocation.options.workerJobId !== id) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'REVIEW_WORKER_ID_INVALID',
          message: 'The detached review worker identity does not match its job.',
          retryable: false,
        },
      ],
      data: { command: 'review run', status: 'failed' },
    });
  }
  const [{ runReview }, { completeReviewJob, reviewJobWorkerInput }, { ReviewPacketError }] =
    await Promise.all([
      import('../review/coordinator.js'),
      import('../review/job.js'),
      import('../review/packet.js'),
    ]);
  let persistedInput: ReturnType<typeof reviewJobWorkerInput>;
  try {
    persistedInput = reviewJobWorkerInput(invocation.cwd, id);
  } catch (error) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'REVIEW_WORKER_JOB_INVALID',
          message:
            error instanceof Error
              ? `The detached review worker could not load its job: ${error.message}`
              : 'The detached review worker could not load its job.',
          retryable: false,
        },
      ],
      data: { command: 'review run', status: 'failed', review_id: id },
    });
  }
  let result: CliResult;
  try {
    const attestation = await collectWorkerRedAttestation({
      cwd: invocation.cwd,
      execution: persistedInput.execution,
      sourceFingerprint: persistedInput.sourceFingerprint,
    });
    const reviewed = await runReview({
      cwd: invocation.cwd,
      kind: persistedInput.kind,
      targets: persistedInput.targets,
      context: persistedInput.context,
      executionAttestation: attestation,
      progress: invocation.progress,
    });
    result = withExecutionAttestation(
      reviewed,
      attestation,
      persistedInput.execution === undefined
        ? undefined
        : {
            request: persistedInput.execution,
            targets: persistedInput.targets,
            context: persistedInput.context,
          },
    );
  } catch (error) {
    const packetError = error instanceof ReviewPacketError;
    result = reviewExecutionFailure(error, packetError);
  }
  try {
    completeReviewJob(invocation.cwd, id, result);
  } catch (error) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'REVIEW_RESULT_PERSIST_FAILED',
          message:
            error instanceof Error
              ? `The review finished but its result could not be saved: ${error.message}`
              : 'The review finished but its result could not be saved.',
          retryable: true,
        },
      ],
      data: { command: 'review run', status: 'failed', review_id: id },
    });
  }
  return result;
}

function reviewExecutionFailure(error: unknown, packetError: boolean): CliResult {
  return createResult({
    state: 'failed',
    errors: [
      {
        code: packetError ? 'REVIEW_PACKET_INVALID' : 'REVIEW_WORKER_FAILED',
        message: error instanceof Error ? error.message : 'The review worker failed.',
        retryable: !packetError,
      },
    ],
    data: { command: 'review run', status: 'failed' },
  });
}

async function startReviewInBackground(
  invocation: CommandInvocation,
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[],
  execution?: RedExecutionRequest,
): Promise<CliResult> {
  const [{ startReviewJob }, { ReviewPacketError }] = await Promise.all([
    import('../review/job.js'),
    import('../review/packet.js'),
  ]);
  try {
    return await startReviewJob({
      cwd: invocation.cwd,
      kind,
      targets,
      context,
      execution,
      progress: invocation.progress,
    });
  } catch (error) {
    const packetError = error instanceof ReviewPacketError;
    return reviewStartFailure(error, packetError);
  }
}

function reviewStartFailure(error: unknown, packetError: boolean): CliResult {
  return createResult({
    state: 'failed',
    errors: [
      {
        code: packetError ? 'REVIEW_PACKET_INVALID' : 'REVIEW_JOB_START_FAILED',
        message: error instanceof Error ? error.message : 'The review job could not be started.',
        retryable: !packetError,
      },
    ],
    recovery: packetError
      ? [
          {
            command: 'safeword review run <kind> <targets...>',
            description:
              'Correct the review target and context paths or reduce the packet, then run the review again.',
            requiresHuman: true,
          },
        ]
      : [],
    data: { command: 'review run', status: packetError ? 'blocked' : 'failed' },
  });
}

export async function reviewStatusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const id = typeof invocation.operands[0] === 'string' ? invocation.operands[0] : undefined;
  const { reviewJobStatus } = await import('../review/job.js');
  return reviewJobStatus(invocation.cwd, id);
}

export async function reviewCancelHandler(invocation: CommandInvocation): Promise<CliResult> {
  const id = typeof invocation.operands[0] === 'string' ? invocation.operands[0] : undefined;
  const { cancelReviewJob } = await import('../review/job.js');
  return cancelReviewJob(invocation.cwd, id);
}

export async function reviewPrInspectHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('review-pr inspect');
  const inputPath = invocation.operands[0];
  const outputPath = invocation.options.output;
  if (typeof inputPath !== 'string' || typeof outputPath !== 'string') {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'PR_REVIEW_ARGUMENT_INVALID',
          message: 'review-pr inspect requires an input path and --output path.',
          retryable: false,
        },
      ],
    });
  }
  const { inspectPullRequestCommand } = await import('../commands/review-pr.js');
  let receipt;
  try {
    receipt = await inspectPullRequestCommand({
      cwd: invocation.cwd,
      inputPath,
      outputPath,
    });
  } catch {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'PR_REVIEW_INSPECT_FAILED',
          message: 'Pull-request inspection failed before a publishable handoff was produced.',
          retryable: false,
        },
      ],
      recovery: [
        {
          command: `safeword review-pr inspect ${shellQuote(inputPath)} --output ${shellQuote(outputPath)}`,
          description:
            'Check .safeword/config.json, the input artifact, and OPENAI_API_KEY, then retry.',
          requiresHuman: true,
        },
      ],
    });
  }
  return createResult({
    state: 'changed',
    effects: {
      files: [{ kind: 'advisory-result', target: outputPath, operation: 'write' }],
      network: [{ kind: 'model-review', target: 'OpenAI', operation: 'read-write' }],
    },
    data: { command: 'review-pr inspect', receipt },
  });
}

export async function reviewPrReadinessHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('review-pr readiness');
  try {
    const { createGitHubReadinessBoundary, reportReadinessCommand } =
      await import('../commands/review-pr-readiness.js');
    const outcome = await reportReadinessCommand(createGitHubReadinessBoundary());
    return createResult({
      // Publishing the signal succeeded even when the signal itself is a
      // failure. Keep the Actions job green and let the named commit status
      // carry the readiness verdict.
      state: 'healthy',
      changed: true,
      effects: {
        network: [{ kind: 'commit-status', target: 'GitHub', operation: 'read-write' }],
      },
      data: { command: 'review-pr readiness', outcome },
    });
  } catch (error: unknown) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'PR_READINESS_REPORT_FAILED',
          message: `Pull-request readiness reporting failed: ${error instanceof Error ? error.message : String(error)}`,
          retryable: true,
        },
      ],
    });
  }
}

export async function reviewPrPublicationHandler(
  stage: 'invalidate' | 'publish',
  invocation: CommandInvocation,
): Promise<CliResult> {
  if (invocation.offline) return onlineRequired(`review-pr ${stage}`);
  const resultPath = invocation.operands[0];
  if (stage === 'publish' && typeof resultPath !== 'string') {
    return invalidOperand('review-pr publish', 'review-pr publish requires a result path.');
  }
  try {
    const { createGitHubReviewBoundary, invalidatePullRequestCommand, publishPullRequestCommand } =
      await import('../commands/review-pr-publication.js');
    const github = createGitHubReviewBoundary();
    const outcome =
      stage === 'publish' && typeof resultPath === 'string'
        ? await publishPullRequestCommand(github, resultPath)
        : await invalidatePullRequestCommand(github);
    return createResult({
      state: outcome.changed ? 'changed' : 'healthy',
      changed: outcome.changed,
      effects: {
        network: [{ kind: 'ordinary-issue-comment', target: 'GitHub', operation: 'read-write' }],
      },
      data: { command: `review-pr ${stage}`, outcome },
    });
  } catch (error: unknown) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'PR_REVIEW_PUBLICATION_FAILED',
          message: `Pull-request ${stage} failed: ${error instanceof Error ? error.message : String(error)}`,
          retryable: false,
        },
      ],
    });
  }
}
