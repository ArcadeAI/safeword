/* eslint-disable unicorn/no-null -- Codex migration JSON uses explicit null */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, type Stats } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { parse } from 'smol-toml';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { info, success } from '../utils/output.js';
import { compareVersions, isSafePackageVersion } from '../utils/version.js';
import {
  applyCodexFinalization,
  codexFinalizationIsComplete,
  type CodexFinalizationMutation,
  codexRecoveryIsRequired,
  recoverCodexFinalization,
  resolveCodexFinalizationConfirmation,
  validateCodexFinalizationPaths,
} from './finalization.js';
import { CODEX_MIGRATION_SCHEMA } from './inventory.js';
import { legacyCodexEventIsViable } from './legacy-authority.js';
import {
  CodexConfigObservationError,
  observeLegacyEvents,
  type PreparedLegacyHookRemoval,
  prepareLegacyHookRemoval,
  regularCodexConfigMetadata,
} from './legacy-config.js';
import {
  legacyGlobalGuidanceDiagnostic,
  observeLegacyGlobalGuidance,
} from './legacy-global-guidance.js';
import {
  CODEX_HOOK_ACTIVATION_FAILED_CONTEXT,
  CODEX_RESTART_CONTEXT,
  CODEX_REVIEW_THEN_RESTART_ACTION,
  codexMigrationExitCode,
  type CodexMigrationResultV2,
  type CodexPluginObservation,
  codexPluginVersionMatchesPackage,
  deriveCodexMigrationResult,
  renderCodexMigrationHuman,
} from './migration.js';
import { CodexMigrationError } from './migration-error.js';
import { acquireCodexProfileLock, releaseCodexProfileLock } from './profile-lock.js';
import {
  codexActivationIsPending,
  codexActivationRestartIsProven,
  codexActivationRestartWasObserved,
  type CodexHookProofObservation,
  observeCodexHookProof,
  writeCodexActivationMarker,
} from './profile-proof.js';
import { preparedCodexProjectBootstrap } from './project-bootstrap.js';

export { codexInstallRequiresMutation } from './migration.js';

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

interface ConfiguredMarketplace {
  ref?: string;
  source?: string;
}

function configuredSafewordMarketplace(
  environment: NodeJS.ProcessEnv = process.env,
): ConfiguredMarketplace | undefined {
  const configPath = nodePath.join(
    environment.CODEX_HOME ?? nodePath.join(homedir(), '.codex'),
    'config.toml',
  );
  if (!existsSync(configPath)) return;
  try {
    const document = parse(readFileSync(configPath, 'utf8')) as {
      marketplaces?: { safeword?: ConfiguredMarketplace };
    };
    return document.marketplaces?.safeword;
  } catch (error) {
    throw new CodexMigrationError(
      'PLUGIN_MARKETPLACE_FAILED',
      'The Codex profile configuration is invalid TOML; the Safeword marketplace was not changed.',
      { cause: error },
    );
  }
}

