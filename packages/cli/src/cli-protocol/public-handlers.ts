import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import type { ReviewKind } from '../review/contract.js';
import { isWouldChangeAction, type SelfHealAction } from '../utils/architecture-document.js';
import { type AgentSelectionError, parseAgentSelection } from './agent-selection.js';
import {
  codexBootstrapHandler,
  codexCleanGuidanceHandler,
  codexMutationHandler,
  codexStatusHandler,
} from './codex-handlers.js';
import type { CommandHandler, CommandInvocation } from './handler.js';
import { withLegacyRawJsonGuidance } from './legacy-raw-json.js';
import { onlineRequired } from './online-required.js';
import { stringOption } from './option-values.js';
import { isPlanIdentity, malformedPlanIdentity } from './plan.js';
import { shellQuote } from './replay-command.js';
import { type CliResult, createResult } from './result.js';
import {
  retroReconcileHandler,
  retroRelayDiscardHandler,
  retroRelayRetryHandler,
  retroRunHandler,
  retroSignalsHandler,
} from './retro-handlers.js';
import {
  ticketListHandler,
  ticketNewHandler,
  ticketReconcileParentHandler,
  trackerHandler,
} from './tracker-ticket-handlers.js';

function notConfigured(command: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'PROJECT_NOT_CONFIGURED',
        message: 'Safeword is not configured in this project.',
        severity: 'warning',
      },
    ],
    nextActions: [{ command: 'safeword install', mutates: true, requiresHuman: false }],
    data: { command },
  });
}

function invalidAgentSelection(command: string, error: AgentSelectionError): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ ...error, retryable: false }],
    data: { command },
  });
}

type ConfigInspection =
  { readonly matches: true } | { readonly matches: false; readonly reason: 'missing' | 'drifted' };

function configCheckResult(inspection: ConfigInspection): CliResult {
  if (inspection.matches) {
    return createResult({
      state: 'healthy',
      data: { command: 'project sync-config', in_sync: true },
    });
  }
  const driftCode = inspection.reason === 'missing' ? 'CONFIG_MISSING' : 'CONFIG_DRIFTED';
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: driftCode,
        message: 'Dependency-cruiser configuration needs regeneration.',
        severity: 'warning',
      },
    ],
    nextActions: [
      {
        command: 'safeword project sync-config',
        mutates: true,
        requiresHuman: false,
      },
    ],
    data: { command: 'project sync-config', in_sync: false },
  });
}

function completeConfigInspection(
  generated: ConfigInspection,
  mainConfigExists: boolean,
): ConfigInspection {
  return generated.matches && !mainConfigExists ? { matches: false, reason: 'missing' } : generated;
}

function syncedConfigResult(
  inspection: ConfigInspection,
  files: CliResult['effects']['files'],
): CliResult {
  let state: CliResult['state'] = files.length === 0 ? 'healthy' : 'changed';
  if (!inspection.matches) state = 'action_required';
  return createResult({
    state,
    changed: files.length > 0,
    effects: { files },
    findings: inspection.matches ? [] : configCheckResult(inspection).findings,
    data: { command: 'project sync-config', in_sync: inspection.matches },
  });
}

async function statusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const parsed = parseAgentSelection(invocation.options.agents);
  if (!parsed.ok) return invalidAgentSelection('status', parsed.error);
  const { observeLifecycleStatus } = await import('../lifecycle/status.js');
  return observeLifecycleStatus(
    invocation.cwd,
    parsed.selection.agents,
    process.env,
    invocation.offline,
  );
}

async function conformanceHandler(invocation: CommandInvocation): Promise<CliResult> {
  const parsed = parseAgentSelection(invocation.options.agents);
  if (!parsed.ok) return invalidAgentSelection('conformance', parsed.error);
  if (parsed.selection.agents.length !== 1 || parsed.selection.agents[0] !== 'opencode') {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'CONFORMANCE_AGENT_UNSUPPORTED',
          message: 'Conformance currently requires exactly --agents=opencode.',
          retryable: false,
        },
      ],
      data: { command: 'conformance' },
    });
  }
  const { runOpenCodeConformance } = await import('../opencode/conformance.js');
  return runOpenCodeConformance(process.env);
}

