import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import type * as CodexMigration from '../commands/migrate-codex-plugin.js';
import type { RetroCliOptions, RetroCommandExecution } from '../commands/retro.js';
import type { CommandHandler, CommandInvocation } from './handler.js';
import { type CliResult, createResult } from './result.js';

function onlineRequired(name: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'CLI_ONLINE_REQUIRED',
        message: `\`${name}\` requires declared network access for this operation.`,
        severity: 'warning',
      },
    ],
    nextActions: [
      {
        command: `safeword ${name}`,
        mutates: true,
        requiresHuman: false,
      },
    ],
    data: { command: name, offline: true },
  });
}

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
    nextActions: [{ command: 'safeword setup', mutates: true, requiresHuman: false }],
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

async function statusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeStatus } = await import('../commands/status.js');
  return observeStatus(invocation.cwd);
}

async function setupHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline && process.env.SAFEWORD_SKIP_INSTALL === undefined) {
    return onlineRequired('setup');
  }
  const { convergeSetup } = await import('../commands/converge-setup.js');
  return convergeSetup(invocation.cwd, {
    noModify: invocation.options.modify === false,
    progress: invocation.progress,
  });
}

async function planHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observePlan } = await import('../commands/plan.js');
  return observePlan(invocation.cwd);
}

async function removeHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { removeProject } = await import('../commands/remove.js');
  return removeProject(invocation.cwd, {
    full: invocation.options.full === true,
    yes: invocation.options.yes === true,
    plan: typeof invocation.options.plan === 'string' ? invocation.options.plan : undefined,
  });
}

async function syncConfigHandler(invocation: CommandInvocation): Promise<CliResult> {
  const safewordDirectory = nodePath.join(invocation.cwd, '.safeword');
  if (!existsSync(safewordDirectory)) return notConfigured('project sync-config');

  const { buildArchitecture, inspectConfig, syncConfigCore } =
    await import('../commands/sync-config.js');
  const architecture = buildArchitecture(invocation.cwd);
  const before = inspectConfig(invocation.cwd, architecture);
  if (invocation.options.check === true) return configCheckResult(before);

  if (before.matches && existsSync(nodePath.join(invocation.cwd, '.dependency-cruiser.cjs'))) {
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
            kind: before.matches ? 'update' : 'create',
            target: '.safeword/depcruise-config.cjs',
          },
        ]
      : []),
    ...(synced.createdMainConfig ? [{ kind: 'create', target: '.dependency-cruiser.cjs' }] : []),
  ];
  return createResult({
    state: files.length === 0 ? 'healthy' : 'changed',
    effects: { files },
    data: { command: 'project sync-config', in_sync: true },
  });
}

async function architectureHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (!existsSync(nodePath.join(invocation.cwd, '.safeword'))) {
    return notConfigured('project architecture');
  }
  const { isWouldChangeAction, planSelfHealProject, selfHealProject } =
    await import('../utils/architecture-document.js');
  const planned = planSelfHealProject(invocation.cwd);
  const stale = planned.filter(action => isWouldChangeAction(action));
  if (invocation.options.check === true) {
    return createResult({
      state: stale.length === 0 ? 'healthy' : 'action_required',
      findings:
        stale.length === 0
          ? []
          : [
              {
                code: 'ARCHITECTURE_DRIFT',
                message: `Architecture documents are stale (${stale.join(', ')}).`,
                severity: 'warning',
              },
            ],
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
      data: { command: 'project architecture', planned: stale },
    });
  }
  const results = selfHealProject(invocation.cwd);
  const changed = results.filter(result => isWouldChangeAction(result.action));
  return createResult({
    state: changed.length === 0 ? 'healthy' : 'changed',
    effects: {
      files: changed.map(result => ({
        kind: result.action,
        target: nodePath.relative(invocation.cwd, result.path),
      })),
    },
    findings:
      invocation.options.stage === true && changed.length > 0
        ? [
            {
              code: 'ARCHITECTURE_STAGE_REQUIRED',
              message: 'Architecture files changed; stage them with git add.',
              severity: 'warning',
            },
          ]
        : [],
    data: { command: 'project architecture' },
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
  return observeTestPlan(
    invocation.cwd,
    invocation.operands[0] as string | undefined,
    invocation.options,
  );
}

async function lintGherkinHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeGherkinLint } = await import('../commands/lint-gherkin.js');
  return observeGherkinLint(
    invocation.cwd,
    (invocation.operands[0] as readonly string[] | undefined) ?? [],
  );
}

