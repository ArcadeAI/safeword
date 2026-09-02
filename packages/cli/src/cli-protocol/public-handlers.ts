import { existsSync, lstatSync, readFileSync, readlinkSync, type Stats } from 'node:fs';
import nodePath from 'node:path';

import type {
  LegacyGlobalGuidanceCleanupResult,
  LegacyGlobalGuidanceDiagnostic,
  LegacyGlobalGuidanceObservation,
} from '../codex-plugin/legacy-global-guidance.js';
import { CODEX_REVIEW_THEN_RESTART_ACTION } from '../codex-plugin/migration.js';
import { CodexMigrationError } from '../codex-plugin/migration-error.js';
import type * as CodexMigration from '../codex-plugin/operations.js';
import type { RetroCliOptions, RetroCommandExecution } from '../commands/retro.js';
import type { ReviewKind } from '../review/contract.js';
import { isWouldChangeAction, type SelfHealAction } from '../utils/architecture-document.js';
import { type AgentSelectionError, parseAgentSelection } from './agent-selection.js';
import type { CommandHandler, CommandInvocation } from './handler.js';
import { onlineRequired } from './online-required.js';
import { numericOption, stringOption } from './option-values.js';
import {
  type CliPlan,
  createPlan,
  isPlanIdentity,
  malformedPlanIdentity,
  toWirePlan,
} from './plan.js';
import { type CliResult, createResult } from './result.js';
import { ticketListHandler, ticketNewHandler, trackerHandler } from './tracker-ticket-handlers.js';

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

function withLegacyRawJsonGuidance(
  result: CliResult,
  options: Readonly<Record<string, unknown>>,
  command: string,
): CliResult {
  if (options.format !== 'json') return result;
  return {
    ...result,
    findings: [
      ...result.findings,
      {
        code: 'CLI_RAW_JSON_DEPRECATED',
        message: `The legacy raw JSON format for \`${command}\` remains available; use global \`--json\` for the canonical versioned envelope.`,
        severity: 'warning',
        metadata: { replacement: '--json', retention: 'indefinite' },
      },
    ],
  };
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
  return createResult({
    state: 'failed',
    errors: [
      {
        code: invalid ? 'REVIEW_ROUTE_CONFIG_INVALID' : 'REVIEW_ROUTE_CONFIG_WRITE_FAILED',
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
      routes: routes.map(({ reviewer, model }) => ({
        reviewer,
        ...(model !== undefined && { model }),
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

async function codexStatusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeCodexMigration } = await import('../codex-plugin/operations.js');
  return observeCodexMigration(invocation.cwd);
}

function cleanGuidanceUnavailable(
  diagnostic: LegacyGlobalGuidanceDiagnostic,
  observation: LegacyGlobalGuidanceObservation,
): CliResult {
  return createResult({
    state: diagnostic.finding === undefined ? 'healthy' : 'action_required',
    findings: diagnostic.finding === undefined ? [] : [diagnostic.finding],
    data: { command: 'codex clean-guidance', global_guidance: observation },
  });
}

function cleanGuidanceConfirmation(
  diagnostic: LegacyGlobalGuidanceDiagnostic,
  observation: LegacyGlobalGuidanceObservation,
  plan: CliPlan,
): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      ...(diagnostic.finding === undefined ? [] : [diagnostic.finding]),
      {
        code: 'CODEX_GUIDANCE_CLEANUP_CONFIRMATION_REQUIRED',
        message:
          'Review and confirm deactivation of the exact legacy profile guidance; unrelated content is preserved and the move creates a recoverable backup.',
        severity: 'warning',
      },
    ],
    nextActions: [
      {
        command: `safeword codex clean-guidance --yes --plan ${plan.id}`,
        mutates: true,
        requiresHuman: true,
      },
    ],
    data: {
      command: 'codex clean-guidance',
      global_guidance: observation,
      plan: toWirePlan(plan),
    },
  });
}

function cleanGuidanceRefusal(cleanup: LegacyGlobalGuidanceCleanupResult): CliResult {
  const messages = {
    PLAN_STALE: 'The active profile guidance changed. Review a fresh cleanup plan.',
    UNSAFE_GUIDANCE: 'The active profile guidance is not an exact registered revision.',
    BACKUP_OCCUPIED: `Cleanup refused because ${cleanup.backupPath} already exists.`,
    SOURCE_CHANGED_DURING_MOVE:
      'The guidance changed during cleanup. Safeword preserved the moved artifact and refused cleanup.',
  } as const;
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: cleanup.code ?? 'CODEX_GUIDANCE_CLEANUP_REFUSED',
        message:
          cleanup.code === undefined
            ? 'Safeword could not safely clean the profile guidance.'
            : messages[cleanup.code],
        severity: 'warning',
      },
    ],
    nextActions:
      cleanup.code === 'PLAN_STALE'
        ? [
            {
              command: 'safeword codex clean-guidance',
              mutates: false,
              requiresHuman: true,
            },
          ]
        : [],
    data: { command: 'codex clean-guidance', cleanup },
  });
}

