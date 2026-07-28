import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type * as CodexMigration from '../commands/migrate-codex-plugin.js';
import type { RetroCliOptions, RetroCommandExecution } from '../commands/retro.js';
import type { CommandHandler, CommandInvocation } from './handler.js';
import { type CliPlan, createPlan, toWirePlan } from './plan.js';
import { type CliResult, createResult } from './result.js';

function onlineRequired(name: string, nextCommand = name): CliResult {
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
        command: `safeword ${nextCommand}`,
        mutates: true,
        requiresHuman: false,
      },
    ],
    data: { command: name, offline: true },
  });
}

function shellArgument(value: string): string {
  const escapedSingleQuote = `'"'"'`;
  return `'${value.split("'").join(escapedSingleQuote)}'`;
}

function ticketNewReplayCommand(invocation: CommandInvocation): string {
  const slug = String(invocation.operands[0]);
  const type = stringOption(invocation.options, 'type') ?? 'task';
  const optionalArguments = [
    ['--title', stringOption(invocation.options, 'title')],
    ['--goal', stringOption(invocation.options, 'goal')],
    ['--why', stringOption(invocation.options, 'why')],
    ['--parent', stringOption(invocation.options, 'parent')],
    ['--issue', stringOption(invocation.options, 'issue')],
  ] as const;
  const renderedOptions = optionalArguments.flatMap(([flag, value]) =>
    value === undefined ? [] : [`${flag} ${shellArgument(value)}`],
  );
  return [
    `ticket new ${shellArgument(slug)}`,
    `--type ${shellArgument(type)}`,
    ...renderedOptions,
    `--cwd ${shellArgument(invocation.cwd)}`,
  ].join(' ');
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
    migrateNamespace:
      typeof invocation.options.migrateNamespace === 'boolean'
        ? invocation.options.migrateNamespace
        : undefined,
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

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- architecture reconciliation coordinates observation, enforcement, healing, and optional staging in one truthful result
async function architectureHandler(invocation: CommandInvocation): Promise<CliResult> {
  const { isWouldChangeAction, planSelfHealProject, selfHealProject } =
    await import('../utils/architecture-document.js');
  const { discoverUnreadableWorkspaces } = await import('../utils/architecture-monorepo.js');
  const { architectureNarrativeDriftAdvisoryForProject } =
    await import('../utils/architecture-narrative-drift.js');
  const { isArchitectureDocumentEnforcementEnabled } = await import('../utils/configured-paths.js');
  const observeAdvisories = () => {
    const narrativeAdvisory = architectureNarrativeDriftAdvisoryForProject(invocation.cwd);
    return [
      ...discoverUnreadableWorkspaces(invocation.cwd).map(
        workspace =>
          `Workspace config present but unreadable: ${workspace.config} (${workspace.manager}).`,
      ),
      ...(narrativeAdvisory === undefined ? [] : [narrativeAdvisory]),
    ].map(message => ({
      code: 'ARCHITECTURE_ADVISORY',
      message,
      severity: 'info' as const,
    }));
  };
  const advisories = observeAdvisories();
  const enforcementEnabled = isArchitectureDocumentEnforcementEnabled(invocation.cwd);
  if (!enforcementEnabled && (invocation.options.check || invocation.options.stage)) {
    return createResult({
      state: 'healthy',
      findings: [
        {
          code: 'ARCHITECTURE_ENFORCEMENT_DISABLED',
          message: 'Architecture document enforcement is disabled for this project.',
          severity: 'info',
        },
        ...advisories,
      ],
      data: { command: 'project architecture', enforcement: false },
    });
  }
  const planned = planSelfHealProject(invocation.cwd);
  const stale = planned.filter(action => isWouldChangeAction(action));
  if (invocation.options.check === true) {
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
                message: `Architecture documents are stale (${stale.join(', ')}).`,
                severity: 'warning',
              },
              ...advisories,
            ],
      data: { command: 'project architecture', planned: stale, enforcement: true },
    });
  }
  const results = selfHealProject(invocation.cwd);
  const changed = results.filter(result => isWouldChangeAction(result.action));
  const completedAdvisories = observeAdvisories();
  const staged: { kind: string; target: string }[] = [];
  const stageFailures: string[] = [];
  if (invocation.options.stage === true) {
    for (const result of changed) {
      const target = nodePath.relative(invocation.cwd, result.path);
      try {
        execFileSync('git', ['add', '--', target], {
          cwd: invocation.cwd,
          stdio: 'ignore',
        });
        staged.push({ kind: 'stage', target });
      } catch {
        stageFailures.push(target);
      }
    }
  }
  let resultState: CliResult['state'] = changed.length === 0 ? 'healthy' : 'changed';
  if (stageFailures.length > 0) resultState = 'action_required';
  return createResult({
    state: resultState,
    changed: changed.length > 0,
    effects: {
      files: changed.map(result => ({
        kind: result.action === 'created' ? 'create' : 'update',
        target: nodePath.relative(invocation.cwd, result.path),
      })),
      configuration: staged,
    },
    findings: [
      ...(changed.length === 0
        ? [
            {
              code: 'ARCHITECTURE_UNCHANGED',
              message: 'Architecture documents are unchanged.',
              severity: 'info' as const,
            },
          ]
        : [
            {
              code: 'ARCHITECTURE_REFRESHED',
              message: `Architecture documents created, healed, or regenerated (${changed
                .map(result => nodePath.relative(invocation.cwd, result.path))
                .join(', ')}).`,
              severity: 'info' as const,
            },
          ]),
      ...completedAdvisories,
      ...(stageFailures.length > 0
        ? [
            {
              code: 'ARCHITECTURE_STAGE_FAILED',
              message: `Architecture documents were refreshed but could not be staged (${stageFailures.join(', ')}).`,
              severity: 'warning' as const,
            },
          ]
        : []),
    ],
    nextActions:
      stageFailures.length > 0
        ? [
            {
              command: 'safeword project architecture --stage',
              mutates: true,
              requiresHuman: false,
            },
          ]
        : [],
    data: {
      command: 'project architecture',
      staged: invocation.options.stage === true && stageFailures.length === 0,
      staged_files: staged.map(effect => effect.target),
      stage_failures: stageFailures,
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

interface JournalMutation {
  readonly surface: 'file' | 'configuration' | 'network';
  readonly kind: string;
  readonly target: string;
  readonly operation: string;
}

function journalEffects(mutations: readonly JournalMutation[]): Partial<CliResult['effects']> {
  const toEffect = ({ kind, target, operation }: JournalMutation) => ({
    kind,
    target,
    operation,
  });
  return {
    files: mutations
      .filter(mutation => mutation.surface === 'file')
      .map(mutation => toEffect(mutation)),
    configuration: mutations
      .filter(mutation => mutation.surface === 'configuration')
      .map(mutation => toEffect(mutation)),
    network: mutations
      .filter(mutation => mutation.surface === 'network')
      .map(mutation => toEffect(mutation)),
  };
}

function trackerConnectReplayCommand(provider: string, invocation: CommandInvocation): string {
  const options = [
    ['--repo', stringOption(invocation.options, 'repo')],
    ['--team', stringOption(invocation.options, 'team')],
    ['--workspace', stringOption(invocation.options, 'workspace')],
  ] as const;
  return [
    'safeword tracker connect',
    shellArgument(provider),
    ...options.flatMap(([flag, value]) =>
      value === undefined ? [] : [flag, shellArgument(value)],
    ),
    '--cwd',
    shellArgument(invocation.cwd),
  ].join(' ');
}

function trackerConnectResult(
  provider: string,
  result: {
    readonly exitCode: number;
    readonly connected: boolean;
    readonly mutations: readonly JournalMutation[];
  },
  messages: readonly string[],
  invocation: CommandInvocation,
): CliResult {
  const succeeded = result.exitCode === 0;
  const changed = result.mutations.some(mutation => mutation.surface !== 'network');
  let state: CliResult['state'] = 'failed';
  if (succeeded) state = changed ? 'changed' : 'healthy';
  return createResult({
    state,
    changed,
    effects: journalEffects(result.mutations),
    errors: succeeded
      ? []
      : [
          {
            code: 'TRACKER_CONNECT_FAILED',
            message: messages.at(-1) ?? 'Tracker connection failed.',
            retryable: true,
          },
        ],
    recovery:
      !succeeded && changed
        ? [
            {
              command: trackerConnectReplayCommand(provider, invocation),
              description:
                'Retry verification and finish tracker setup using the persisted configuration.',
              requiresHuman: false,
            },
          ]
        : [],
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
  return trackerConnectResult(provider, result, messages, invocation);
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

function codexFinalizationPlan(
  cwd: string,
  migration: typeof CodexMigration,
): { readonly plan: CliPlan; readonly exactConfigBlocks: readonly string[] } {
  // Validate and snapshot repository inputs before consulting the profile. An
  // unsafe or malformed project must fail without invoking external tooling.
  migration.observeCodexFinalizationPlan(cwd);
  const observation = migration.observeCodexMigrationResult(cwd);
  if (observation.proof.status !== 'current') {
    throw new Error(
      'Finalization requires current plugin hook proof. Start a new Codex session, review /hooks, then retry.',
    );
  }
  // Profile verification is an external boundary. Re-snapshot afterward so
  // consent can never be bound to repository state that changed during it.
  const observed = migration.observeCodexFinalizationPlan(cwd);
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
  const suppliedPlan =
    typeof invocation.options.plan === 'string' ? invocation.options.plan : undefined;
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
): Promise<CliResult> {
  const current = codexFinalizationPlan(invocation.cwd, migration);
  const suppliedPlan =
    typeof invocation.options.plan === 'string' ? invocation.options.plan : undefined;
  if (suppliedPlan !== undefined && suppliedPlan !== current.plan.id) {
    return staleCodexPlan(current.plan);
  }
  const planned = current.plan.effects.files;
  const changed = await migration.removeLegacyCodexHooks(invocation.cwd, {
    yes: true,
    report: false,
  });
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
      files: changed ? planned : [],
    },
  };
}

function runCodexInstall(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): CliResult {
  const before = migration.observeCodexMigrationResult(invocation.cwd);
  if (before.plugin.enabled === true && before.state !== 'plugin_update_required') {
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

function codexFailureCode(
  message: string,
  name: CodexMutationName,
  isFinalization: boolean,
): string {
  const specific = (
    [
      [/Plugin installation succeeded, but enablement is unknown/iu, 'PLUGIN_ENABLEMENT_UNKNOWN'],
      [/did not report the Safe Word plugin as enabled/iu, 'PLUGIN_ENABLEMENT_FAILED'],
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
    /Plugin installation succeeded, but enablement is unknown|did not report the Safe Word plugin as enabled/iu.test(
      message,
    );
  return createResult({
    state: 'failed',
    changed: partialInstall || fileEffects.length > 0,
    effects: {
      files: fileEffects,
      configuration: partialInstall
        ? [
            {
              kind: 'install',
              target: 'Safeword Codex profile plugin',
              operation: 'enablement-unverified',
            },
          ]
        : [],
    },
    recovery:
      fileEffects.length > 0
        ? [
            {
              command: 'safeword codex recover',
              description: 'Retry recovery using the retained migration backup.',
              requiresHuman: true,
            },
          ]
        : [],
    errors: [
      {
        code: codexFailureCode(message, name, isFinalization),
        message,
        retryable: true,
      },
    ],
  });
}

type CodexMutationName = 'codex install' | 'codex migrate' | 'codex recover';

async function executeCodexMutation(
  name: CodexMutationName,
  isFinalization: boolean,
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): Promise<CliResult> {
  if (name === 'codex recover') return await runCodexRecovery(invocation, migration);
  if (isFinalization) return await runCodexFinalization(invocation, migration);
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
  const migrationState = (observed.data as { migration_state?: string } | undefined)
    ?.migration_state;
  if (migrationState !== 'plugin_update_required') return undefined;
  return {
    ...observed,
    state: 'failed',
    errors: [
      ...observed.errors,
      {
        code: 'PLUGIN_UPDATE_REQUIRED',
        message:
          'Finalization requires the packaged Safe Word plugin version. Run safeword codex install, start a new session, and review /hooks.',
        retryable: true,
      },
    ],
    nextActions: [
      {
        command: 'safeword codex install',
        mutates: true,
        requiresHuman: false,
      },
    ],
  };
}

async function codexFinalizationPreflight(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): Promise<CliResult | undefined> {
  const finalization = await import('../codex-plugin/finalization.js');
  if (finalization.codexFinalizationIsComplete(invocation.cwd)) {
    return migration.observeCodexMigration(invocation.cwd);
  }
  const observedPlan = codexFinalizationPlan(invocation.cwd, migration);
  const observed = migration.observeCodexMigration(invocation.cwd);
  const pluginUpdateFailure = codexPluginUpdateFailure(observed);
  if (pluginUpdateFailure !== undefined) return pluginUpdateFailure;
  const suppliedPlan =
    typeof invocation.options.plan === 'string' ? invocation.options.plan : undefined;
  const deprecatedAssumeYes =
    invocation.options.removeLegacyHooks === true && invocation.options.yes === true;
  if (invocation.options.yes !== true || (suppliedPlan === undefined && !deprecatedAssumeYes)) {
    return codexConfirmation(observedPlan.plan, observedPlan.exactConfigBlocks);
  }
  return suppliedPlan === undefined || suppliedPlan === observedPlan.plan.id
    ? undefined
    : staleCodexPlan(observedPlan.plan);
}

async function codexRecoveryPreflight(
  invocation: CommandInvocation,
  migration: typeof CodexMigration,
): Promise<CliResult | undefined> {
  const { plan, recovery } = await codexRecoveryPlan(invocation.cwd);
  if (recovery.effects.length === 0) return await runCodexRecovery(invocation, migration);
  const suppliedPlan =
    typeof invocation.options.plan === 'string' ? invocation.options.plan : undefined;
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
): Promise<CliResult | undefined> {
  if (await codexRecoveryRequired(invocation.cwd, isFinalization)) {
    return migration.observeCodexMigration(invocation.cwd);
  }
  if (isFinalization) return codexFinalizationPreflight(invocation, migration);
  if (name === 'codex recover') return codexRecoveryPreflight(invocation, migration);
  return undefined;
}

async function codexMutationHandler(
  name: CodexMutationName,
  invocation: CommandInvocation,
): Promise<CliResult> {
  if (invocation.offline && name !== 'codex recover') return onlineRequired(name);
  const isFinalization = isCodexFinalization(name, invocation);
  try {
    const migration = await import('../commands/migrate-codex-plugin.js');
    const preflight = await codexMutationPreflight(name, isFinalization, invocation, migration);
    if (preflight !== undefined) return preflight;

    invocation.progress?.start(`Running ${name}…`);
    return await executeCodexMutation(name, isFinalization, invocation, migration);
  } catch (codexError) {
    return codexFailure(codexError, name, isFinalization);
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

async function ticketNewHandler(invocation: CommandInvocation): Promise<CliResult> {
  if (invocation.offline) {
    const { readTicketBridgeConfig } = await import('../tracker-sync/config.js');
    const config = readTicketBridgeConfig(invocation.cwd);
    if (config.provider === 'github' || config.provider === 'linear') {
      return onlineRequired('ticket new', ticketNewReplayCommand(invocation));
    }
  }
  const { createTicketResult } = await import('../commands/ticket-new.js');
  return createTicketResult(String(invocation.operands[0]), invocation.options, invocation.cwd);
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

function retroRunResult(
  execution: RetroCommandExecution,
  fileEffects: CliResult['effects']['files'],
): CliResult {
  if (!execution.outcome.ok) {
    return retroFailure(execution.outcome.errorMessage ?? 'Retro execution failed.');
  }
  if (!execution.extractionSucceeded) return retroFailure('Retro extraction failed.');
  const result = execution.outcome.result;
  const changed = retroMutationCount(execution) > 0 || fileEffects.length > 0;
  return createResult({
    state: changed ? 'changed' : 'healthy',
    changed,
    effects: { files: fileEffects, network: retroNetworkEffects(execution) },
    findings: retroDropFindings(execution),
    data: {
      command: 'retro run',
      result,
      agent_filing_needed: execution.outcome.agentFilingNeeded ?? false,
    },
  });
}

function observeFile(path: string): string | undefined {
  try {
    return readFileSync(path).toString('base64');
  } catch {
    return undefined;
  }
}

function observedFileEffect(
  cwd: string,
  path: string,
  before: string | undefined,
): CliResult['effects']['files'] {
  const after = observeFile(path);
  if (before === after) return [];
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
  const execution = await executeRetroCommand(options, invocation.cwd);
  return retroRunResult(execution, observedFileEffect(invocation.cwd, spoolPath, spoolBefore));
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
  'ticket new': ticketNewHandler,
  'retro run': retroRunHandler,
  'retro signals': retroSignalsHandler,
  'retro reconcile': retroReconcileHandler,
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