function stringOption(
  options: Readonly<Record<string, unknown>>,
  name: string,
): string | undefined {
  const value = options[name];
  return typeof value === 'string' ? value : undefined;
}

function numericOption(
  options: Readonly<Record<string, unknown>>,
  name: string,
): number | undefined {
  const value = options[name];
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function trackerConnectEffects(
  provider: string,
  connected: boolean,
): Partial<CliResult['effects']> {
  if (provider !== 'github' && provider !== 'linear') return {};
  return {
    files: [
      { kind: 'update', target: '.safeword/config.json' },
      ...(connected ? [{ kind: 'create', target: '.safeword/tracker-map.json' }] : []),
    ],
  };
}

function trackerConnectResult(
  provider: string,
  result: { readonly exitCode: number; readonly connected: boolean },
  messages: readonly string[],
): CliResult {
  const succeeded = result.exitCode === 0;
  return createResult({
    state: succeeded ? 'changed' : 'failed',
    changed: succeeded,
    effects: trackerConnectEffects(provider, result.connected),
    errors: succeeded
      ? []
      : [
          {
            code: 'TRACKER_CONNECT_FAILED',
            message: messages.at(-1) ?? 'Tracker connection failed.',
            retryable: true,
          },
        ],
    data: { command: 'tracker connect', provider, connected: result.connected, messages },
  });
}

async function runTrackerConnect(invocation: CommandInvocation): Promise<CliResult> {
  const provider = invocation.operands[0];
  if (typeof provider !== 'string') {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'TRACKER_PROVIDER_REQUIRED',
          message: 'tracker connect requires a provider.',
          retryable: false,
        },
      ],
    });
  }
  const { runConnect } = await import('../tracker-connect/run.js');
  const messages: string[] = [];
  const result = await runConnect(
    provider,
    {
      repo: stringOption(invocation.options, 'repo'),
      team: stringOption(invocation.options, 'team'),
      workspace: stringOption(invocation.options, 'workspace'),
    },
    message => {
      messages.push(message);
    },
    {
      cwd: invocation.cwd,
      prompt: { confirm: () => Promise.resolve(false) },
    },
  );
  return trackerConnectResult(provider, result, messages);
}

interface TrackerSyncResultInput {
  readonly provider: string | undefined;
  readonly exitCode: number;
  readonly before: string | undefined;
  readonly after: string | undefined;
  readonly messages: readonly string[];
}

function trackerSyncResult(input: TrackerSyncResultInput): CliResult {
  const changed = input.before !== input.after;
  const succeeded = input.exitCode === 0;
  let state: CliResult['state'] = 'failed';
  if (succeeded) state = changed ? 'changed' : 'healthy';
  return createResult({
    state,
    changed,
    effects: {
      files: changed
        ? [
            {
              kind: input.before === undefined ? 'create' : 'update',
              target: '.safeword/tracker-map.json',
            },
          ]
        : [],
      network:
        input.provider === undefined
          ? []
          : [{ kind: 'tracker-sync', target: input.provider, operation: 'read-write' }],
    },
    errors: succeeded
      ? []
      : [
          {
            code: 'TRACKER_SYNC_FAILED',
            message: input.messages.at(-1) ?? 'Tracker synchronization failed.',
            retryable: true,
          },
        ],
    data: {
      command: 'tracker sync',
      provider: input.provider ?? 'none',
      messages: input.messages,
    },
  });
}