async function doctorHandler(invocation: CommandInvocation): Promise<CliResult> {
  const parsed = parseAgentSelection(invocation.options.agents);
  if (!parsed.ok) return invalidAgentSelection('doctor', parsed.error);
  const { diagnoseLifecycle } = await import('../lifecycle/doctor.js');
  return diagnoseLifecycle(invocation.cwd, parsed.selection.agents);
}

async function installHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { installLifecycle } = await import('../lifecycle/commands.js');
  return installLifecycle(invocation, {
    installClaude: () => claudeInstallHandler(invocation),
    installCodex: () => codexMutationHandler('codex install', invocation),
  });
}

async function claudeInstallHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('claude install');
  const requestedScope = invocation.options.scope ?? 'project';
  if (requestedScope !== 'project' && requestedScope !== 'user') {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'CLI_ARGUMENT_INVALID',
          message: 'Claude plugin scope must be either project or user.',
          retryable: false,
        },
      ],
      data: { command: 'claude install' },
    });
  }
  const { installClaudePlugin } = await import('../claude-plugin/profile.js');
  return installClaudePlugin(invocation.cwd, requestedScope);
}

async function claudeStatusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeClaudeStatus } = await import('../claude-plugin/status.js');
  return observeClaudeStatus(invocation.cwd);
}

async function claudeCleanupHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { cleanupClaudeLegacy } = await import('../claude-plugin/cleanup-command.js');
  return cleanupClaudeLegacy(invocation.cwd, {
    assumeYes: invocation.options.yes === true,
    plan: stringOption(invocation.options, 'plan'),
  });
}

async function claudeRecoverHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { recoverClaudeCleanup } = await import('../claude-plugin/cleanup.js');
  return recoverClaudeCleanup(invocation.cwd);
}

async function planHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { planLifecycle } = await import('../lifecycle/commands.js');
  return planLifecycle(invocation);
}

async function removeHandler(invocation: CommandInvocation): Promise<CliResult> {
  const suppliedPlan = stringOption(invocation.options, 'plan');
  if (suppliedPlan !== undefined && !isPlanIdentity(suppliedPlan)) {
    return malformedPlanIdentity('remove');
  }
  const { removeProject } = await import('../commands/remove.js');
  return removeProject(invocation.cwd, {
    full: invocation.options.full === true,
    yes: invocation.options.yes === true,
    plan: suppliedPlan,
    offline: invocation.offline,
  });
}

async function uninstallHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { uninstallLifecycle } = await import('../lifecycle/commands.js');
  const result = await uninstallLifecycle(invocation);
  if (result.state !== 'healthy' && result.state !== 'changed') return result;
  const { remoteWorkflowUninstallFinding } = await import('../commands/test-execution.js');
  const finding = remoteWorkflowUninstallFinding(invocation.cwd);
  return finding === undefined ? result : { ...result, findings: [...result.findings, finding] };
}

async function syncConfigHandler(invocation: CommandInvocation): Promise<CliResult> {
  const safewordDirectory = nodePath.join(invocation.cwd, '.safeword');
  if (!existsSync(safewordDirectory)) return notConfigured('project sync-config');

  const { buildArchitecture, inspectConfig, syncConfigCore } =
    await import('../commands/sync-config.js');
  const architecture = buildArchitecture(invocation.cwd);
  const before = inspectConfig(invocation.cwd, architecture);
  const mainConfigExists = existsSync(nodePath.join(invocation.cwd, '.dependency-cruiser.cjs'));
  const generatedConfigExists = existsSync(
    nodePath.join(invocation.cwd, '.safeword/depcruise-config.cjs'),
  );
  if (invocation.options.check === true) {
    return configCheckResult(completeConfigInspection(before, mainConfigExists));
  }

  if (before.matches && mainConfigExists) {
    return createResult({
      state: 'healthy',
      data: { command: 'project sync-config', in_sync: true },
    });
  }

  const synced = syncConfigCore(invocation.cwd, architecture);
  const files = [
    ...(synced.generatedConfig
      ? [
          {
            kind: generatedConfigExists ? 'update' : 'create',
            target: '.safeword/depcruise-config.cjs',
          },
        ]
      : []),
    ...(synced.createdMainConfig ? [{ kind: 'create', target: '.dependency-cruiser.cjs' }] : []),
  ];
  const after = completeConfigInspection(
    inspectConfig(invocation.cwd, architecture),
    mainConfigExists || synced.createdMainConfig,
  );
  return syncedConfigResult(after, files);
}

