/* eslint-disable unicorn/no-null -- Codex migration JSON uses explicit null */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, type Stats } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import {
  applyCodexFinalization,
  codexFinalizationIsComplete,
  type CodexFinalizationMutation,
  codexRecoveryIsRequired,
  recoverCodexFinalization,
  resolveCodexFinalizationConfirmation,
  validateCodexFinalizationPaths,
} from '../codex-plugin/finalization.js';
import { CODEX_MIGRATION_SCHEMA } from '../codex-plugin/inventory.js';
import { legacyCodexEventIsViable } from '../codex-plugin/legacy-authority.js';
import {
  CodexConfigObservationError,
  observeLegacyEvents,
  type PreparedLegacyHookRemoval,
  prepareLegacyHookRemoval,
  regularCodexConfigMetadata,
} from '../codex-plugin/legacy-config.js';
import {
  legacyGlobalGuidanceDiagnostic,
  observeLegacyGlobalGuidance,
} from '../codex-plugin/legacy-global-guidance.js';
import {
  CODEX_RESTART_GUIDANCE,
  codexMigrationExitCode,
  type CodexMigrationResultV2,
  type CodexPluginObservation,
  codexPluginVersionMatchesPackage,
  deriveCodexMigrationResult,
  renderCodexMigrationHuman,
} from '../codex-plugin/migration.js';
import { CodexMigrationError } from '../codex-plugin/migration-error.js';
import {
  codexActivationIsPending,
  type CodexHookProofObservation,
  observeCodexHookProof,
  writeCodexActivationMarker,
} from '../codex-plugin/profile-proof.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { info, success } from '../utils/output.js';

const MARKETPLACE_SOURCE = 'ArcadeAI/safeword';
const PLUGIN_ID = 'safeword@safeword';
const CODEX_CONFIG_PATH = CODEX_MIGRATION_SCHEMA.paths.config;
type CodexPluginList = {
  installed?: {
    enabled?: boolean;
    marketplaceName?: string;
    marketplaceSource?: { sourceType?: string; source?: string };
    pluginId?: string;
    version?: string;
  }[];
};
type CodexMarketplaceList = {
  marketplaces: {
    name?: string;
    marketplaceSource?: { sourceType?: string; source?: string };
  }[];
};

function run(command: string, arguments_: string[]): string {
  const result = spawnSync(command, arguments_, { encoding: 'utf8' });
  if (result.error)
    throw new Error(`${command} is required. Install it, then re-run this command.`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new Error(detail || `${command} ${arguments_.join(' ')} failed.`);
  }
  return result.stdout;
}

function pluginObservationFromList(output: string): CodexPluginObservation {
  const parsed = JSON.parse(output) as CodexPluginList;
  const plugin = parsed.installed?.find(candidate => candidate.pluginId === PLUGIN_ID);
  return {
    installed: plugin !== undefined,
    enabled: plugin?.enabled ?? (plugin === undefined ? false : null),
    version: plugin?.version ?? null,
    observation: 'observed',
  };
}

function isOfficialSafewordGitSource(source: string | undefined): boolean {
  if (source === undefined) return false;
  const normalized = source
    .toLowerCase()
    .replace(/\/$/u, '')
    .replace(/\.git$/u, '');
  return new Set([
    'arcadeai/safeword',
    'git@github.com:arcadeai/safeword',
    'https://github.com/arcadeai/safeword',
    'ssh://git@github.com/arcadeai/safeword',
  ]).has(normalized);
}

function observeCodexPlugin(): CodexPluginObservation {
  return pluginObservationFromList(run('codex', ['plugin', 'list', '--json']));
}

function marketplaceListFromOutput(output: string): CodexMarketplaceList {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch (error) {
    throw new CodexMigrationError(
      'PLUGIN_MARKETPLACE_FAILED',
      'Codex returned malformed marketplace discovery JSON; plugin installation did not run.',
      { cause: error },
    );
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Partial<CodexMarketplaceList>).marketplaces) ||
    !(parsed as Partial<CodexMarketplaceList>).marketplaces?.every(
      marketplace => typeof marketplace === 'object' && marketplace !== null,
    )
  ) {
    throw new CodexMigrationError(
      'PLUGIN_MARKETPLACE_FAILED',
      'Codex returned an unsupported marketplace discovery result; plugin installation did not run.',
    );
  }
  return parsed as CodexMarketplaceList;
}