async function runOfflineTrackerSync(invocation: CommandInvocation): Promise<CliResult> {
  const { applyTrackerSyncResults, planTrackerSync } = await import('../commands/sync-tracker.js');
  const { readTicketBridgeConfig } = await import('../tracker-sync/config.js');
  const config = readTicketBridgeConfig(invocation.cwd);
  const applyResultsFile = stringOption(invocation.options, 'applyResults');
  const result =
    applyResultsFile === undefined
      ? planTrackerSync(invocation.cwd, config)
      : applyTrackerSyncResults(invocation.cwd, config, applyResultsFile);
  if (!result.ok) {
    return createResult({
      state: 'failed',
      errors: [{ code: 'TRACKER_SYNC_FAILED', message: result.reason, retryable: false }],
      data: { command: 'tracker sync', mode: result.mode, messages: result.messages },
    });
  }
  if (result.mode === 'plan') {
    return createResult({
      state: 'healthy',
      findings: result.messages.map(message => ({
        code: 'TRACKER_SYNC_ADVISORY',
        message,
        severity: 'warning',
      })),
      data: {
        command: 'tracker sync',
        mode: 'plan',
        provider: result.provider ?? 'none',
        plan: result.plan,
      },
    });
  }
  return createResult({
    state: result.changed ? 'changed' : 'healthy',
    changed: result.changed,
    effects: {
      files: result.changed ? [{ kind: 'update', target: '.safeword/tracker-map.json' }] : [],
    },
    data: { command: 'tracker sync', mode: 'apply', provider: result.provider },
  });
}

async function runTrackerSync(invocation: CommandInvocation): Promise<CliResult> {
  const { existsSync: pathExists, readFileSync: readFile } = await import('node:fs');
  const { buildWriterRegistry, resolveRepoVisibility } = await import('../tracker-sync/clients.js');
  const { readTicketBridgeConfig } = await import('../tracker-sync/config.js');
  const { readCorpus } = await import('../tracker-sync/corpus.js');
  const { supportedProvider, syncTracker } = await import('../tracker-sync/index.js');
  const { trackerMapPath } = await import('../tracker-sync/tracker-map.js');

  const config = readTicketBridgeConfig(invocation.cwd);
  const provider = supportedProvider(config.provider);
  const sidecarPath = trackerMapPath(invocation.cwd);
  const before = pathExists(sidecarPath) ? readFile(sidecarPath, 'utf8') : undefined;
  const messages: string[] = [];
  const writers =
    provider === undefined
      ? ({} as ReturnType<typeof buildWriterRegistry>)
      : buildWriterRegistry(provider, config.target);
  const repoVisibility =
    provider === 'github' && config.body === 'full'
      ? resolveRepoVisibility(config.target?.repo)
      : undefined;
  const result = await syncTracker({
    config,
    tickets: provider === undefined ? [] : readCorpus(invocation.cwd, config.target?.repo),
    sidecarPath,
    writers,
    env: process.env,
    resetTrackerMap: invocation.options.resetTrackerMap === true,
    nonInteractive: invocation.noInput,
    repoVisibility,
    log: message => {
      messages.push(message);
    },
  });
  const after = pathExists(sidecarPath) ? readFile(sidecarPath, 'utf8') : undefined;
  return trackerSyncResult({ provider, exitCode: result.exitCode, before, after, messages });
}

function trackerHandler(
  name: 'tracker connect' | 'tracker sync',
  invocation: CommandInvocation,
): Promise<CliResult> {
  const offlineMode =
    name === 'tracker sync' &&
    (invocation.options.plan === true || typeof invocation.options.applyResults === 'string');
  if (offlineMode) return runOfflineTrackerSync(invocation);
  if (invocation.offline) return Promise.resolve(onlineRequired(name));
  invocation.progress?.start(`Running ${name}…`);
  return name === 'tracker connect' ? runTrackerConnect(invocation) : runTrackerSync(invocation);
}

async function codexStatusHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { observeCodexMigration } = await import('../commands/migrate-codex-plugin.js');
  return observeCodexMigration(invocation.cwd);
}

function codexConfirmation(name: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [
      {
        code: 'CODEX_CONFIRMATION_REQUIRED',
        message: `Review and confirm the exact \`${name}\` operation.`,
        severity: 'warning',
      },
    ],
    nextActions: [{ command: `safeword ${name} --yes`, mutates: true, requiresHuman: true }],
    data: { command: name },
  });
}