type ArchitectureAdvisory = {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info';
};

type HealedDocument = { readonly action: SelfHealAction; readonly path: string };

function architectureAdvisories(
  unreadableWorkspaces: readonly {
    config: string;
    manager: string;
  }[],
): ArchitectureAdvisory[] {
  return unreadableWorkspaces.map(workspace => ({
    code: 'ARCHITECTURE_ADVISORY',
    message: `Workspace config present but unreadable: ${workspace.config} (${workspace.manager}).`,
    severity: 'info' as const,
  }));
}

function architectureEnforcementDisabledResult(
  advisories: readonly ArchitectureAdvisory[],
): CliResult {
  return createResult({
    state: 'healthy',
    findings: [
      {
        code: 'ARCHITECTURE_ENFORCEMENT_DISABLED',
        message: 'Architecture doc enforcement is opted out (architectureDocEnforcement: false).',
        severity: 'info',
      },
      ...advisories,
    ],
    data: { command: 'project architecture', enforcement: false },
  });
}

function architectureCheckResult(
  stale: readonly string[],
  advisories: readonly ArchitectureAdvisory[],
): CliResult {
  return createResult({
    state: stale.length === 0 ? 'healthy' : 'action_required',
    nextActions:
      stale.length === 0
        ? []
        : [
            {
              command: 'safeword project architecture',
              mutates: true,
              requiresHuman: false,
            },
          ],
    findings:
      stale.length === 0
        ? advisories
        : [
            {
              code: 'ARCHITECTURE_DRIFT',
              message: `Architecture documents are stale (${stale.join(', ')}). Run \`safeword project architecture\` for the current worktree, or \`safeword project architecture --from-index\` to reproduce the staged tree, then commit the result.`,
              severity: 'warning',
            },
            ...advisories,
          ],
    data: { command: 'project architecture', planned: stale, enforcement: true },
  });
}

type ArchitectureModeMessage = {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning';
};

function architectureModeResult(input: {
  readonly cwd: string;
  readonly mode: 'stage' | 'staged';
  readonly results: readonly HealedDocument[];
  readonly stagedPaths: readonly string[];
  readonly stageFailures: readonly string[];
  readonly failed: boolean;
  readonly autoStageAvailable: boolean;
  readonly messages: readonly ArchitectureModeMessage[];
  readonly errors: readonly string[];
}): CliResult {
  const changed = input.results.filter(result => isWouldChangeAction(result.action));
  const mutated = changed.length > 0 || input.stagedPaths.length > 0;
  let state: CliResult['state'] = 'healthy';
  if (input.failed) state = 'failed';
  else if (mutated) state = 'changed';

  return createResult({
    state,
    changed: mutated,
    effects: {
      files: [
        ...changed.map(result => ({
          kind: result.action === 'created' ? 'create' : 'update',
          target: nodePath.relative(input.cwd, result.path),
        })),
        ...input.stagedPaths.map(target => ({ kind: 'stage', target, operation: 'stage' })),
      ],
    },
    findings: input.messages,
    errors: input.errors.map(message => ({
      code: 'ARCHITECTURE_STAGED_TREE_FAILED',
      message,
      retryable: true,
    })),
    data: {
      command: 'project architecture',
      mode: input.mode,
      staged:
        input.mode === 'stage' && input.autoStageAvailable && input.stageFailures.length === 0,
      staged_files: input.stagedPaths,
      stage_failures: input.stageFailures,
      enforcement: true,
    },
  });
}