function runCodexMarketplace(arguments_: string[], failureContext: string): string {
  try {
    return run('codex', ['plugin', 'marketplace', ...arguments_]);
  } catch (error) {
    throw new CodexMigrationError(
      'PLUGIN_MARKETPLACE_FAILED',
      `${failureContext}; plugin installation did not run: ${String(error)}`,
      { cause: error },
    );
  }
}

function refreshOrAddCodexMarketplace(marketplaceSource: string | undefined): void {
  if (marketplaceSource === undefined) {
    const output = runCodexMarketplace(
      ['list', '--json'],
      'Could not inspect configured Codex marketplaces',
    );
    const marketplace = marketplaceListFromOutput(output).marketplaces.find(
      candidate => candidate.name === 'safeword',
    );
    if (marketplace?.marketplaceSource?.sourceType === 'git') {
      if (!isOfficialSafewordGitSource(marketplace.marketplaceSource.source)) {
        throw new CodexMigrationError(
          'PLUGIN_MARKETPLACE_FAILED',
          `The configured Codex marketplace named safeword does not point to ${MARKETPLACE_SOURCE}; plugin installation did not run.`,
        );
      }
      runCodexMarketplace(
        ['upgrade', 'safeword', '--json'],
        'Could not refresh the configured Safeword Codex marketplace',
      );
      return;
    }
  }

  runCodexMarketplace(
    [
      'add',
      marketplaceSource ?? MARKETPLACE_SOURCE,
      '--sparse',
      '.agents/plugins',
      '--sparse',
      'packages/cli/codex-plugin',
      '--json',
    ],
    'Could not add the Safeword Codex marketplace',
  );
}

function addCodexPluginToProfile(marketplaceSource: string | undefined): void {
  refreshOrAddCodexMarketplace(marketplaceSource);
  run('codex', ['plugin', 'add', PLUGIN_ID, '--json']);
}

function verifyCodexPluginIsEnabled(options: { installationCompleted?: boolean } = {}): void {
  let pluginList: string;
  try {
    pluginList = run('codex', ['plugin', 'list', '--json']);
  } catch (error) {
    const prefix =
      options.installationCompleted === true
        ? 'Plugin installation succeeded, but enablement is unknown'
        : 'Could not verify the Safe Word Codex plugin';
    throw new CodexMigrationError(
      options.installationCompleted === true
        ? 'PLUGIN_ENABLEMENT_UNKNOWN'
        : 'PLUGIN_ENABLEMENT_FAILED',
      `${prefix}: ${String(error)}`,
      { cause: error },
    );
  }
  const plugin = pluginObservationFromList(pluginList);
  if (plugin.enabled !== true) {
    throw new CodexMigrationError(
      'PLUGIN_ENABLEMENT_FAILED',
      'Codex did not report the Safe Word plugin as enabled. Enable safeword@safeword, then re-run this command; project hooks were left unchanged.',
    );
  }
  if (plugin.version !== null && plugin.version !== SAFEWORD_SCHEMA.version) {
    throw new Error(
      `Codex reported Safe Word plugin ${plugin.version}, but ${SAFEWORD_SCHEMA.version} is required. Re-run safeword codex install to update it; project hooks were left unchanged.`,
    );
  }
}

function pathExistsIncludingDanglingSymlink(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw error;
  }
}

function observeLegacyAssets(cwd: string): string[] {
  return SAFEWORD_SCHEMA.codexMigration.cleanupFiles.filter(path =>
    pathExistsIncludingDanglingSymlink(nodePath.join(cwd, path)),
  );
}

function observeViableLegacyEvents(
  cwd: string,
  legacyEvents: string[],
  environment: NodeJS.ProcessEnv,
): string[] {
  const eventIdsByName = new Map(
    Object.entries(SAFEWORD_SCHEMA.codexMigration.hookEventNames).map(([event, name]) => [
      name,
      event,
    ]),
  );
  return legacyEvents.filter(eventName => {
    const event = eventIdsByName.get(eventName);
    return event !== undefined && legacyCodexEventIsViable(cwd, event, environment);
  });
}