function shellQuote(value: string | undefined): string {
  const escaped = (value ?? '').replaceAll("'", "'\"'\"'");
  return `'${escaped}'`;
}

function cleanGuidanceSuccess(cleanup: LegacyGlobalGuidanceCleanupResult): CliResult {
  return createResult({
    state: 'changed',
    changed: true,
    findings: [
      {
        code: 'CODEX_LEGACY_GLOBAL_GUIDANCE_BACKED_UP',
        message: `Deactivated the exact historical guidance by moving it to the recovery backup at ${cleanup.backupPath}; unrelated guidance was preserved.`,
        severity: 'info',
      },
    ],
    effects: {
      files: [
        { kind: 'move', target: cleanup.sourcePath ?? '', operation: 'deactivate' },
        { kind: 'create', target: cleanup.backupPath ?? '', operation: 'backup' },
      ],
    },
    recovery: [
      {
        command: `mv -- ${shellQuote(cleanup.backupPath)} ${shellQuote(cleanup.sourcePath)}`,
        description: 'Restore the backed-up profile guidance if it is still wanted.',
        requiresHuman: true,
      },
    ],
    data: { command: 'codex clean-guidance', cleanup },
  });
}

async function codexCleanGuidanceHandler(invocation: CommandInvocation): Promise<CliResult> {
  const suppliedPlan = stringOption(invocation.options, 'plan');
  if (suppliedPlan !== undefined && !isPlanIdentity(suppliedPlan)) {
    return malformedPlanIdentity('codex clean-guidance');
  }
  const guidance = await import('../codex-plugin/legacy-global-guidance.js');
  if (invocation.options.yes === true && suppliedPlan !== undefined) {
    const cleanup = guidance.applyLegacyGlobalGuidanceCleanup({ planId: suppliedPlan });
    return cleanup.ok ? cleanGuidanceSuccess(cleanup) : cleanGuidanceRefusal(cleanup);
  }
  const observation = guidance.observeLegacyGlobalGuidance();
  const diagnostic = guidance.legacyGlobalGuidanceDiagnostic(observation);
  const preview = guidance.planLegacyGlobalGuidanceCleanup(observation);

  if (!preview.ok || preview.plan === undefined) {
    return cleanGuidanceUnavailable(diagnostic, observation);
  }

  return cleanGuidanceConfirmation(diagnostic, observation, preview.plan);
}

function codexConfirmation(plan: CliPlan, exactConfigBlocks: readonly string[]): CliResult {
  const command = `${plan.command} --yes --plan ${plan.id}`;
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'CODEX_CONFIRMATION_REQUIRED',
        message: `Review and confirm the exact \`${plan.command}\` operation.`,
        severity: 'warning',
      },
    ],
    nextActions: [{ command: `safeword ${command}`, mutates: true, requiresHuman: true }],
    data: {
      command: plan.command,
      plan: {
        ...toWirePlan(plan),
        exact_config_blocks: exactConfigBlocks,
      },
    },
  });
}

function codexFinalizationPlanFromObservation(
  observed: ReturnType<typeof CodexMigration.observeCodexFinalizationPlan>,
): { readonly plan: CliPlan; readonly exactConfigBlocks: readonly string[] } {
  return {
    plan: createPlan({
      command: 'codex migrate --finalize',
      preconditionDigest: observed.preconditionDigest,
      effects: {
        files: observed.effects.map(effect => ({
          kind: effect.action,
          target: effect.path,
          operation: effect.action,
        })),
      },
      requiresConfirmation: true,
      verification: [
        {
          description: 'Verify current plugin-hook proof and repository inputs before mutation.',
          command: 'safeword codex status',
        },
      ],
    }),
    exactConfigBlocks: observed.exactConfigBlocks,
  };
}

function codexFinalizationPlan(
  cwd: string,
  migration: typeof CodexMigration,
): { readonly plan: CliPlan; readonly exactConfigBlocks: readonly string[] } {
  // Validate and snapshot repository inputs before consulting the profile. An
  // unsafe or malformed project must fail without invoking external tooling.
  migration.observeCodexFinalizationPlan(cwd);
  const observation = migration.observeCodexMigrationResult(cwd);
  if (observation.proof.status !== 'current') {
    throw new CodexMigrationError(
      'FINALIZATION_PROOF_REQUIRED',
      'Finalization requires current plugin hook proof from the restarted Codex app. Review /hooks, then retry.',
    );
  }
  // Profile verification is an external boundary. Re-snapshot afterward so
  // consent can never be bound to repository state that changed during it.
  const observed = migration.observeCodexFinalizationPlan(cwd);
  return codexFinalizationPlanFromObservation(observed);
}

type CodexFinalizationPlan = ReturnType<typeof codexFinalizationPlan>;

