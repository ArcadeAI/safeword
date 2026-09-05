/**
 * Handlers for the `codex` command family: status, bootstrap, the shared
 * install/migrate/recover mutation, and legacy global-guidance cleanup.
 *
 * A sibling module, matching tracker-ticket-handlers.ts and
 * retro-handlers.ts: the routing table stays in public-handlers.ts while each
 * domain owns its handlers, and heavy implementations stay behind dynamic
 * imports so the dispatch layer remains cheap to load.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type {
  LegacyGlobalGuidanceCleanupResult,
  LegacyGlobalGuidanceDiagnostic,
  LegacyGlobalGuidanceObservation,
} from '../codex-plugin/legacy-global-guidance.js';
import { CODEX_REVIEW_THEN_RESTART_ACTION } from '../codex-plugin/migration.js';
import { CodexMigrationError } from '../codex-plugin/migration-error.js';
import type * as CodexMigration from '../codex-plugin/operations.js';
import { observedFileEffect, observeFile } from './file-snapshot.js';
import type { CommandInvocation } from './handler.js';
import { onlineRequired } from './online-required.js';
import { stringOption } from './option-values.js';
import {
  type CliPlan,
  createPlan,
  isPlanIdentity,
  malformedPlanIdentity,
  toWirePlan,
} from './plan.js';
import { shellQuote } from './replay-command.js';
import { type CliResult, createResult } from './result.js';

export async function codexStatusHandler(invocation: CommandInvocation): Promise<CliResult> {
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

export async function codexCleanGuidanceHandler(invocation: CommandInvocation): Promise<CliResult> {
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

export async function codexBootstrapHandler(invocation: CommandInvocation): Promise<CliResult> {
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

export async function codexMutationHandler(
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