export function observeCodexMigrationResult(
  cwd = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
): CodexMigrationResultV2 {
  let legacyEvents: string[] = [];
  let configObservationError: CodexConfigObservationError | undefined;
  try {
    legacyEvents = observeLegacyEvents(cwd);
  } catch (error) {
    if (!(error instanceof CodexConfigObservationError)) throw error;
    configObservationError = error;
  }
  const recoveryRequired = codexRecoveryIsRequired(cwd);
  let plugin: CodexPluginObservation;
  let pluginObservationError: Error | undefined;
  if (recoveryRequired) {
    plugin = { installed: false, enabled: null, version: null, observation: 'unknown' };
  } else {
    try {
      plugin = observeCodexPlugin();
    } catch (error) {
      plugin = { installed: false, enabled: null, version: null, observation: 'unknown' };
      pluginObservationError = error instanceof Error ? error : new Error(String(error));
    }
  }
  const result = deriveCodexMigrationResult({
    plugin,
    proof: observeCodexHookProof(environment),
    legacyAssets: observeLegacyAssets(cwd),
    legacyEvents,
    viableLegacyEvents: observeViableLegacyEvents(cwd, legacyEvents, environment),
    finalized: codexFinalizationIsComplete(cwd),
    recoveryRequired,
    activationPending: codexActivationIsPending(environment),
  });
  if (pluginObservationError !== undefined) {
    result.errors.push({
      code: 'PLUGIN_OBSERVATION_FAILED',
      message: pluginObservationError.message,
      retryable: true,
    });
  }
  if (configObservationError !== undefined) {
    result.errors.push({
      code: 'CODEX_CONFIG_UNREADABLE',
      message: configObservationError.message,
      retryable: false,
    });
  }
  return result;
}

const CODEX_MIGRATION_MESSAGES: Partial<Readonly<Record<CodexMigrationResultV2['state'], string>>> =
  {
    plugin_installed_app_restart_required: CODEX_RESTART_GUIDANCE,
    compatibility:
      'Codex is protected by the current profile plugin; verified legacy protection remains until explicit finalization.',
    plugin_enabled_hook_unproven:
      'Codex migration state: plugin_enabled_hook_unproven. Review /hooks in the restarted Codex app; when protection is confirmed, run safeword codex migrate --finalize.',
    recovery_required:
      'Codex migration state: recovery_required. Recovery is required before migration can continue.',
  };

function codexMigrationMessage(
  state: CodexMigrationResultV2['state'],
  proof?: CodexHookProofObservation,
): string {
  if (state === 'plugin_enabled_hook_unproven' && proof !== undefined) {
    return `Codex migration state: plugin_enabled_hook_unproven. In the restarted Codex app, review /hooks and exercise these missing hooks: ${proof.missing_events.join(', ')}. Then run safeword codex migrate --finalize.`;
  }
  return CODEX_MIGRATION_MESSAGES[state] ?? `Codex migration state: ${state}.`;
}

function legacyCodexMigrationState(
  state: CodexMigrationResultV2['state'],
): CodexMigrationResultV2['state'] | 'plugin_installed_restart_required' {
  return state === 'plugin_installed_app_restart_required'
    ? 'plugin_installed_restart_required'
    : state;
}

export function observeCodexMigration(
  cwd = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
): CliResult {
  const result = observeCodexMigrationResult(cwd, environment);
  const legacyState = legacyCodexMigrationState(result.state);
  const globalGuidance = legacyGlobalGuidanceDiagnostic(observeLegacyGlobalGuidance(environment));
  let state: CliResult['state'] = 'action_required';
  if (result.errors.length > 0) state = 'failed';
  else if (result.ok && globalGuidance.finding === undefined) state = 'healthy';
  return createResult({
    state,
    findings:
      result.errors.length > 0
        ? []
        : [
            {
              code: `CODEX_${legacyState.toUpperCase()}`,
              message: codexMigrationMessage(result.state, result.proof),
              severity: result.ok ? 'info' : 'warning',
              metadata: {
                migration_schema_version: result.schema_version,
                migration_state: result.state,
              },
            },
            ...(globalGuidance.finding === undefined ? [] : [globalGuidance.finding]),
          ],
    errors: result.errors,
    nextActions: [
      ...result.next_actions.map(action => ({
        command: action.command,
        mutates: action.mutates,
        requiresHuman: action.requires_human,
      })),
      ...(globalGuidance.nextAction === undefined ? [] : [globalGuidance.nextAction]),
    ],
    data: {
      command: 'codex status',
      // Compatibility field for schema-1 public-envelope consumers. New code
      // reads the explicitly versioned `migration` object below.
      migration_state: legacyState,
      migration: {
        schema_version: result.schema_version,
        state: result.state,
      },
      protected: result.protected,
      plugin: result.plugin,
      proof: result.proof,
      legacy: result.legacy,
      global_guidance: globalGuidance.observation,
    },
  });
}