async function codexRecoveryPlan(cwd: string): Promise<{
  readonly plan: CliPlan;
  readonly recovery: {
    readonly effects: readonly { readonly path: string; readonly action: 'restore' }[];
    readonly preconditionDigest: string;
  };
}> {
  const finalization = await import('../codex-plugin/finalization.js');
  const recovery = finalization.observeCodexRecoveryPlan(cwd);
  return {
    recovery,
    plan: createPlan({
      command: 'codex recover',
      preconditionDigest: recovery.preconditionDigest,
      effects: {
        files: recovery.effects.map(effect => ({
          kind: effect.action,
          target: effect.path,
          operation: effect.action,
        })),
        destructive: recovery.effects.map(effect => ({
          kind: 'overwrite',
          target: effect.path,
          operation: 'restore',
        })),
      },
      requiresConfirmation: true,
      verification: [
        {
          description: 'Verify every current path still matches the finalized backup intent.',
          command: 'safeword codex status',
        },
      ],
    }),
  };
}

function staleCodexPlan(plan: CliPlan): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'PLAN_STALE',
        message: 'The Codex finalization plan changed. Review the current plan before applying it.',
        severity: 'warning',
      },
    ],
    nextActions: [
      {
        command: `safeword ${plan.command}`,
        mutates: false,
        requiresHuman: true,
      },
    ],
    data: { command: plan.command, plan: toWirePlan(plan) },
  });
}

async function runCodexRecovery(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): Promise<CliResult> {
  const { plan, recovery } = await codexRecoveryPlan(invocation.cwd);
  const suppliedPlan = stringOption(invocation.options, 'plan');
  if (suppliedPlan !== undefined && suppliedPlan !== plan.id) return staleCodexPlan(plan);
  const before = recovery.effects.map(effect => ({
    path: nodePath.join(invocation.cwd, effect.path),
    content: observeFile(nodePath.join(invocation.cwd, effect.path)),
  }));
  let changed: boolean;
  try {
    changed = migration.recoverCodexMigration(invocation.cwd, { report: false });
  } catch (recoveryError) {
    const fileEffects = before.flatMap(snapshot =>
      observedFileEffect(invocation.cwd, snapshot.path, snapshot.content),
    );
    return codexFailure(recoveryError, 'codex recover', false, fileEffects);
  }
  const observed = migration.observeCodexMigration(invocation.cwd);
  return {
    ...observed,
    state: changed ? 'changed' : 'healthy',
    changed,
    effects: {
      ...observed.effects,
      files: changed
        ? recovery.effects.map(effect => ({
            kind: effect.action,
            target: effect.path,
            operation: effect.action,
          }))
        : [],
      configuration: [],
    },
  };
}

async function runCodexFinalization(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
  accepted: CodexFinalizationPlan,
): Promise<CliResult> {
  const current = migration.observeCodexFinalizationPlan(invocation.cwd);
  if (current.preconditionDigest !== accepted.plan.preconditionDigest) {
    return staleCodexPlan(codexFinalizationPlanFromObservation(current).plan);
  }
  const suppliedPlan = stringOption(invocation.options, 'plan');
  if (suppliedPlan !== undefined && suppliedPlan !== accepted.plan.id) {
    return staleCodexPlan(accepted.plan);
  }
  const paths = accepted.plan.effects.files.map(effect =>
    nodePath.join(invocation.cwd, effect.target),
  );
  const before = paths.map(path => ({ path, snapshot: observeFile(path) }));
  let changed: boolean;
  try {
    changed = await migration.removeLegacyCodexHooks(invocation.cwd, {
      yes: true,
      report: false,
    });
  } catch (finalizationError) {
    const fileEffects = before.flatMap(snapshot =>
      observedFileEffect(invocation.cwd, snapshot.path, snapshot.snapshot),
    );
    return codexFailure(finalizationError, 'codex migrate', true, fileEffects);
  }
  const observed = migration.observeCodexMigration(invocation.cwd);
  return {
    ...observed,
    state: changed ? 'changed' : observed.state,
    changed,
    findings: [
      ...observed.findings,
      ...(changed
        ? [
            {
              code: 'CODEX_LEGACY_STATE_BACKED_UP',
              message: 'Backed up the complete legacy Codex state for conflict-safe recovery.',
              severity: 'info' as const,
            },
          ]
        : []),
    ],
    effects: {
      ...observed.effects,
      files: changed
        ? before.flatMap(snapshot =>
            observedFileEffect(invocation.cwd, snapshot.path, snapshot.snapshot),
          )
        : [],
    },
  };
}

function runCodexInstall(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): CliResult {
  const before = migration.observeCodexMigrationResult(invocation.cwd);
  if (!migration.codexInstallRequiresMutation(before)) {
    return migration.observeCodexMigration(invocation.cwd);
  }
  migration.installCodexPlugin({
    cwd: invocation.cwd,
    json: true,
    reportMigrationState: false,
  });
  const observed = migration.observeCodexMigration(invocation.cwd);
  return {
    ...observed,
    state: observed.state === 'healthy' ? 'changed' : observed.state,
    changed: true,
    effects: {
      ...observed.effects,
      configuration: [
        {
          kind: before.plugin.installed ? 'update' : 'enable',
          target: 'Safeword Codex profile plugin',
        },
      ],
    },
  };
}