async function runArchitectureStagedTreeMode(
  invocation: CommandInvocation,
  mode: 'stage' | 'staged',
): Promise<CliResult> {
  const messages: ArchitectureModeMessage[] = [];
  const errors: string[] = [];
  const reporter = {
    success(message: string): void {
      messages.push({ code: 'ARCHITECTURE_MESSAGE', message, severity: 'info' });
    },
    warn(message: string): void {
      messages.push({ code: 'ARCHITECTURE_WARNING', message, severity: 'warning' });
    },
    error(message: string): void {
      errors.push(message);
    },
  };
  const { architectureStage, architectureStaged } = await import('../commands/architecture.js');
  const outcome =
    mode === 'stage'
      ? await architectureStage(invocation.cwd, reporter)
      : await architectureStaged(invocation.cwd, reporter);

  return architectureModeResult({
    cwd: invocation.cwd,
    mode,
    ...outcome,
    messages,
    errors,
  });
}

interface ArchitectureCliMode {
  readonly fromIndex: boolean;
  readonly stageOutput: boolean;
  readonly legacy?: '--stage' | '--staged';
}

function architectureCliMode(options: Readonly<Record<string, unknown>>): ArchitectureCliMode {
  let legacy: ArchitectureCliMode['legacy'];
  if (options.stage === true) legacy = '--stage';
  else if (options.staged === true) legacy = '--staged';
  return {
    fromIndex: options.fromIndex === true || legacy !== undefined,
    stageOutput: options.stageOutput === true || legacy === '--stage',
    ...(legacy !== undefined && { legacy }),
  };
}

function architectureOptionsConflict(options: Readonly<Record<string, unknown>>): boolean {
  const legacyCount = Number(options.stage === true) + Number(options.staged === true);
  const canonicalSelected = options.fromIndex === true || options.stageOutput === true;
  return legacyCount > 1 || (legacyCount > 0 && canonicalSelected);
}

function withArchitectureOptionCompatibility(
  result: CliResult,
  legacy: ArchitectureCliMode['legacy'],
): CliResult {
  if (legacy === undefined) return result;
  const replacement = legacy === '--stage' ? '--from-index --stage-output' : '--from-index';
  return {
    ...result,
    findings: [
      ...result.findings,
      {
        code: 'CLI_OPTION_DEPRECATED',
        message: `${legacy} is deprecated; use ${replacement}.`,
        severity: 'warning',
        metadata: { legacy, replacement, retention: 'indefinite' },
      },
    ],
  };
}

async function architectureHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { planSelfHealProject, selfHealProject } =
    await import('../utils/architecture-document.js');
  const { discoverUnreadableWorkspaces, extractMonorepoArchitectureSnapshot } =
    await import('../utils/architecture-monorepo.js');
  const { isArchitectureDocumentEnforcementEnabled } = await import('../utils/configured-paths.js');

  const enforcementEnabled = isArchitectureDocumentEnforcementEnabled(invocation.cwd);
  if (architectureOptionsConflict(invocation.options)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'CLI_ARGUMENT_INVALID',
          message:
            'Choose either one legacy architecture option or the canonical --from-index/--stage-output options.',
          retryable: false,
        },
      ],
      data: { command: 'project architecture' },
    });
  }
  const mode = architectureCliMode(invocation.options);
  if (mode.stageOutput && !mode.fromIndex) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'ARCHITECTURE_INPUT_REQUIRED',
          message:
            '--stage-output requires --from-index so staged output has a reproducible source.',
          retryable: false,
        },
      ],
      data: { command: 'project architecture' },
    });
  }
  if (!enforcementEnabled) {
    return architectureEnforcementDisabledResult(
      architectureAdvisories(discoverUnreadableWorkspaces(invocation.cwd)),
    );
  }

  if (mode.fromIndex) {
    const result = await runArchitectureStagedTreeMode(
      invocation,
      mode.stageOutput ? 'stage' : 'staged',
    );
    return withArchitectureOptionCompatibility(result, mode.legacy);
  }

  const snapshot = extractMonorepoArchitectureSnapshot(invocation.cwd);
  const advisories = architectureAdvisories(snapshot.model.unreadableWorkspaces);
  if (invocation.options.check === true) {
    const stale = planSelfHealProject(invocation.cwd, snapshot).filter(action =>
      isWouldChangeAction(action),
    );
    return architectureCheckResult(stale, advisories);
  }

  const results = selfHealProject(invocation.cwd, snapshot);
  const changed = results.filter(result => isWouldChangeAction(result.action));

  return architectureHealResult({
    cwd: invocation.cwd,
    changed,
    advisories,
  });
}