function reportCodexMigration(
  cwd: string,
  options: {
    json?: boolean;
    environment?: NodeJS.ProcessEnv;
    changed?: boolean;
    effects?: CodexMigrationResultV2['effects']['files'];
  },
): void {
  const result = observeCodexMigrationResult(cwd, options.environment);
  result.changed = options.changed === true;
  if (options.effects !== undefined) result.effects.files = options.effects;
  process.stdout.write(
    options.json === true ? `${JSON.stringify(result)}\n` : renderCodexMigrationHuman(result),
  );
  process.exitCode = codexMigrationExitCode(result);
}

export function installCodexPlugin(
  // The CLI always uses MARKETPLACE_SOURCE. The source override lets the live
  // test validate a pushed release branch before its marketplace reaches main.
  options: {
    marketplaceSource?: string;
    reportMigrationState?: boolean;
    recordActivationPending?: boolean;
    json?: boolean;
    cwd?: string;
    environment?: NodeJS.ProcessEnv;
  } = {},
): void {
  const cwd = options.cwd ?? process.cwd();
  if (shouldReportExistingMigrationState(cwd, options)) {
    reportCodexMigration(cwd, { json: options.json, environment: options.environment });
    return;
  }
  run('bun', ['--version']);
  run('codex', ['--version']);
  addCodexPluginToProfile(options.marketplaceSource);
  verifyCodexPluginIsEnabled({ installationCompleted: true });
  if (options.recordActivationPending !== false) writeCodexActivationMarker(options.environment);

  if (options.json !== true) {
    success('Safe Word Codex plugin is enabled for this profile.');
    info(
      'This Codex app may keep its loaded Safe Word catalogue. Restart Codex, start a new task, then review the installed skills and hooks with /hooks. If this project uses Safe Word legacy hooks, run `safeword codex migrate --remove-legacy-hooks` to remove only those hooks.',
    );
  }
  if (options.reportMigrationState === true) {
    reportCodexMigration(cwd, {
      json: options.json,
      environment: options.environment,
      changed: true,
    });
  }
}

function shouldReportExistingMigrationState(
  cwd: string,
  options: {
    reportMigrationState?: boolean;
    environment?: NodeJS.ProcessEnv;
  },
): boolean {
  if (codexRecoveryIsRequired(cwd)) return true;
  if (options.reportMigrationState !== true) return false;
  const plugin = observeCodexMigrationResult(cwd, options.environment).plugin;
  return plugin.enabled === true && codexPluginVersionMatchesPackage(plugin);
}

function buildCodexFinalizationMutations(
  cwd: string,
  preparedLegacyHookRemoval: PreparedLegacyHookRemoval | undefined,
): CodexFinalizationMutation[] {
  const mutations: CodexFinalizationMutation[] = [];
  if (preparedLegacyHookRemoval !== undefined) {
    if (
      regularCodexConfigMetadata(preparedLegacyHookRemoval.configPath).kind === 'missing' ||
      readFileSync(preparedLegacyHookRemoval.configPath, 'utf8') !==
        preparedLegacyHookRemoval.original
    ) {
      throw new Error(
        'Codex configuration changed during plugin verification; no legacy hooks were removed.',
      );
    }
    mutations.push({ path: CODEX_CONFIG_PATH, content: preparedLegacyHookRemoval.cleaned });
  }
  for (const path of observeLegacyAssets(cwd)) mutations.push({ path, content: null });
  mutations.push(
    {
      path: CODEX_MIGRATION_SCHEMA.paths.pluginMarker,
      content: `${JSON.stringify({ schema_version: 1, mode: 'plugin' })}\n`,
    },
    {
      path: CODEX_MIGRATION_SCHEMA.paths.bootstrapSkill,
      content:
        '---\nname: safeword-plugin-setup\ndescription: Restore the Safe Word Codex profile plugin for this project.\n---\n\nRun `safeword codex migrate` to install or re-enable the profile plugin. Restart Codex after installation, start a new Codex task, then review its hooks with `/hooks`. Run `safeword codex status` to verify this project is protected.\n',
    },
  );
  return mutations;
}