function runCodexRecovery(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): CliResult {
  migration.recoverCodexMigration(invocation.cwd, { report: false });
  const observed = migration.observeCodexMigration(invocation.cwd);
  return {
    ...observed,
    state: 'changed',
    changed: true,
    effects: {
      ...observed.effects,
      configuration: [{ kind: 'restore', target: 'Safeword legacy Codex project state' }],
    },
  };
}

async function runCodexFinalization(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): Promise<CliResult> {
  const planned = migration.observeCodexFinalizationEffects(invocation.cwd);
  const changed = await migration.removeLegacyCodexHooks(invocation.cwd, {
    yes: true,
    report: false,
  });
  const observed = migration.observeCodexMigration(invocation.cwd);
  return {
    ...observed,
    state: changed ? 'changed' : observed.state,
    changed,
    effects: {
      ...observed.effects,
      files: changed
        ? planned.map(effect => ({
            kind: effect.action,
            target: effect.path,
            operation: effect.action,
          }))
        : [],
    },
  };
}

function runCodexInstall(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): CliResult {
  migration.installCodexPlugin({
    cwd: invocation.cwd,
    json: true,
    reportMigrationState: false,
  });
  const observed = migration.observeCodexMigration(invocation.cwd);
  return {
    ...observed,
    state: 'changed',
    changed: true,
    effects: {
      ...observed.effects,
      configuration: [{ kind: 'enable', target: 'Safeword Codex profile plugin' }],
    },
  };
}

function codexFailure(error: unknown): CliResult {
  return createResult({
    state: 'failed',
    errors: [
      {
        code: 'CODEX_COMMAND_FAILED',
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      },
    ],
  });
}

type CodexMutationName = 'codex install' | 'codex migrate' | 'codex recover';

function codexNeedsConfirmation(
  name: CodexMutationName,
  isFinalization: boolean,
  invocation: CommandInvocation,
): boolean {
  const confirmationSensitive = isFinalization || name === 'codex recover';
  return confirmationSensitive && invocation.options.yes !== true;
}

async function executeCodexMutation(
  name: CodexMutationName,
  isFinalization: boolean,
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): Promise<CliResult> {
  if (name === 'codex recover') return runCodexRecovery(invocation, migration);
  if (isFinalization) return await runCodexFinalization(invocation, migration);
  return runCodexInstall(invocation, migration);
}

async function codexMutationHandler(
  name: CodexMutationName,
  invocation: CommandInvocation,
): Promise<CliResult> {
  if (invocation.offline && name !== 'codex recover') return onlineRequired(name);
  const migration = await import('../commands/migrate-codex-plugin.js');
  const isFinalization =
    name === 'codex migrate' &&
    (invocation.options.finalize === true || invocation.options.removeLegacyHooks === true);
  if (codexNeedsConfirmation(name, isFinalization, invocation)) {
    return codexConfirmation(name);
  }

  invocation.progress?.start(`Running ${name}…`);
  try {
    return await executeCodexMutation(name, isFinalization, invocation, migration);
  } catch (codexError) {
    return codexFailure(codexError);
  }
}

function ticketListHandler(invocation: CommandInvocation): Promise<CliResult> {
  const ticketsRoot = nodePath.join(invocation.cwd, '.project', 'tickets');
  const tickets = existsSync(ticketsRoot)
    ? readdirSync(ticketsRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name !== 'completed')
        .map(entry => entry.name)
        .toSorted((left, right) => left.localeCompare(right))
    : [];
  return Promise.resolve(
    createResult({
      state: 'healthy',
      data: { command: 'ticket list', tickets },
    }),
  );
}

async function retroSignalsHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { readReports, summarizeReports } =
    await import('../../templates/hooks/lib/self-report.js');
  const records = readReports(invocation.cwd);
  return createResult({
    state: 'healthy',
    data: {
      command: 'retro signals',
      total: records.length,
      groups: summarizeReports(records),
    },
  });
}