async function codexBootstrapHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { bootstrapCodexPlugin } = await import('../commands/codex-bootstrap.js');
  let rawInput = '';
  try {
    rawInput = readFileSync(0, 'utf8');
  } catch {
    // A missing hook payload is reported as unverified, never as a blocker.
  }
  return bootstrapCodexPlugin(invocation.cwd, rawInput, { offline: invocation.offline });
}

function codexFailureCode(
  error: unknown,
  message: string,
  name: CodexMutationName,
  isFinalization: boolean,
): string {
  if (error instanceof CodexMigrationError) return error.code;
  const specific = (
    [
      [/Plugin installation succeeded, but enablement is unknown/iu, 'PLUGIN_ENABLEMENT_UNKNOWN'],
      [/did not report the Safeword plugin as enabled/iu, 'PLUGIN_ENABLEMENT_FAILED'],
      [/marketplace unavailable/iu, 'PLUGIN_MARKETPLACE_FAILED'],
      [/ambiguous|cannot safely identify/iu, 'AMBIGUOUS_LEGACY_CONFIG'],
      [
        /unsafe Codex migration path|symbolic link|not a regular file|EISDIR|illegal operation on a directory/iu,
        'UNSAFE_MIGRATION_PATH',
      ],
      [/backup already exists/iu, 'BACKUP_EXISTS'],
      [/rollback could not complete/iu, 'ROLLBACK_FAILED'],
      [/recovery conflict/iu, 'RECOVERY_CONFLICT'],
    ] as const
  ).find(([pattern]) => pattern.test(message));
  if (specific !== undefined) return specific[1];
  if (!isFinalization)
    return name === 'codex recover' ? 'RECOVERY_FAILED' : 'PLUGIN_INSTALL_FAILED';
  return /current plugin[- ]hook proof/i.test(message)
    ? 'FINALIZATION_PROOF_REQUIRED'
    : 'FINALIZATION_FAILED';
}

function codexFailureConfig(
  partialInstall: boolean,
  partialMarketplace: boolean,
): CliResult['effects']['configuration'] {
  if (partialInstall) {
    return [
      {
        kind: 'install',
        target: 'Safeword Codex profile plugin',
        operation: 'enablement-unverified',
      },
    ];
  }
  if (partialMarketplace) {
    return [
      {
        kind: 'remove',
        target: 'Safeword Codex marketplace',
        operation: 'restoration-failed',
      },
    ];
  }
  return [];
}

function codexFailureRecovery(
  error: unknown,
  partialMarketplace: boolean,
  fileEffects: CliResult['effects']['files'],
): CliResult['recovery'] {
  if (
    partialMarketplace &&
    error instanceof CodexMigrationError &&
    error.recoveryCommand !== undefined
  ) {
    return [
      {
        command: error.recoveryCommand,
        description: 'Restore the Safeword marketplace removed by the failed replacement.',
        requiresHuman: true,
      },
    ];
  }
  if (fileEffects.length > 0) {
    return [
      {
        command: 'safeword codex recover',
        description: 'Retry recovery using the retained migration backup.',
        requiresHuman: true,
      },
    ];
  }
  return [];
}

function codexFailure(
  error: unknown,
  name: CodexMutationName,
  isFinalization: boolean,
  fileEffects: CliResult['effects']['files'] = [],
): CliResult {
  const message = error instanceof Error ? error.message : String(error);
  if (/finalization plan changed/iu.test(message)) {
    return createResult({
      state: 'action_required',
      findings: [{ code: 'PLAN_STALE', message, severity: 'warning' }],
      nextActions: [
        {
          command: 'safeword codex migrate --finalize',
          mutates: false,
          requiresHuman: true,
        },
      ],
    });
  }
  const partialInstall =
    /Plugin installation succeeded, but enablement is unknown|did not report the Safeword plugin as enabled/iu.test(
      message,
    );
  const partialMarketplace = error instanceof CodexMigrationError && error.profileChanged;
  return createResult({
    state: 'failed',
    changed: partialInstall || partialMarketplace || fileEffects.length > 0,
    effects: {
      files: fileEffects,
      configuration: codexFailureConfig(partialInstall, partialMarketplace),
    },
    recovery: codexFailureRecovery(error, partialMarketplace, fileEffects),
    errors: [
      {
        code: codexFailureCode(error, message, name, isFinalization),
        message,
        retryable: true,
      },
    ],
  });
}

type CodexMutationName = 'codex install' | 'codex migrate' | 'codex recover';

type CodexMutationPreflight =
  | { readonly result: CliResult; readonly finalizationPlan?: never }
  | { readonly result?: never; readonly finalizationPlan?: CodexFinalizationPlan };

async function executeCodexMutation(
  name: CodexMutationName,
  isFinalization: boolean,
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
  finalizationPlan?: CodexFinalizationPlan,
): Promise<CliResult> {
  if (name === 'codex recover') return await runCodexRecovery(invocation, migration);
  if (isFinalization) {
    if (finalizationPlan === undefined) {
      throw new Error('Codex finalization requires an accepted preflight plan.');
    }
    return await runCodexFinalization(invocation, migration, finalizationPlan);
  }
  return runCodexInstall(invocation, migration);
}