function healedDocumentFindings(
  cwd: string,
  changed: readonly HealedDocument[],
): CliResult['findings'] {
  if (changed.length === 0) {
    return [
      {
        code: 'ARCHITECTURE_UNCHANGED',
        message: 'Architecture documents are unchanged.',
        severity: 'info',
      },
    ];
  }
  const healed = changed.map(result => nodePath.relative(cwd, result.path)).join(', ');
  return [
    {
      code: 'ARCHITECTURE_REFRESHED',
      message: `Architecture documents created, healed, or regenerated (${healed}).`,
      severity: 'info',
    },
  ];
}

function architectureHealResult(input: {
  readonly cwd: string;
  readonly changed: readonly HealedDocument[];
  readonly advisories: readonly ArchitectureAdvisory[];
}): CliResult {
  const changedDocuments = input.changed.length > 0;

  return createResult({
    state: changedDocuments ? 'changed' : 'healthy',
    changed: changedDocuments,
    effects: {
      files: input.changed.map(result => ({
        kind: result.action === 'created' ? 'create' : 'update',
        target: nodePath.relative(input.cwd, result.path),
      })),
    },
    findings: [...healedDocumentFindings(input.cwd, input.changed), ...input.advisories],
    data: {
      command: 'project architecture',
      enforcement: true,
    },
  });
}

async function syncLearningsHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { syncLearnings } = await import('../learning-sync/index.js');
  const result = syncLearnings(invocation.cwd);
  return createResult({
    state: result.wrote ? 'changed' : 'healthy',
    effects: {
      files: result.wrote
        ? [
            {
              kind: 'write',
              target: nodePath.relative(invocation.cwd, result.indexPath),
            },
          ]
        : [],
    },
    findings: result.skipped.map(skip => ({
      code: 'LEARNING_SKIPPED',
      message: `Skipped ${skip.fileName}: ${skip.reason}`,
      severity: 'warning' as const,
    })),
    data: { command: 'project sync-learnings', entries: result.entries.length },
  });
}

async function syncTicketsHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { syncTickets } = await import('../ticket-sync/index.js');
  const result = syncTickets(invocation.cwd);
  return createResult({
    state: result.wrote ? 'changed' : 'healthy',
    effects: {
      files: result.wrote
        ? [result.indexPath, result.completedIndexPath].map(target => ({
            kind: 'write',
            target: nodePath.relative(invocation.cwd, target),
          }))
        : [],
    },
    findings: result.skipped.map(skip => ({
      code: 'TICKET_SKIPPED',
      message: `Skipped ${skip.folder}: ${skip.reason}`,
      severity: 'warning' as const,
    })),
    data: {
      command: 'project sync-tickets',
      active: result.active.length,
      completed: result.completed.length,
    },
  });
}

async function codifyHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { codifyResult } = await import('../commands/codify.js');
  const ticket = invocation.operands[0];
  return codifyResult(invocation.cwd, typeof ticket === 'string' ? ticket : '', invocation.options);
}

async function testPlanHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeTestPlan } = await import('../commands/test-plan.js');
  const rawKind = invocation.operands[0];
  if (rawKind !== undefined && typeof rawKind !== 'string') {
    return invalidOperand('project test-plan', 'test-plan kind must be text.');
  }
  const result = await observeTestPlan(invocation.cwd, rawKind, invocation.options);
  return withLegacyRawJsonGuidance(result, invocation.options, 'project test-plan');
}

async function namespaceRootHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeNamespaceRoot } = await import('../commands/namespace-root.js');
  return observeNamespaceRoot(invocation.cwd, invocation.options);
}

async function reviewKnowledgeHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeReviewKnowledge } = await import('../commands/review-knowledge.js');
  return observeReviewKnowledge(invocation.cwd);
}

async function publicRetrosHandler(invocation: CommandInvocation): Promise<CliResult> {
  const state = invocation.operands[0];
  if (state !== 'off' && state !== 'on') {
    return invalidOperand('project public-retros', 'public-retros state must be "off" or "on".');
  }
  const { configurePublicRetros } = await import('../commands/public-retros.js');
  return configurePublicRetros(invocation.cwd, state);
}