function retroFailure(message: string): CliResult {
  return createResult({
    state: 'failed',
    errors: [{ code: 'RETRO_COMMAND_FAILED', message, retryable: true }],
  });
}

function retroOptions(invocation: CommandInvocation, transcript: string): RetroCliOptions {
  const findings = stringOption(invocation.options, 'findings');
  return {
    transcript: nodePath.resolve(invocation.cwd, transcript),
    findings: findings === undefined ? undefined : nodePath.resolve(invocation.cwd, findings),
    autoExtract: invocation.options.autoExtract === true,
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

function retroRunResult(execution: RetroCommandExecution): CliResult {
  if (!execution.outcome.ok) {
    return retroFailure(execution.outcome.errorMessage ?? 'Retro execution failed.');
  }
  if (!execution.extractionSucceeded) return retroFailure('Retro extraction failed.');
  const result = execution.outcome.result;
  const mutations = retroMutationCount(execution);
  return createResult({
    state: mutations > 0 ? 'changed' : 'healthy',
    changed: mutations > 0,
    effects: { network: retroNetworkEffects(execution) },
    findings: retroDropFindings(execution),
    data: {
      command: 'retro run',
      result,
      agent_filing_needed: execution.outcome.agentFilingNeeded ?? false,
    },
  });
}

async function retroRunHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('retro run');
  const transcript = stringOption(invocation.options, 'transcript');
  if (transcript === undefined) return retroFailure('retro run requires --transcript <path>.');

  const { executeRetroCommand } = await import('../commands/retro.js');
  invocation.progress?.start('Extracting and filing retro findings…');
  const execution = await executeRetroCommand(retroOptions(invocation, transcript), invocation.cwd);
  return retroRunResult(execution);
}

async function retroReconcileHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) return onlineRequired('retro reconcile');
  const { executeRetroReconcile } = await import('../commands/retro.js');
  invocation.progress?.start('Reconciling retro findings…');
  const execution = await executeRetroReconcile();
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
  setup: setupHandler,
  plan: planHandler,
  doctor: statusHandler,
  remove: removeHandler,
  'project sync-config': syncConfigHandler,
  'project architecture': architectureHandler,
  'project sync-learnings': syncLearningsHandler,
  'project sync-tickets': syncTicketsHandler,
  'project codify': codifyHandler,
  'project test-plan': testPlanHandler,
  'project lint-gherkin': lintGherkinHandler,
  'tracker sync': invocation => trackerHandler('tracker sync', invocation),
  'tracker connect': invocation => trackerHandler('tracker connect', invocation),
  'codex migrate': invocation => codexMutationHandler('codex migrate', invocation),
  'codex install': invocation => codexMutationHandler('codex install', invocation),
  'codex status': codexStatusHandler,
  'codex recover': invocation => codexMutationHandler('codex recover', invocation),
  'ticket list': ticketListHandler,
  'ticket new': async invocation => {
    const { createTicketResult } = await import('../commands/ticket-new.js');
    return createTicketResult(String(invocation.operands[0]), invocation.options, invocation.cwd);
  },
  'retro run': retroRunHandler,
  'retro signals': retroSignalsHandler,
  'retro reconcile': retroReconcileHandler,
  check: statusHandler,
  upgrade: setupHandler,
  diff: planHandler,
  reset: removeHandler,
  'sync-config': syncConfigHandler,
  architecture: architectureHandler,
  'sync-learnings': syncLearningsHandler,
  'sync-tickets': syncTicketsHandler,
  codify: codifyHandler,
  'test-plan': testPlanHandler,
  'lint-gherkin': lintGherkinHandler,
  'sync-tracker': invocation => trackerHandler('tracker sync', invocation),
  connect: invocation => trackerHandler('tracker connect', invocation),
  'self-report': retroSignalsHandler,
  retro: retroRunHandler,
  'retro-reconcile': retroReconcileHandler,
  'migrate codex-plugin': invocation => codexMutationHandler('codex migrate', invocation),
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
  const handler = HANDLERS[name];
  if (handler === undefined) throw new Error(`No typed public handler registered for ${name}`);
  return handler;
}