async function codexRecoveryRequired(cwd: string, isFinalization: boolean): Promise<boolean> {
  if (!isFinalization) return false;
  const finalization = await import('../codex-plugin/finalization.js');
  return finalization.codexRecoveryIsRequired(cwd);
}

function isCodexFinalization(name: CodexMutationName, invocation: CommandInvocation): boolean {
  return (
    name === 'codex migrate' &&
    (invocation.options.finalize === true || invocation.options.removeLegacyHooks === true)
  );
}

function codexPluginUpdateFailure(observed: CliResult): CliResult | undefined {
  const migrationState = (
    observed.data as { migration?: { schema_version?: string; state?: string } } | undefined
  )?.migration?.state;
  if (migrationState !== 'plugin_update_required') return undefined;
  return {
    ...observed,
    state: 'failed',
    errors: [
      ...observed.errors,
      {
        code: 'PLUGIN_UPDATE_REQUIRED',
        message: `Finalization requires the packaged Safeword plugin version. Run safeword install --agents=codex. ${CODEX_REVIEW_THEN_RESTART_ACTION}.`,
        retryable: true,
      },
    ],
    nextActions: [
      {
        command: 'safeword install --agents=codex',
        mutates: true,
        requiresHuman: false,
      },
    ],
  };
}

async function codexFinalizationPreflight(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): Promise<CodexMutationPreflight> {
  const finalization = await import('../codex-plugin/finalization.js');
  if (finalization.codexFinalizationIsComplete(invocation.cwd)) {
    return { result: migration.observeCodexMigration(invocation.cwd) };
  }
  const observedPlan = codexFinalizationPlan(invocation.cwd, migration);
  const observed = migration.observeCodexMigration(invocation.cwd);
  const pluginUpdateFailure = codexPluginUpdateFailure(observed);
  if (pluginUpdateFailure !== undefined) return { result: pluginUpdateFailure };
  const suppliedPlan = stringOption(invocation.options, 'plan');
  const deprecatedAssumeYes =
    invocation.options.removeLegacyHooks === true && invocation.options.yes === true;
  if (invocation.options.yes !== true || (suppliedPlan === undefined && !deprecatedAssumeYes)) {
    return { result: codexConfirmation(observedPlan.plan, observedPlan.exactConfigBlocks) };
  }
  return suppliedPlan === undefined || suppliedPlan === observedPlan.plan.id
    ? { finalizationPlan: observedPlan }
    : { result: staleCodexPlan(observedPlan.plan) };
}

async function codexRecoveryPreflight(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): Promise<CliResult | undefined> {
  const { plan, recovery } = await codexRecoveryPlan(invocation.cwd);
  if (recovery.effects.length === 0) return await runCodexRecovery(invocation, migration);
  const suppliedPlan = stringOption(invocation.options, 'plan');
  if (invocation.options.yes !== true || suppliedPlan === undefined) {
    return codexConfirmation(plan, []);
  }
  return suppliedPlan === plan.id ? undefined : staleCodexPlan(plan);
}

async function codexMutationPreflight(
  name: CodexMutationName,
  isFinalization: boolean,
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): Promise<CodexMutationPreflight> {
  if (await codexRecoveryRequired(invocation.cwd, isFinalization)) {
    return { result: migration.observeCodexMigration(invocation.cwd) };
  }
  if (isFinalization) return codexFinalizationPreflight(invocation, migration);
  if (name === 'codex recover') {
    const result = await codexRecoveryPreflight(invocation, migration);
    return result === undefined ? {} : { result };
  }
  return {};
}

async function codexMutationHandlerCore(
  name: CodexMutationName,
  invocation: CommandInvocation,
): Promise<CliResult> {
  const suppliedPlan = stringOption(invocation.options, 'plan');
  if (suppliedPlan !== undefined && !isPlanIdentity(suppliedPlan)) {
    return malformedPlanIdentity(name);
  }
  if (invocation.offline && name !== 'codex recover') return onlineRequired(name);
  const isFinalization = isCodexFinalization(name, invocation);
  try {
    const migration = await import('../codex-plugin/operations.js');
    const preflight = await codexMutationPreflight(name, isFinalization, invocation, migration);
    if (preflight.result !== undefined) return preflight.result;

    invocation.progress?.start(`Running ${name}…`);
    return await executeCodexMutation(
      name,
      isFinalization,
      invocation,
      migration,
      preflight.finalizationPlan,
    );
  } catch (codexError) {
    return codexFailure(codexError, name, isFinalization);
  }
}

async function codexMutationHandler(
  name: CodexMutationName,
  invocation: CommandInvocation,
): Promise<CliResult> {
  const result = await codexMutationHandlerCore(name, invocation);
  if (name !== 'codex migrate' || invocation.options.removeLegacyHooks !== true) return result;
  return {
    ...result,
    findings: [
      ...result.findings,
      {
        code: 'CLI_OPTION_DEPRECATED',
        message: '--remove-legacy-hooks is deprecated; use --finalize.',
        severity: 'warning',
        metadata: {
          legacy: '--remove-legacy-hooks',
          replacement: '--finalize',
          retention: 'indefinite',
        },
      },
    ],
  };
}