async function retroDrainHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { runRetroDrain } = await import('../commands/retro-drain.js');
  const spool = invocation.operands[0];
  if (spool !== undefined && typeof spool !== 'string') {
    return invalidOperand('project retro-drain', 'retro-drain spool must be text.');
  }
  return runRetroDrain(invocation.cwd, spool, invocation.options);
}

async function testExecutionStatusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeTestExecutionStatus } = await import('../commands/test-execution.js');
  return observeTestExecutionStatus(invocation.cwd);
}

async function remoteWorkflowStatusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeRemoteWorkflowStatus } = await import('../commands/test-execution.js');
  return observeRemoteWorkflowStatus(invocation.cwd);
}

async function remoteWorkflowSetupHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { setupManagedRemoteWorkflow } = await import('../commands/test-execution.js');
  return setupManagedRemoteWorkflow(invocation.cwd);
}

async function remoteWorkflowDisableHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { disableManagedRemoteWorkflow } = await import('../commands/test-execution.js');
  return disableManagedRemoteWorkflow(invocation.cwd);
}

async function projectTestHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('project test');
  const { runProjectTests } = await import('../commands/test-execution.js');
  return runProjectTests(invocation.cwd, invocation.options, { json: invocation.json === true });
}

async function lintGherkinHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeGherkinLint } = await import('../commands/lint-gherkin.js');
  const rawFiles = invocation.operands[0];
  if (
    rawFiles !== undefined &&
    (!Array.isArray(rawFiles) || rawFiles.some(file => typeof file !== 'string'))
  ) {
    return invalidOperand('project lint-gherkin', 'lint-gherkin files must be text paths.');
  }
  return observeGherkinLint(invocation.cwd, (rawFiles as string[] | undefined) ?? []);
}

function invalidOperand(command: string, message: string): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ code: 'CLI_ARGUMENT_INVALID', message, retryable: false }],
    data: { command },
  });
}

