import { existsSync } from 'node:fs';
import nodePath from 'node:path';

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
import { type CliResult, createResult, invalidOperand } from './result.js';
import {
  retroReconcileHandler,
  retroRelayDiscardHandler,
  retroRelayRetryHandler,
  retroRunHandler,
  retroSignalsHandler,
} from './retro-handlers.js';
import {
  reviewCancelHandler,
  reviewPrInspectHandler,
  reviewPrPublicationHandler,
  reviewRoutesListHandler,
  reviewRoutesResetHandler,
  reviewRoutesSetHandler,
  reviewRunHandler,
  reviewStatusHandler,
} from './review-handlers.js';
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