async function retroSignalsHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { formatIssueDrafts, readReports, summarizeReports } =
    await import('../../templates/hooks/lib/self-report.js');
  const records = readReports(invocation.cwd);
  const groups = summarizeReports(records);
  const format = stringOption(invocation.options, 'format') ?? 'human';
  if (!['human', 'json', 'issue'].includes(format)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'SELF_REPORT_FORMAT_INVALID',
          message: `Unknown self-report format: ${format}.`,
          retryable: false,
        },
      ],
    });
  }
  let presentation: CliResult['presentation'];
  switch (format) {
    case 'human': {
      const body =
        records.length === 0
          ? 'No safeword self-reports captured. (Nothing to report — good.)'
          : [
              `Safeword self-reports (${records.length} signal(s), ${groups.length} signature(s))`,
              ...groups.map(group => `- ${group.count}×  ${group.signature}`),
            ].join('\n');
      presentation = { kind: 'raw', body };
      break;
    }
    case 'issue': {
      presentation = {
        kind: 'raw',
        body: JSON.stringify(formatIssueDrafts(records), undefined, 2),
      };
      break;
    }
    case 'json': {
      presentation = {
        kind: 'raw',
        body: JSON.stringify({ total: records.length, groups }, undefined, 2),
      };
      break;
    }
  }
  const result = createResult({
    state: 'healthy',
    presentation,
    data: {
      command: 'retro signals',
      total: records.length,
      groups,
      ...(format === 'issue' && { issues: formatIssueDrafts(records) }),
    },
  });
  return withLegacyRawJsonGuidance(result, invocation.options, 'retro signals');
}

function retroFailure(message: string): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ code: 'RETRO_COMMAND_FAILED', message, retryable: true }],
  });
}

interface RelayCommandMessages {
  readonly errors: string[];
  readonly info: string[];
  readonly success: string[];
}

function relayCommandMessages(): RelayCommandMessages & {
  readonly output: {
    readonly error: (message: string) => void;
    readonly info: (message: string) => void;
    readonly success: (message: string) => void;
  };
} {
  const errors: string[] = [];
  const info: string[] = [];
  const success: string[] = [];
  return {
    errors,
    info,
    success,
    output: {
      error: message => {
        errors.push(message);
      },
      info: message => {
        info.push(message);
      },
      success: message => {
        success.push(message);
      },
    },
  };
}

async function relayRecoveryDirectory(cwd: string): Promise<CliResult | string> {
  const { resolveRelayRecoveryOutboxDirectory } = await import('../commands/retro.js');
  const outbox = resolveRelayRecoveryOutboxDirectory(
    cwd,
    globalThis.process.env.SAFEWORD_RETRO_RELAY_OUTBOX,
  );
  if (!('error' in outbox)) return outbox.directory;
  return createResult({
    state: 'failed',
    errors: [{ code: 'RETRO_RELAY_OUTBOX_INVALID', message: outbox.error, retryable: false }],
  });
}

function relayRecoveryFromEnvironment(offline: boolean):
  | {
      credential: string;
      fetch: typeof fetch;
      operatorCredential?: string;
      relayUrl: string;
    }
  | undefined {
  if (offline) return undefined;
  const credential = globalThis.process.env.SAFEWORD_RETRO_RELAY_CREDENTIAL?.trim();
  const relayUrl = globalThis.process.env.SAFEWORD_RETRO_RELAY_URL?.trim();
  if (!credential || !relayUrl) return undefined;
  const operatorCredential =
    globalThis.process.env.SAFEWORD_RETRO_RELAY_OPERATOR_CREDENTIAL?.trim();
  return {
    credential,
    fetch,
    ...(operatorCredential && { operatorCredential }),
    relayUrl,
  };
}

function relayCommandFindings(messages: RelayCommandMessages): CliResult['findings'] {
  return [...messages.info, ...messages.success].map((message, index) => ({
    code: index < messages.info.length ? 'RETRO_RELAY_STATUS' : 'RETRO_RELAY_RECOVERED',
    message,
    severity: 'info' as const,
  }));
}

function relayCommandFailure(
  command: 'retro-relay-discard' | 'retro-relay-retry',
  message: string,
  requestId?: string,
): CliResult {
  return createResult({
    state: 'failed',
    errors: [
      {
        code:
          command === 'retro-relay-retry'
            ? 'RETRO_RELAY_RETRY_FAILED'
            : 'RETRO_RELAY_DISCARD_FAILED',
        message,
        retryable: command === 'retro-relay-retry',
      },
    ],
    data: { command, ...(requestId && { request_id: requestId }) },
  });
}

