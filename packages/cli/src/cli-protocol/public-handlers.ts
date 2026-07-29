import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync, type Stats } from 'node:fs';
import nodePath from 'node:path';

import { CodexMigrationError } from '../codex-plugin/migration-error.js';
import type * as CodexMigration from '../commands/migrate-codex-plugin.js';
import type { RetroCliOptions, RetroCommandExecution } from '../commands/retro.js';
import type { CommandHandler, CommandInvocation } from './handler.js';
import { onlineRequired } from './online-required.js';
import { numericOption, stringOption } from './option-values.js';
import { type CliPlan, createPlan, toWirePlan } from './plan.js';
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
  if (invocation.offline && invocation.options.full === true) {
    return onlineRequired('remove');
  }
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
  const { isArchitectureDocumentEnforcementEnabled } = await import('../utils/configured-paths.js');
  const observeAdvisories = () =>
    discoverUnreadableWorkspaces(invocation.cwd)
      .map(
        workspace =>
          `Workspace config present but unreadable: ${workspace.config} (${workspace.manager}).`,
      )
      .map(message => ({
        code: 'ARCHITECTURE_ADVISORY',
        message,
        severity: 'info' as const,
      }));
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
      files: [
        ...changed.map(result => ({
          kind: result.action === 'created' ? 'create' : 'update',
          target: nodePath.relative(invocation.cwd, result.path),
        })),
        ...staged.map(effect => ({ ...effect, operation: 'stage' })),
      ],
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
    throw new CodexMigrationError(
      'FINALIZATION_PROOF_REQUIRED',
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
  const paths = current.plan.effects.files.map(effect =>
    nodePath.join(invocation.cwd, effect.target),
  );
  const before = paths.map(path => ({ path, snapshot: observeFile(path) }));
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
  error: unknown,
  message: string,
  name: CodexMutationName,
  isFinalization: boolean,
): string {
  if (error instanceof CodexMigrationError) return error.code;
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
        code: codexFailureCode(error, message, name, isFinalization),
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
  return createResult({
    state: 'healthy',
    presentation,
    data: {
      command: 'retro signals',
      total: records.length,
      groups,
      ...(format === 'issue' && { issues: formatIssueDrafts(records) }),
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
  const execution = await executeRetroCommand(options, invocation.cwd);
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