function finalizationEffects(
  cwd: string,
  mutations: CodexFinalizationMutation[],
): CodexMigrationResultV2['effects']['files'] {
  return mutations.map(mutation => {
    let action: 'create' | 'update' | 'remove';
    if (mutation.content === null) action = 'remove';
    else if (pathExistsIncludingDanglingSymlink(nodePath.join(cwd, mutation.path)))
      action = 'update';
    else action = 'create';
    return { path: mutation.path, action };
  });
}

export function observeCodexFinalizationEffects(
  cwd: string,
): CodexMigrationResultV2['effects']['files'] {
  return observeCodexFinalizationPlan(cwd).effects;
}

function renderCodexFinalizationPlan(
  cwd: string,
  mutations: CodexFinalizationMutation[],
  preparedLegacyHookRemoval: PreparedLegacyHookRemoval | undefined,
): string {
  const lines = ['Finalization plan:'];
  for (const effect of finalizationEffects(cwd, mutations)) {
    lines.push(`- ${effect.action} ${effect.path}`);
    if (effect.path !== CODEX_CONFIG_PATH || preparedLegacyHookRemoval === undefined) continue;
    for (const block of preparedLegacyHookRemoval.removedBlocks) {
      lines.push(
        '  exact config block:',
        '  --- begin block ---',
        block.trimEnd(),
        '  --- end block ---',
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

type FinalizationInputSnapshot = {
  path: string;
  state: 'absent' | 'file';
  mode?: number;
  content?: string;
}[];

export interface ObservedCodexFinalizationPlan {
  readonly effects: CodexMigrationResultV2['effects']['files'];
  readonly exactConfigBlocks: readonly string[];
  readonly preconditionDigest: string;
}

function snapshotCodexFinalizationInputs(
  cwd: string,
  mutations: CodexFinalizationMutation[],
): FinalizationInputSnapshot {
  validateCodexFinalizationPaths(cwd, mutations);
  return mutations.map(mutation => {
    const path = nodePath.join(cwd, mutation.path);
    let metadata: Stats;
    try {
      metadata = lstatSync(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { path: mutation.path, state: 'absent' };
      }
      throw error;
    }
    if (!metadata.isFile()) {
      throw new Error(`Unsafe Codex migration path is not a regular file: ${mutation.path}`);
    }
    return {
      path: mutation.path,
      state: 'file',
      mode: metadata.mode & 0o777,
      content: readFileSync(path).toString('base64'),
    };
  });
}

export function observeCodexFinalizationPlan(cwd: string): ObservedCodexFinalizationPlan {
  const prepared = prepareLegacyHookRemoval(cwd);
  const mutations = buildCodexFinalizationMutations(cwd, prepared);
  const effects = finalizationEffects(cwd, mutations);
  const inputs = snapshotCodexFinalizationInputs(cwd, mutations);
  const preconditionDigest = createHash('sha256')
    .update(JSON.stringify({ mutations, effects, inputs }))
    .digest('hex');
  return {
    effects,
    exactConfigBlocks: prepared?.removedBlocks ?? [],
    preconditionDigest,
  };
}

function assertCodexFinalizationPlanUnchanged(
  cwd: string,
  preparedLegacyHookRemoval: PreparedLegacyHookRemoval | undefined,
  mutations: CodexFinalizationMutation[],
  effects: CodexMigrationResultV2['effects']['files'],
  inputs: FinalizationInputSnapshot,
): void {
  const currentMutations = buildCodexFinalizationMutations(cwd, preparedLegacyHookRemoval);
  const currentEffects = finalizationEffects(cwd, currentMutations);
  if (
    JSON.stringify(currentMutations) !== JSON.stringify(mutations) ||
    JSON.stringify(currentEffects) !== JSON.stringify(effects) ||
    JSON.stringify(snapshotCodexFinalizationInputs(cwd, mutations)) !== JSON.stringify(inputs)
  ) {
    throw new CodexMigrationError(
      'PLAN_STALE',
      'Codex finalization plan changed after confirmation; no repository files were modified.',
    );
  }
}

function reportCompletedFinalization(
  cwd: string,
  options: { json?: boolean; environment?: NodeJS.ProcessEnv },
): void {
  if (options.json === true) reportCodexMigration(cwd, options);
  else success('Safe Word Codex migration is already finalized.');
}

function reportAppliedFinalization(
  cwd: string,
  input: {
    options: { json?: boolean; environment?: NodeJS.ProcessEnv };
    effects: CodexMigrationResultV2['effects']['files'];
    removedLegacyHooks: boolean;
  },
): void {
  if (input.options.json === true) {
    reportCodexMigration(cwd, {
      ...input.options,
      changed: true,
      effects: input.effects,
    });
    return;
  }
  info('Backed up the complete legacy Codex state for conflict-safe recovery.');
  info(
    input.removedLegacyHooks
      ? 'Removed Safe Word legacy Codex project protection after the verified plugin handoff.'
      : 'No Safe Word legacy Codex hooks were found in this project.',
  );
}

function reportCodexWhen(enabled: boolean, report: () => void): void {
  if (enabled) report();
}

export async function removeLegacyCodexHooks(
  cwd = process.cwd(),
  options: {
    yes?: boolean;
    confirm?: (plan: string) => Promise<boolean>;
    environment?: NodeJS.ProcessEnv;
    json?: boolean;
    report?: boolean;
  } = {},
): Promise<boolean> {
  if (codexRecoveryIsRequired(cwd)) {
    reportCodexWhen(options.report !== false, () => {
      reportCodexMigration(cwd, options);
    });
    return false;
  }
  if (observeCodexHookProof(options.environment).status !== 'current') {
    throw new CodexMigrationError(
      'FINALIZATION_PROOF_REQUIRED',
      'Finalization requires current plugin hook proof from the restarted Codex app. Review /hooks, then retry.',
    );
  }
  if (codexFinalizationIsComplete(cwd)) {
    reportCodexWhen(options.report !== false, () => {
      reportCompletedFinalization(cwd, options);
    });
    return false;
  }
  // Validate cleanup before verifying the profile. A malformed project config
  // leaves both it and the Codex profile unchanged.
  const preparedLegacyHookRemoval = prepareLegacyHookRemoval(cwd);
  const plannedMutations = buildCodexFinalizationMutations(cwd, preparedLegacyHookRemoval);
  const plannedEffects = finalizationEffects(cwd, plannedMutations);
  const plannedInputs = snapshotCodexFinalizationInputs(cwd, plannedMutations);
  const plan = renderCodexFinalizationPlan(cwd, plannedMutations, preparedLegacyHookRemoval);
  const confirm = options.confirm;
  const confirmed = await resolveCodexFinalizationConfirmation({
    assumeYes: options.yes === true,
    confirm: confirm === undefined ? undefined : () => confirm(plan),
  });
  if (!confirmed) {
    reportCodexWhen(options.report !== false, () => {
      info('Codex migration finalization was declined; the project was left unchanged.');
    });
    return false;
  }

  run('bun', ['--version']);
  run('codex', ['--version']);
  verifyCodexPluginIsEnabled();

  reportCodexWhen(options.report !== false && options.json !== true, () => {
    success('Safe Word Codex plugin is enabled for this profile.');
  });

  assertCodexFinalizationPlanUnchanged(
    cwd,
    preparedLegacyHookRemoval,
    plannedMutations,
    plannedEffects,
    plannedInputs,
  );
  applyCodexFinalization(cwd, plannedMutations);

  reportCodexWhen(options.report !== false, () => {
    reportAppliedFinalization(cwd, {
      options,
      effects: plannedEffects,
      removedLegacyHooks: preparedLegacyHookRemoval !== undefined,
    });
  });
  return true;
}

/**
 * Compatibility facade for the pre-`codex install` command shape. New users
 * should use `safeword codex install`; existing scripts retain their behavior.
 */
export async function migrateCodexPlugin(
  cwd = process.cwd(),
  options: {
    marketplaceSource?: string;
    removeLegacyHooks?: boolean;
    yes?: boolean;
    confirm?: (plan: string) => Promise<boolean>;
  } = {},
): Promise<void> {
  if (options.removeLegacyHooks) {
    await removeLegacyCodexHooks(cwd, { yes: options.yes, confirm: options.confirm });
    return;
  }
  installCodexPlugin({
    marketplaceSource: options.marketplaceSource,
    recordActivationPending: false,
  });
}

export function recoverCodexMigration(
  cwd = process.cwd(),
  options: { json?: boolean; environment?: NodeJS.ProcessEnv; report?: boolean } = {},
): boolean {
  if (options.report === false) {
    return recoverCodexFinalization(cwd);
  }
  const changed = recoverCodexFinalization(cwd);
  if (options.json === true) {
    reportCodexMigration(cwd, { ...options, changed });
  } else {
    success(
      changed
        ? 'Restored the backed-up Safe Word legacy Codex project state.'
        : 'No Safe Word Codex migration recovery was needed.',
    );
  }
  return changed;
}