async function reviewRunHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('review run');
  const [rawKind, rawTargets] = invocation.operands;
  const { isReviewKind } = await import('../review/contract.js');
  if (!isReviewKind(rawKind)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'REVIEW_KIND_INVALID',
          message: 'Review kind must be quality-review, scenario-gate, or plan-implementation.',
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
  return startReviewInBackground(invocation, rawKind, targets, context);
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

async function reviewRoutesSetHandler(invocation: CommandInvocation): Promise<CliResult> {
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

async function reviewRoutesListHandler(invocation: CommandInvocation): Promise<CliResult> {
  const author = reviewRouteAuthor(invocation.options.author);
  if (author === undefined)
    return invalidOperand('review routes list', 'Provide --author as claude, codex, or opencode.');
  const [{ effectiveConfiguredRoutes }, { builtInReviewRoutes }] = await Promise.all([
    import('../review/preferences.js'),
    import('../review/policy.js'),
  ]);
  let configured: ReturnType<typeof effectiveConfiguredRoutes>;
  try {
    configured = effectiveConfiguredRoutes(invocation.cwd, author);
  } catch (error) {
    return reviewRoutesFailure('review routes list', error);
  }
  const data = configured ?? {
    source: 'built-in',
    routes: builtInReviewRoutes(invocation.cwd, author),
  };
  return createResult({
    state: 'healthy',
    presentation: {
      kind: 'raw',
      body: [
        `${author} review routes (${data.source}):`,
        ...data.routes.map(
          (route, index) =>
            `${index + 1}. ${route.reviewer} (${route.model ?? 'runtime default'}) [${route.independence}]`,
        ),
      ].join('\n'),
    },
    data: { command: 'review routes list', author, ...data },
  });
}

async function reviewRoutesResetHandler(invocation: CommandInvocation): Promise<CliResult> {
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
    result = await runReview({
      cwd: invocation.cwd,
      ...persistedInput,
      progress: invocation.progress,
    });
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

async function reviewStatusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const id = typeof invocation.operands[0] === 'string' ? invocation.operands[0] : undefined;
  const { reviewJobStatus } = await import('../review/job.js');
  return reviewJobStatus(invocation.cwd, id);
}

async function reviewCancelHandler(invocation: CommandInvocation): Promise<CliResult> {
  const id = typeof invocation.operands[0] === 'string' ? invocation.operands[0] : undefined;
  const { cancelReviewJob } = await import('../review/job.js');
  return cancelReviewJob(invocation.cwd, id);
}

async function reviewPrInspectHandler(invocation: CommandInvocation): Promise<CliResult> {
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

async function reviewPrPublicationHandler(
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

const HANDLERS: Readonly<Record<string, CommandHandler>> = {
  status: statusHandler,
  conformance: conformanceHandler,
  install: installHandler,
  plan: planHandler,
  doctor: doctorHandler,
  uninstall: uninstallHandler,
  remove: removeHandler,
  'project sync-config': syncConfigHandler,
  'project architecture': architectureHandler,
  'project sync-learnings': syncLearningsHandler,
  'project sync-tickets': syncTicketsHandler,
  'project codify': codifyHandler,
  'project test-plan': testPlanHandler,
  'project namespace-root': namespaceRootHandler,
  'project review-knowledge': reviewKnowledgeHandler,
  'project public-retros': publicRetrosHandler,
  'project retro-drain': retroDrainHandler,
  'project test': projectTestHandler,
  'project test-execution status': testExecutionStatusHandler,
  'project test-execution remote status': remoteWorkflowStatusHandler,
  'project test-execution remote setup': remoteWorkflowSetupHandler,
  'project test-execution remote disable': remoteWorkflowDisableHandler,
  'project lint-gherkin': lintGherkinHandler,
  'tracker sync': invocation => trackerHandler('tracker sync', invocation),
  'tracker connect': invocation => trackerHandler('tracker connect', invocation),
  'codex migrate': invocation => codexMutationHandler('codex migrate', invocation),
  'codex install': invocation => codexMutationHandler('codex install', invocation),
  'codex bootstrap': codexBootstrapHandler,
  'codex status': codexStatusHandler,
  'claude install': claudeInstallHandler,
  'claude status': claudeStatusHandler,
  'claude cleanup': claudeCleanupHandler,
  'claude recover': claudeRecoverHandler,
  'codex clean-guidance': codexCleanGuidanceHandler,
  'codex recover': invocation => codexMutationHandler('codex recover', invocation),
  'ticket list': ticketListHandler,
  'ticket new': ticketNewHandler,
  'ticket reconcile-parent': ticketReconcileParentHandler,
  'review run': reviewRunHandler,
  'review status': reviewStatusHandler,
  'review routes set': reviewRoutesSetHandler,
  'review routes list': reviewRoutesListHandler,
  'review routes reset': reviewRoutesResetHandler,
  'review cancel': reviewCancelHandler,
  'review-pr inspect': reviewPrInspectHandler,
  'review-pr invalidate': invocation => reviewPrPublicationHandler('invalidate', invocation),
  'review-pr publish': invocation => reviewPrPublicationHandler('publish', invocation),
  'retro run': retroRunHandler,
  'retro signals': retroSignalsHandler,
  'retro reconcile': retroReconcileHandler,
  'retro-relay-retry': retroRelayRetryHandler,
  'retro-relay-discard': retroRelayDiscardHandler,
  boundary: () =>
    Promise.resolve(
      createResult({ state: 'healthy', data: { command: 'boundary', internal: true } }),
    ),
  'hook codex': () =>
    Promise.resolve(
      createResult({ state: 'healthy', data: { command: 'hook codex', internal: true } }),
    ),
  'codex-hook': () =>
    Promise.resolve(
      createResult({ state: 'healthy', data: { command: 'codex-hook', internal: true } }),
    ),
  'feature-directories': () =>
    Promise.resolve(
      createResult({
        state: 'healthy',
        data: { command: 'feature-directories', internal: true },
      }),
    ),
};

export function publicHandler(name: string): CommandHandler {
  if (!Object.hasOwn(HANDLERS, name)) {
    throw new Error(`No typed public handler registered for ${name}`);
  }
  const handler = HANDLERS[name];
  if (handler === undefined) throw new Error(`No typed public handler registered for ${name}`);
  return handler;
}