function marketplaceAddArguments(source: string, ref: string, includeJson = true): string[] {
  const args = [
    'add',
    source,
    '--ref',
    ref,
    '--sparse',
    '.agents/plugins',
    '--sparse',
    'packages/cli/codex-plugin',
  ];
  return includeJson ? [...args, '--json'] : args;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function exactVersionReference(ref: string): string | undefined {
  const version = ref.startsWith('v') ? ref.slice(1) : ref;
  return isSafePackageVersion(version) ? version : undefined;
}

function replaceCodexMarketplaceWithStable(configured: ConfiguredMarketplace): void {
  const source = configured.source ?? MARKETPLACE_SOURCE;
  runCodexMarketplace(
    ['remove', 'safeword', '--json'],
    'Could not replace the Safeword marketplace',
  );
  try {
    runCodexMarketplace(
      marketplaceAddArguments(MARKETPLACE_SOURCE, 'stable'),
      'Could not enroll the Safeword stable marketplace channel',
    );
  } catch (error) {
    try {
      runCodexMarketplace(
        marketplaceAddArguments(source, configured.ref ?? 'main'),
        'Could not restore the previous Safeword marketplace after stable enrollment failed',
      );
    } catch (restorationError) {
      const restoreCommand = [
        'codex',
        'plugin',
        'marketplace',
        ...marketplaceAddArguments(source, configured.ref ?? 'main', false),
      ]
        .map(argument => shellQuote(argument))
        .join(' ');
      throw new CodexMigrationError(
        'PLUGIN_MARKETPLACE_FAILED',
        `Stable marketplace enrollment failed and the previous Safeword marketplace could not be restored. The profile no longer has that marketplace; restore it with \`${restoreCommand}\`. Stable error: ${String(error)}. Restore error: ${String(restorationError)}`,
        { cause: error, profileChanged: true, recoveryCommand: restoreCommand },
      );
    }
    throw error;
  }
}

function assertMarketplacePinIsNotNewer(
  ref: string | undefined,
  pinnedVersion: string | undefined,
): void {
  if (pinnedVersion === undefined || compareVersions(pinnedVersion, SAFEWORD_SCHEMA.version) <= 0) {
    return;
  }
  throw new CodexMigrationError(
    'PLUGIN_NEWER_PIN_PRESERVED',
    `Codex is pinned to newer Safeword ${ref}; Safeword left that explicit profile pin unchanged.`,
  );
}

function refreshOfficialGitMarketplace(
  marketplace: CodexMarketplaceList['marketplaces'][number],
  environment: NodeJS.ProcessEnv,
): void {
  const source = marketplace.marketplaceSource?.source;
  if (!isOfficialSafewordGitSource(source)) {
    throw new CodexMigrationError(
      'PLUGIN_MARKETPLACE_FAILED',
      `The configured Codex marketplace named safeword does not point to ${MARKETPLACE_SOURCE}; plugin installation did not run.`,
    );
  }
  const configured = configuredSafewordMarketplace(environment);
  const ref = configured?.ref;
  const pinnedVersion = ref === undefined ? undefined : exactVersionReference(ref);
  assertMarketplacePinIsNotNewer(ref, pinnedVersion);
  if (ref === 'main' || pinnedVersion !== undefined) {
    replaceCodexMarketplaceWithStable({ ...configured, source: configured?.source ?? source });
    return;
  }
  runCodexMarketplace(
    ['upgrade', 'safeword', '--json'],
    'Could not refresh the configured Safeword Codex marketplace',
  );
}

function refreshOrAddCodexMarketplace(
  marketplaceSource: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  if (marketplaceSource === undefined) {
    const output = runCodexMarketplace(
      ['list', '--json'],
      'Could not inspect configured Codex marketplaces',
    );
    const marketplace = marketplaceListFromOutput(output).marketplaces.find(
      candidate => candidate.name === 'safeword',
    );
    if (marketplace?.marketplaceSource?.sourceType === 'git') {
      refreshOfficialGitMarketplace(marketplace, environment);
      return;
    }
    if (marketplace !== undefined) {
      throw new CodexMigrationError(
        'PLUGIN_MARKETPLACE_FAILED',
        'The configured Codex marketplace named safeword is not a Git marketplace. Safeword left it unchanged because replacing an unknown marketplace type is not safely reversible.',
      );
    }
  }

  runCodexMarketplace(
    [
      'add',
      marketplaceSource ?? MARKETPLACE_SOURCE,
      ...(marketplaceSource === undefined ? ['--ref', 'stable'] : []),
      '--sparse',
      '.agents/plugins',
      '--sparse',
      'packages/cli/codex-plugin',
      '--json',
    ],
    'Could not add the Safeword Codex marketplace',
  );
}

function addCodexPluginToProfile(
  marketplaceSource: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  refreshOrAddCodexMarketplace(marketplaceSource, environment);
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
        : 'Could not verify the Safeword Codex plugin';
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
      'Codex did not report the Safeword plugin as enabled. Enable safeword@safeword, then re-run this command; project hooks were left unchanged.',
    );
  }
  if (plugin.version !== null && plugin.version !== SAFEWORD_SCHEMA.version) {
    throw new CodexMigrationError(
      'PLUGIN_ENABLEMENT_FAILED',
      `Codex reported Safeword plugin ${plugin.version}, but ${SAFEWORD_SCHEMA.version} is required. Re-run safeword install --agents=codex to update it; project hooks were left unchanged.`,
      { profileChanged: options.installationCompleted === true },
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
    activationRestartObserved: codexActivationRestartWasObserved(environment),
    activationRestartProven: codexActivationRestartIsProven(environment),
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
    plugin_installed_app_restart_required: CODEX_RESTART_CONTEXT,
    plugin_installed_hook_activation_failed: CODEX_HOOK_ACTIVATION_FAILED_CONTEXT,
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
  if (state === 'plugin_installed_hook_activation_failed' && proof !== undefined) {
    return `Codex restarted, but Safeword received no current lifecycle hook proof. Missing proof: ${proof.missing_events.join(', ')}. Safeword protection is unavailable in this Codex surface.`;
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
      ...result.next_actions.map(action =>
        'command' in action
          ? {
              command: action.command,
              mutates: action.mutates,
              requiresHuman: action.requires_human,
            }
          : {
              kind: action.kind,
              instruction: action.instruction,
              mutates: action.mutates,
              requiresHuman: action.requires_human,
            },
      ),
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
  const lock = acquireCodexProfileLock(options.environment);
  if (lock === undefined) {
    throw new CodexMigrationError(
      'PLUGIN_PROFILE_BUSY',
      'Another Safeword task is updating this Codex profile. No profile changes were made; retry `safeword codex install` in a moment.',
    );
  }
  try {
    run('bun', ['--version']);
    run('codex', ['--version']);
    addCodexPluginToProfile(options.marketplaceSource, options.environment);
    verifyCodexPluginIsEnabled({ installationCompleted: true });
    if (options.recordActivationPending !== false) writeCodexActivationMarker(options.environment);
  } finally {
    releaseCodexProfileLock(lock);
  }

  if (options.json !== true) {
    success('Safeword Codex plugin is enabled for this profile.');
    info(
      `This Codex app may keep its loaded Safeword catalogue. ${CODEX_REVIEW_THEN_RESTART_ACTION}. If this project uses Safeword legacy hooks, run \`safeword codex migrate --remove-legacy-hooks\` to remove only those hooks.`,
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
  let configBase: string | undefined;
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
    configBase = preparedLegacyHookRemoval.cleaned;
  }
  const configPath = nodePath.join(cwd, CODEX_CONFIG_PATH);
  const configMetadata = regularCodexConfigMetadata(configPath);
  const originalConfig = configMetadata.kind === 'missing' ? '' : readFileSync(configPath, 'utf8');
  const bootstrappedConfig = preparedCodexProjectBootstrap(cwd, configBase);
  if (bootstrappedConfig !== originalConfig) {
    mutations.push({ path: CODEX_CONFIG_PATH, content: bootstrappedConfig });
  }
  for (const path of observeLegacyAssets(cwd)) mutations.push({ path, content: null });
  mutations.push(
    {
      path: CODEX_MIGRATION_SCHEMA.paths.pluginMarker,
      content: `${JSON.stringify({ schema_version: 1, mode: 'plugin' })}\n`,
    },
    {
      path: CODEX_MIGRATION_SCHEMA.paths.bootstrapSkill,
      content: `---\nname: safeword-plugin-setup\ndescription: Restore the Safeword Codex profile plugin for this project.\n---\n\nRun \`safeword codex migrate\` to install or re-enable the profile plugin. ${CODEX_REVIEW_THEN_RESTART_ACTION}. Run \`safeword codex status\` to verify this project is protected.\n`,
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

export function uninstallCodexPlugin(): CliResult {
  try {
    if (!observeCodexPlugin().installed) {
      return createResult({
        state: 'healthy',
        data: { command: 'codex uninstall', plugin: PLUGIN_ID },
      });
    }
    run('codex', ['plugin', 'remove', PLUGIN_ID, '--json']);
    if (observeCodexPlugin().installed) {
      throw new Error(`Codex still reports ${PLUGIN_ID} after uninstall.`);
    }
    return createResult({
      state: 'changed',
      effects: {
        destructive: [{ kind: 'remove', target: PLUGIN_ID, operation: 'profile' }],
      },
      recovery: [
        {
          command: 'safeword install --agents=codex',
          description: 'Reinstall the Codex profile plugin if this removal must be reversed.',
          requiresHuman: true,
        },
      ],
      data: { command: 'codex uninstall', plugin: PLUGIN_ID },
    });
  } catch (error) {
    return createResult({
      state: 'failed',
      errors: [
        {
          code: 'CODEX_PLUGIN_UNINSTALL_FAILED',
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      ],
      recovery: [
        {
          command: 'safeword install --agents=codex',
          description: 'Repair or restore the Codex profile plugin.',
          requiresHuman: true,
        },
      ],
      data: { command: 'codex uninstall', plugin: PLUGIN_ID },
    });
  }
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
  else success('Safeword Codex migration is already finalized.');
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
      ? 'Removed Safeword legacy Codex project protection after the verified plugin handoff.'
      : 'No Safeword legacy Codex hooks were found in this project.',
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
    success('Safeword Codex plugin is enabled for this profile.');
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

export function automaticallyMigrateLegacyCodex(
  cwd = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  if (codexFinalizationIsComplete(cwd) || codexRecoveryIsRequired(cwd)) return false;
  const preparedLegacyHookRemoval = prepareLegacyHookRemoval(cwd);
  const hasLegacy = preparedLegacyHookRemoval !== undefined || observeLegacyAssets(cwd).length > 0;
  if (!hasLegacy) return false;

  installCodexPlugin({ cwd, environment, json: true, reportMigrationState: false });
  return true;
}

/**
 * Compatibility facade for the pre-`install --agents=codex` command shape. New
 * users should use `safeword install --agents=codex`; existing scripts retain
 * their behavior.
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
        ? 'Restored the backed-up Safeword legacy Codex project state.'
        : 'No Safeword Codex migration recovery was needed.',
    );
  }
  return changed;
}