function relayRetryResult(
  requestId: string | undefined,
  succeeded: boolean,
  messages: RelayCommandMessages,
): CliResult {
  const changed = succeeded && requestId !== undefined;
  const recoveredThroughRelay = messages.success.some(message => message.includes('recovered'));
  let state: CliResult['state'] = 'failed';
  if (succeeded) state = changed ? 'changed' : 'healthy';
  return createResult({
    state,
    changed,
    findings: relayCommandFindings(messages),
    effects: {
      configuration:
        changed && !recoveredThroughRelay
          ? [{ kind: 'rearm', target: `Retro relay request ${requestId}`, operation: 'retry' }]
          : [],
      network: recoveredThroughRelay
        ? [{ kind: 'retro-relay-recovery', target: 'Configured retro relay', operation: 'retry' }]
        : [],
    },
    errors: messages.errors.map(message => ({
      code: 'RETRO_RELAY_RETRY_FAILED',
      message,
      retryable: true,
    })),
    data: { command: 'retro-relay-retry', ...(requestId && { request_id: requestId }) },
  });
}

async function retroRelayRetryHandler(invocation: CommandInvocation): Promise<CliResult> {
  const requestId = invocation.operands[0];
  if (requestId !== undefined && (typeof requestId !== 'string' || !isRelayRequestId(requestId))) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'CLI_ARGUMENT_INVALID',
          message: 'retro-relay-retry request identity must be a lowercase UUIDv4.',
          retryable: false,
        },
      ],
      data: { command: 'retro-relay-retry' },
    });
  }
  const directory = await relayRecoveryDirectory(invocation.cwd);
  if (typeof directory !== 'string') return directory;
  const messages = relayCommandMessages();
  const { retryRelayDeadLetterCommand } = await import('../commands/retro.js');
  const relay = relayRecoveryFromEnvironment(invocation.offline);
  let succeeded: boolean;
  try {
    succeeded = await retryRelayDeadLetterCommand(requestId, {
      output: messages.output,
      projectDirectory: directory,
      ...(relay && { relay }),
    });
  } catch (error: unknown) {
    return relayCommandFailure(
      'retro-relay-retry',
      error instanceof Error ? error.message : String(error),
      requestId,
    );
  }
  return relayRetryResult(requestId, succeeded, messages);
}

async function retroRelayDiscardHandler(invocation: CommandInvocation): Promise<CliResult> {
  const requestId = invocation.operands[0];
  if (typeof requestId !== 'string' || !isRelayRequestId(requestId)) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'CLI_ARGUMENT_INVALID',
          message: 'retro-relay-discard requires one lowercase UUIDv4 request identity.',
          retryable: false,
        },
      ],
      data: { command: 'retro-relay-discard' },
    });
  }
  if (invocation.options.confirm !== true) {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'CONFIRMATION_REQUIRED',
          message: 'Confirm irreversible deletion of this exact durable request identity.',
          severity: 'warning',
        },
      ],
      nextActions: [
        {
          command: `safeword retro-relay-discard ${requestId} --confirm`,
          mutates: true,
          requiresHuman: true,
        },
      ],
      data: { command: 'retro-relay-discard', request_id: requestId },
    });
  }
  const directory = await relayRecoveryDirectory(invocation.cwd);
  if (typeof directory !== 'string') return directory;
  const messages = relayCommandMessages();
  const { discardRelaySpoolCommand } = await import('../commands/retro.js');
  let succeeded: boolean;
  try {
    succeeded = await discardRelaySpoolCommand(requestId, true, {
      output: messages.output,
      projectDirectory: directory,
    });
  } catch (error: unknown) {
    return relayCommandFailure(
      'retro-relay-discard',
      error instanceof Error ? error.message : String(error),
      requestId,
    );
  }
  return createResult({
    state: succeeded ? 'changed' : 'failed',
    changed: succeeded,
    findings: relayCommandFindings(messages),
    effects: {
      destructive: succeeded
        ? [{ kind: 'discard', target: `Retro relay request ${requestId}`, operation: 'delete' }]
        : [],
    },
    errors: messages.errors.map(message => ({
      code: 'RETRO_RELAY_DISCARD_FAILED',
      message,
      retryable: false,
    })),
    data: { command: 'retro-relay-discard', request_id: requestId },
  });
}

function isRelayRequestId(value: string): boolean {
  return /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u.test(value);
}

function retroOptions(invocation: CommandInvocation, transcript: string): RetroCliOptions {
  const findings = stringOption(invocation.options, 'findings');
  return {
    transcript: nodePath.resolve(invocation.cwd, transcript),
    findings: findings === undefined ? undefined : nodePath.resolve(invocation.cwd, findings),
    autoExtract: invocation.options.autoExtract === true,
    publicRetro: invocation.options.publicRetro === true,
    windowStart: numericOption(invocation.options, 'windowStart'),
    sessionId: stringOption(invocation.options, 'sessionId'),
  };
}

function retroDropFindings(execution: RetroCommandExecution): CliResult['findings'] {
  const drops = execution.outcome.drops;
  if (drops === undefined || drops.schema + drops.surface === 0) return [];
  return [
    {
      code: 'RETRO_FINDINGS_DROPPED',
      message: 'Some findings were rejected by the egress safety boundary.',
      severity: 'warning',
    },
  ];
}

function retroMutationCount(execution: RetroCommandExecution): number {
  const result = execution.outcome.result;
  if (result === undefined) return 0;
  return result.created.length + result.bumped.length + result.commented.length;
}

function retroNetworkEffects(execution: RetroCommandExecution): CliResult['effects']['network'] {
  if (execution.outcome.result === undefined) return [];
  return [{ kind: 'retro-triage', target: 'GitHub', operation: 'read-write' }];
}

function retroRunFailureMessage(execution: RetroCommandExecution): string | undefined {
  if (execution.outcome.ok) {
    return execution.extractionSucceeded ? undefined : 'Retro extraction failed.';
  }
  return execution.outcome.errorMessage ?? 'Retro execution failed.';
}

function retroRunState(failureMessage: string | undefined, changed: boolean): CliResult['state'] {
  if (failureMessage !== undefined) return 'failed';
  return changed ? 'changed' : 'healthy';
}

function retroRunResult(
  execution: RetroCommandExecution,
  fileEffects: CliResult['effects']['files'],
): CliResult {
  const result = execution.outcome.result;
  const changed = retroMutationCount(execution) > 0 || fileEffects.length > 0;
  const failureMessage = retroRunFailureMessage(execution);
  const errors: CliResult['errors'][number][] = [];
  if (failureMessage !== undefined) {
    errors.push({ code: 'RETRO_COMMAND_FAILED', message: failureMessage, retryable: true });
  }
  return createResult({
    state: retroRunState(failureMessage, changed),
    changed,
    effects: { files: fileEffects, network: retroNetworkEffects(execution) },
    findings: retroDropFindings(execution),
    errors,
    data: {
      command: 'retro run',
      result,
      agent_filing_needed: execution.outcome.agentFilingNeeded ?? false,
    },
  });
}

interface FileSnapshot {
  readonly kind: 'file' | 'symlink' | 'directory' | 'other';
  readonly mode: number;
  readonly bytes?: string;
}

function snapshotKind(stats: Stats): FileSnapshot['kind'] {
  if (stats.isFile()) return 'file';
  if (stats.isSymbolicLink()) return 'symlink';
  if (stats.isDirectory()) return 'directory';
  return 'other';
}

function snapshotBytes(path: string, stats: Stats): string | undefined {
  if (stats.isFile()) return readFileSync(path).toString('base64');
  if (stats.isSymbolicLink()) return Buffer.from(readlinkSync(path)).toString('base64');
  return undefined;
}

function observeFile(path: string): FileSnapshot | undefined {
  try {
    const stats = lstatSync(path);
    const kind = snapshotKind(stats);
    const bytes = snapshotBytes(path, stats);
    return { kind, mode: stats.mode & 0o777, ...(bytes !== undefined && { bytes }) };
  } catch {
    return undefined;
  }
}

function observedFileEffect(
  cwd: string,
  path: string,
  before: FileSnapshot | undefined,
): CliResult['effects']['files'] {
  const after = observeFile(path);
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const target = nodePath.relative(cwd, path).split(nodePath.sep).join('/');
  if (before === undefined) return [{ kind: 'create', target }];
  if (after === undefined) return [{ kind: 'delete', target }];
  return [{ kind: 'update', target }];
}

async function retroRunHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('retro run');
  const transcript = stringOption(invocation.options, 'transcript');
  if (transcript === undefined) return retroFailure('retro run requires --transcript <path>.');

  const options = retroOptions(invocation, transcript);
  const { draftSpoolPath } = await import('../../templates/hooks/lib/retro-draft-spool.js');
  const sessionId = options.sessionId ?? process.env.CLAUDE_SESSION_ID ?? 'unknown';
  const spoolPath = draftSpoolPath(invocation.cwd, sessionId);
  const spoolBefore = observeFile(spoolPath);
  const { executeRetroCommand } = await import('../commands/retro.js');
  invocation.progress?.start('Extracting and filing retro findings…');
  let execution;
  try {
    execution = await executeRetroCommand(options, invocation.cwd);
  } catch (error: unknown) {
    return retroFailure(error instanceof Error ? error.message : String(error));
  }
  return retroRunResult(execution, observedFileEffect(invocation.cwd, spoolPath, spoolBefore));
}

async function retroReconcileHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('retro reconcile');
  const { executeRetroReconcile } = await import('../commands/retro.js');
  invocation.progress?.start('Reconciling retro findings…');
  let execution;
  try {
    execution = await executeRetroReconcile();
  } catch (error: unknown) {
    return retroFailure(error instanceof Error ? error.message : String(error));
  }
  if (!execution.ok) return retroFailure(execution.reason);
  const changed = execution.result.flagged.length > 0;
  return createResult({
    state: changed ? 'changed' : 'healthy',
    changed,
    effects: {
      network: [{ kind: 'retro-reconcile', target: 'GitHub', operation: 'read-write' }],
    },
    findings: execution.result.failed.map(issue => ({
      code: 'RETRO_RECONCILE_PARTIAL_FAILURE',
      message: `Retro issue ${issue} could not be reconciled.`,
      severity: 'warning',
    })),
    data: { command: 'retro reconcile', result: execution.result },
  });
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
