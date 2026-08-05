import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { type CliResult, createResult, type Effect } from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { compareVersions, isSafePackageVersion } from '../utils/version.js';

const MINIMUM_CLAUDE_VERSION = [2, 1, 170] as const;
const MARKETPLACE_NAME = 'safeword';
const PLUGIN_ID = 'safeword@safeword';
const MARKETPLACE_BASE = 'https://github.com/ArcadeAI/safeword.git';

export type ClaudePluginScope = 'project' | 'user';

export type JsonObject = Record<string, unknown>;

export type ClaudeProfileHealth =
  'current' | 'unsupported-host' | 'missing' | 'disabled' | 'wrong-version' | 'errored';

export interface ClaudeProfileObservation {
  readonly health: ClaudeProfileHealth;
  readonly plugin?: JsonObject;
  readonly message?: string;
  readonly nextAction?: string;
}

export interface ClaudeScopedInstallationObservation {
  readonly scope: ClaudePluginScope;
  readonly health: ClaudeProfileHealth;
  readonly plugin: JsonObject;
  readonly message?: string;
  readonly nextAction?: string;
}

export interface ClaudeApplicablePluginsObservation {
  readonly status: 'observed' | 'unsupported-host' | 'errored';
  readonly installations: readonly ClaudeScopedInstallationObservation[];
  readonly message?: string;
  readonly nextAction?: string;
}

class ClaudeProfileError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly effects: readonly Effect[] = [],
  ) {
    super(message);
  }
}

function runClaude(cwd: string, arguments_: readonly string[], effects: readonly Effect[]): string {
  const result = spawnSync('claude', arguments_, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim();
    const detailSuffix = detail === '' ? '' : ` (${detail})`;
    throw new ClaudeProfileError(
      'CLAUDE_PROFILE_COMMAND_FAILED',
      `Claude command failed: claude ${arguments_.join(' ')}${detailSuffix}`,
      effects,
    );
  }
  return result.stdout ?? '';
}

function parseJsonArray(output: string, command: string, effects: readonly Effect[]): JsonObject[] {
  try {
    const value = JSON.parse(output) as unknown;
    if (!Array.isArray(value) || value.some(entry => typeof entry !== 'object' || entry === null)) {
      throw new TypeError('expected a JSON array of objects');
    }
    return value as JsonObject[];
  } catch (error) {
    throw new ClaudeProfileError(
      'CLAUDE_PROFILE_OUTPUT_INVALID',
      `Claude returned invalid JSON for ${command}: ${error instanceof Error ? error.message : String(error)}`,
      effects,
    );
  }
}

function versionAtLeast(version: readonly number[], minimum: readonly number[]): boolean {
  for (const [index, minimumComponent] of minimum.entries()) {
    const component = version[index] ?? -1;
    if (component !== minimumComponent) return component > minimumComponent;
  }
  return true;
}

function assertSupportedHost(cwd: string): void {
  const output = runClaude(cwd, ['--version'], []);
  const match = /^(\d+)\.(\d+)\.(\d+)/u.exec(output.trim());
  if (match === null) {
    throw new ClaudeProfileError(
      'CLAUDE_VERSION_UNSUPPORTED',
      `Could not parse the Claude Code version. Version ${MINIMUM_CLAUDE_VERSION.join('.')} or newer is required.`,
    );
  }
  const version = match.slice(1).map(Number);
  if (!versionAtLeast(version, MINIMUM_CLAUDE_VERSION)) {
    throw new ClaudeProfileError(
      'CLAUDE_VERSION_UNSUPPORTED',
      `Claude Code ${MINIMUM_CLAUDE_VERSION.join('.')} or newer is required; found ${version.join('.')}.`,
    );
  }
}

function officialMarketplaceSource(): string {
  const ref = SAFEWORD_SCHEMA.version.includes('-') ? `v${SAFEWORD_SCHEMA.version}` : 'stable';
  return `${MARKETPLACE_BASE}#${ref}`;
}

function claudeConfigDirectory(): string {
  return process.env.CLAUDE_CONFIG_DIR ?? nodePath.join(homedir(), '.claude');
}

function canonicalDirectory(path: unknown): string | undefined {
  if (typeof path !== 'string' || path.trim() === '') return undefined;
  try {
    if (!statSync(path).isDirectory()) return undefined;
    return nodePath.normalize(realpathSync(path));
  } catch {
    return undefined;
  }
}

export function canonicalClaudeProjectRoot(cwd: string): string {
  const configuredRoot = process.env.CLAUDE_PROJECT_DIR;
  const environmentRoot = configuredRoot === undefined ? undefined : configuredRoot.trim();
  let candidate = environmentRoot === '' ? undefined : environmentRoot;
  if (candidate === undefined) {
    const result = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    });
    const gitRoot = result.status === 0 ? result.stdout?.trim() : undefined;
    candidate = gitRoot === '' || gitRoot === undefined ? cwd : gitRoot;
  }
  const canonical = canonicalDirectory(candidate);
  if (canonical === undefined) {
    throw new ClaudeProfileError(
      'CLAUDE_PROJECT_IDENTITY_INVALID',
      `Claude project root is missing, not a directory, or cannot be resolved: ${candidate}`,
    );
  }
  return canonical;
}

function scopedSettingsPath(cwd: string, scope: ClaudePluginScope): string {
  return scope === 'project'
    ? nodePath.join(cwd, '.claude/settings.json')
    : nodePath.join(claudeConfigDirectory(), 'settings.json');
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidScopeSettings(scope: ClaudePluginScope, message: string): never {
  throw new ClaudeProfileError('CLAUDE_SCOPE_SETTINGS_INVALID', `Claude ${scope}-scope ${message}`);
}

function readScopedSettings(cwd: string, scope: ClaudePluginScope): JsonObject | undefined {
  const path = scopedSettingsPath(cwd, scope);
  if (!existsSync(path)) return undefined;
  let settings: unknown;
  try {
    settings = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    invalidScopeSettings(
      scope,
      `settings are not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isJsonObject(settings)) invalidScopeSettings(scope, 'settings must be a JSON object.');
  return settings;
}

function scopedMarketplaceDeclaration(
  cwd: string,
  scope: ClaudePluginScope,
): JsonObject | undefined {
  const marketplaces = readScopedSettings(cwd, scope)?.extraKnownMarketplaces;
  if (marketplaces === undefined) return undefined;
  if (!isJsonObject(marketplaces)) {
    invalidScopeSettings(scope, 'marketplace declarations are malformed.');
  }
  const declaration = marketplaces[MARKETPLACE_NAME];
  if (declaration === undefined) return undefined;
  if (!isJsonObject(declaration)) {
    throw new ClaudeProfileError(
      'CLAUDE_MARKETPLACE_CONFLICT',
      `Claude ${scope}-scope marketplace ${MARKETPLACE_NAME} has malformed metadata.`,
    );
  }
  return declaration;
}

function marketplaceAutoUpdatePreference(
  declaration: JsonObject | undefined,
  scope: ClaudePluginScope,
): boolean | undefined {
  const preference = declaration?.autoUpdate;
  if (preference === undefined || typeof preference === 'boolean') return preference;
  invalidScopeSettings(scope, `marketplace ${MARKETPLACE_NAME} autoUpdate must be a boolean.`);
}

function marketplaceFailurePolicy(
  settings: JsonObject,
  scope: ClaudePluginScope,
): { configured: boolean; environment: JsonObject | undefined } {
  const environment = settings.env;
  if (environment !== undefined && !isJsonObject(environment)) {
    invalidScopeSettings(scope, 'environment declarations are malformed.');
  }
  return {
    environment,
    configured: environment?.CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE !== undefined,
  };
}

function recordMarketplaceSafetyEffects(
  effects: Effect[],
  scope: ClaudePluginScope,
  options: { autoUpdateEnabled: boolean; failurePolicyConfigured: boolean },
): void {
  if (!options.autoUpdateEnabled) {
    effects.push({
      kind: 'enable',
      target: `${MARKETPLACE_NAME} marketplace auto-update`,
      operation: scope,
    });
  }
  if (!options.failurePolicyConfigured) {
    effects.push({
      kind: 'enable',
      target: `${MARKETPLACE_NAME} last-known-good marketplace fallback`,
      operation: scope,
    });
  }
}

function enableMarketplaceAutoUpdate(
  cwd: string,
  scope: ClaudePluginScope,
  effects: Effect[],
): void {
  const path = scopedSettingsPath(cwd, scope);
  const metadata = lstatSync(path);
  if (!metadata.isFile()) {
    invalidScopeSettings(scope, `settings are not a regular file: ${path}`);
  }
  const settings = readScopedSettings(cwd, scope);
  const marketplaces = settings?.extraKnownMarketplaces;
  if (!isJsonObject(settings) || !isJsonObject(marketplaces)) {
    invalidScopeSettings(
      scope,
      `marketplace ${MARKETPLACE_NAME} was not persisted after installation.`,
    );
  }
  const declaration = marketplaces[MARKETPLACE_NAME];
  if (!isJsonObject(declaration)) {
    invalidScopeSettings(
      scope,
      `marketplace ${MARKETPLACE_NAME} was not persisted after installation.`,
    );
  }
  const failurePolicy = marketplaceFailurePolicy(settings, scope);
  const autoUpdateEnabled = marketplaceAutoUpdatePreference(declaration, scope) === true;
  if (autoUpdateEnabled && failurePolicy.configured) return;

  const updated = {
    ...settings,
    env: failurePolicy.configured
      ? failurePolicy.environment
      : {
          ...failurePolicy.environment,
          CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: '1',
        },
    extraKnownMarketplaces: {
      ...marketplaces,
      [MARKETPLACE_NAME]: { ...declaration, autoUpdate: true },
    },
  };
  writeDurableFile(path, `${JSON.stringify(updated, undefined, 2)}\n`, {
    mode: metadata.mode & 0o777,
  });
  recordMarketplaceSafetyEffects(effects, scope, {
    autoUpdateEnabled,
    failurePolicyConfigured: failurePolicy.configured,
  });
}

type MarketplaceSourceStatus = 'current' | 'stale' | 'conflict';

function marketplaceSource(entry: JsonObject): {
  readonly url: unknown;
  readonly ref: unknown;
  readonly kind: unknown;
} {
  const source =
    typeof entry.source === 'object' && entry.source !== null
      ? (entry.source as JsonObject)
      : entry;
  let url = source.url;
  let ref = source.ref;
  let kind = source.source;
  if (typeof entry.source === 'string' && url === undefined && ref === undefined) {
    const separator = entry.source.lastIndexOf('#');
    if (separator !== -1) {
      url = entry.source.slice(0, separator);
      ref = entry.source.slice(separator + 1);
      kind = undefined;
    }
  }
  return { url, ref, kind };
}

function marketplaceSourceStatus(entry: JsonObject): MarketplaceSourceStatus {
  const { url, ref, kind } = marketplaceSource(entry);
  if (url !== MARKETPLACE_BASE) return 'conflict';
  if (kind !== undefined && (typeof kind !== 'string' || !['url', 'git'].includes(kind))) {
    return 'conflict';
  }
  return marketplaceReferenceStatus(ref);
}

function marketplaceReferenceStatus(ref: unknown): MarketplaceSourceStatus {
  if (ref === 'stable') return 'current';
  if (typeof ref !== 'string' || !ref.startsWith('v')) return 'conflict';
  const version = ref.slice(1);
  if (!isSafePackageVersion(version)) return 'conflict';
  if (version === SAFEWORD_SCHEMA.version) {
    return SAFEWORD_SCHEMA.version.includes('-') ? 'current' : 'stale';
  }
  // Only the exact version being exercised by a prerelease build is trusted.
  // Historical marketplace refs must be canonical release tags: treating an
  // older prerelease or build-qualified tag as a normal upgrade source would
  // silently bless a channel that `stable` never promoted.
  if (version.includes('-') || version.includes('+')) return 'conflict';
  const comparison = compareVersions(version, SAFEWORD_SCHEMA.version);
  return comparison < 0 ? 'stale' : 'conflict';
}

function marketplaceEntries(cwd: string, effects: readonly Effect[]): JsonObject[] {
  return parseJsonArray(
    runClaude(cwd, ['plugin', 'marketplace', 'list', '--json'], effects),
    'plugin marketplace list --json',
    effects,
  );
}

function pluginEntries(cwd: string, effects: readonly Effect[]): JsonObject[] {
  return parseJsonArray(
    runClaude(cwd, ['plugin', 'list', '--json'], effects),
    'plugin list --json',
    effects,
  );
}

function entryMatchesScope(entry: JsonObject, scope: ClaudePluginScope, cwd: string): boolean {
  if ((entry.scope ?? 'user') !== scope) return false;
  return scope === 'user' || canonicalDirectory(entry.projectPath) === cwd;
}

function safewordMarketplace(entries: readonly JsonObject[]): JsonObject | undefined {
  return entries.find(entry => entry.name === MARKETPLACE_NAME);
}

function safewordPlugin(
  entries: readonly JsonObject[],
  scope: ClaudePluginScope,
  cwd: string,
): JsonObject | undefined {
  return entries.find(entry => entry.id === PLUGIN_ID && entryMatchesScope(entry, scope, cwd));
}

function applicableSafewordPlugins(entries: readonly JsonObject[], cwd: string): JsonObject[] {
  return entries.filter(
    entry =>
      entry.id === PLUGIN_ID &&
      (entry.scope === 'user' ||
        (entry.scope === 'project' && canonicalDirectory(entry.projectPath) === cwd)),
  );
}

function failedResult(error: unknown, scope: ClaudePluginScope): CliResult {
  let failure: ClaudeProfileError;
  if (error instanceof ClaudeProfileError) failure = error;
  else {
    const message = error instanceof Error ? error.message : String(error);
    failure = new ClaudeProfileError('CLAUDE_PLUGIN_INSTALL_FAILED', message);
  }
  let classification = 'errored';
  let nextAction = 'safeword claude install';
  let nextActionMutates = true;
  switch (failure.code) {
    case 'CLAUDE_VERSION_UNSUPPORTED': {
      classification = 'unsupported-host';
      nextAction = 'claude update';
      break;
    }
    case 'CLAUDE_MARKETPLACE_CONFLICT': {
      classification = 'marketplace-conflict';
      nextAction = `claude plugin marketplace add ${officialMarketplaceSource()} --scope ${scope}`;
      break;
    }
    case 'CLAUDE_AUTO_UPDATE_DISABLED': {
      classification = 'auto-update-disabled';
      nextAction = `claude plugin marketplace add ${officialMarketplaceSource()} --scope ${scope}`;
      break;
    }
    case 'CLAUDE_PLUGIN_METADATA_UNVERIFIED': {
      classification = 'unverified-metadata';
      nextAction = 'claude plugin list --json';
      nextActionMutates = false;
      break;
    }
    case 'CLAUDE_PLUGIN_DOWNGRADE_REFUSED': {
      classification = 'downgrade-refused';
      nextAction = 'claude plugin list --json';
      nextActionMutates = false;
      break;
    }
    case 'CLAUDE_PLUGIN_POSTCONDITION_UNVERIFIED': {
      classification = 'postcondition-verification-failed';
      nextAction = 'claude plugin list --json';
      nextActionMutates = false;
      break;
    }
  }
  return createResult({
    state: 'failed',
    changed: failure.effects.length > 0,
    effects: { configuration: failure.effects },
    errors: [{ code: failure.code, message: failure.message, retryable: true }],
    nextActions: [
      {
        command: nextAction,
        mutates: nextActionMutates,
        requiresHuman: true,
      },
    ],
    data: { command: 'claude install', classification },
  });
}

interface MarketplaceObservation {
  readonly declaration?: JsonObject;
  readonly declarationStatus?: MarketplaceSourceStatus;
  readonly shared?: JsonObject;
  readonly sharedStatus?: MarketplaceSourceStatus;
}

function observeMarketplace(
  cwd: string,
  scope: ClaudePluginScope,
  effects: readonly Effect[],
): MarketplaceObservation {
  const declaration = scopedMarketplaceDeclaration(cwd, scope);
  const shared = safewordMarketplace(marketplaceEntries(cwd, effects));
  return {
    declaration,
    declarationStatus: declaration === undefined ? undefined : marketplaceSourceStatus(declaration),
    shared,
    sharedStatus: shared === undefined ? undefined : marketplaceSourceStatus(shared),
  };
}

function assertTrustedMarketplace(observation: MarketplaceObservation): void {
  if (observation.declarationStatus === 'conflict' || observation.sharedStatus === 'conflict') {
    throw new ClaudeProfileError(
      'CLAUDE_MARKETPLACE_CONFLICT',
      `Claude marketplace ${MARKETPLACE_NAME} has an untrusted source or version; expected ${officialMarketplaceSource()} or an older valid tag from the same repository.`,
    );
  }
}

function marketplaceIsCurrent(observation: MarketplaceObservation): boolean {
  return observation.declarationStatus === 'current' && observation.sharedStatus === 'current';
}

function marketplaceEffectKind(observation: MarketplaceObservation): 'add' | 'update' {
  return observation.declarationStatus === 'stale' || observation.sharedStatus === 'stale'
    ? 'update'
    : 'add';
}

function ensureMarketplace(cwd: string, scope: ClaudePluginScope, effects: Effect[]): void {
  const before = observeMarketplace(cwd, scope, effects);
  assertTrustedMarketplace(before);
  const autoUpdatePreference = marketplaceAutoUpdatePreference(before.declaration, scope);
  if (marketplaceIsCurrent(before)) {
    if (autoUpdatePreference !== false) enableMarketplaceAutoUpdate(cwd, scope, effects);
    return;
  }
  if (autoUpdatePreference === false) {
    throw new ClaudeProfileError(
      'CLAUDE_AUTO_UPDATE_DISABLED',
      `Claude ${scope}-scope marketplace auto-update is explicitly disabled; Safeword left the marketplace declaration unchanged.`,
    );
  }
  runClaude(
    cwd,
    ['plugin', 'marketplace', 'add', officialMarketplaceSource(), '--scope', scope],
    effects,
  );
  effects.push({
    kind: marketplaceEffectKind(before),
    target: MARKETPLACE_NAME,
    operation: scope,
  });
  if (!marketplaceIsCurrent(observeMarketplace(cwd, scope, effects))) {
    throw new ClaudeProfileError(
      'CLAUDE_MARKETPLACE_UNVERIFIED',
      'Claude did not report the exact official Safeword marketplace after adding it.',
      effects,
    );
  }
  enableMarketplaceAutoUpdate(cwd, scope, effects);
}

function assertConvergeablePluginVersion(plugin: JsonObject): void {
  if (typeof plugin.version !== 'string' || !isSafePackageVersion(plugin.version)) {
    throw new ClaudeProfileError(
      'CLAUDE_PLUGIN_METADATA_UNVERIFIED',
      `Claude reported malformed ${PLUGIN_ID} version metadata in the selected scope.`,
    );
  }
  if (compareVersions(plugin.version, SAFEWORD_SCHEMA.version) > 0) {
    throw new ClaudeProfileError(
      'CLAUDE_PLUGIN_DOWNGRADE_REFUSED',
      `Claude reported ${PLUGIN_ID} ${plugin.version}, which is newer than ${SAFEWORD_SCHEMA.version}; refusing an implicit downgrade.`,
    );
  }
}

function convergePlugin(cwd: string, scope: ClaudePluginScope, effects: Effect[]): void {
  const plugin = safewordPlugin(pluginEntries(cwd, effects), scope, cwd);
  if (plugin === undefined) {
    runClaude(cwd, ['plugin', 'install', PLUGIN_ID, '--scope', scope], effects);
    effects.push({ kind: 'install', target: PLUGIN_ID, operation: scope });
  } else {
    assertConvergeablePluginVersion(plugin);
    if (plugin.version !== SAFEWORD_SCHEMA.version) {
      runClaude(cwd, ['plugin', 'update', PLUGIN_ID, '--scope', scope], effects);
      effects.push({ kind: 'update', target: PLUGIN_ID, operation: scope });
    } else if (plugin.enabled !== true) {
      runClaude(cwd, ['plugin', 'enable', PLUGIN_ID, '--scope', scope], effects);
      effects.push({ kind: 'enable', target: PLUGIN_ID, operation: scope });
    }
  }
}

function fileSha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function assertInstalledAsset(installPath: string, asset: JsonObject): void {
  if (
    typeof asset.path !== 'string' ||
    nodePath.isAbsolute(asset.path) ||
    asset.path.split(nodePath.sep).includes('..') ||
    typeof asset.sha256 !== 'string'
  ) {
    throw new TypeError('installed inventory contains an unsafe asset');
  }
  const path = nodePath.join(installPath, asset.path);
  if (!lstatSync(path).isFile() || fileSha256(path) !== asset.sha256) {
    throw new TypeError(`installed asset failed integrity validation: ${asset.path}`);
  }
}

function assertInstalledIdentity(
  identity: JsonObject,
  inventory: JsonObject,
  inventoryContent: string,
): asserts inventory is JsonObject & { assets: JsonObject[] } {
  if (
    identity.schema_version !== 1 ||
    identity.plugin_version !== SAFEWORD_SCHEMA.version ||
    identity.inventory_sha256 !== createHash('sha256').update(inventoryContent).digest('hex') ||
    inventory.schema_version !== 1 ||
    !Array.isArray(inventory.assets)
  ) {
    throw new TypeError('installed identity or inventory is inconsistent');
  }
}

function assertRequiredNativeAssets(assets: readonly JsonObject[]): void {
  const paths = new Set(assets.map(asset => asset.path));
  for (const required of [
    'hooks/hooks.json',
    'runtime/cli.js',
    'runtime/dispatch.ts',
    'runtime/event-groups.json',
  ]) {
    if (!paths.has(required)) throw new TypeError(`installed native asset is missing: ${required}`);
  }
}

function validateNativePayload(plugin: JsonObject): void {
  if (typeof plugin.installPath !== 'string' || !lstatSync(plugin.installPath).isDirectory()) {
    throw new TypeError('installed plugin path is missing');
  }
  const identityPath = nodePath.join(plugin.installPath, 'identity.json');
  const inventoryPath = nodePath.join(plugin.installPath, 'inventory.json');
  const identity = JSON.parse(readFileSync(identityPath, 'utf8')) as JsonObject;
  const inventoryContent = readFileSync(inventoryPath, 'utf8');
  const inventory = JSON.parse(inventoryContent) as JsonObject;
  assertInstalledIdentity(identity, inventory, inventoryContent);
  assertRequiredNativeAssets(inventory.assets);
  for (const asset of inventory.assets) assertInstalledAsset(plugin.installPath, asset);
  const hookManifest = nodePath.join(plugin.installPath, 'hooks/hooks.json');
  if (identity.hook_manifest_sha256 !== fileSha256(hookManifest)) {
    throw new TypeError('installed hook manifest does not match its identity');
  }
}

/** Read-only profile observation used by `safeword claude status`. */
export function observeApplicableClaudePlugins(cwd: string): ClaudeApplicablePluginsObservation {
  let projectRoot: string;
  try {
    projectRoot = canonicalClaudeProjectRoot(cwd);
  } catch (error) {
    return {
      status: 'errored',
      installations: [],
      message: error instanceof Error ? error.message : String(error),
      nextAction: 'repair the reported Claude project path',
    };
  }
  try {
    assertSupportedHost(projectRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: 'unsupported-host',
      installations: [],
      message,
      nextAction: message.startsWith('Could not parse')
        ? 'reinstall Claude Code'
        : 'update Claude Code',
    };
  }

  let plugins: JsonObject[];
  try {
    plugins = applicableSafewordPlugins(pluginEntries(projectRoot, []), projectRoot);
  } catch (error) {
    return {
      status: 'errored',
      installations: [],
      message: error instanceof Error ? error.message : String(error),
      nextAction: 'repair the reported Claude plugin error',
    };
  }
  return {
    status: 'observed',
    installations: plugins.map(plugin => ({
      scope: plugin.scope as ClaudePluginScope,
      plugin,
      ...observeInstalledPlugin(plugin),
    })),
  };
}

/** Backward-compatible single-installation view used by the legacy status flow. */
export function observeClaudeProfile(cwd: string): ClaudeProfileObservation {
  const observation = observeApplicableClaudePlugins(cwd);
  if (observation.status !== 'observed') {
    return {
      health: observation.status,
      message: observation.message,
      nextAction: observation.nextAction,
    };
  }
  const installation =
    observation.installations.find(candidate => candidate.scope === 'project') ??
    observation.installations.find(candidate => candidate.scope === 'user');
  return installation ?? { health: 'missing' };
}

function observeInstalledPlugin(plugin: JsonObject | undefined): ClaudeProfileObservation {
  if (plugin === undefined) return { health: 'missing' };
  if (plugin.version !== SAFEWORD_SCHEMA.version) return { health: 'wrong-version', plugin };
  if (plugin.enabled !== true) return { health: 'disabled', plugin };
  try {
    validateNativePayload(plugin);
  } catch (error) {
    return {
      health: 'errored',
      plugin,
      message: `Installed native payload is unhealthy: ${error instanceof Error ? error.message : String(error)}`,
      nextAction: 'repair the reported Claude plugin error',
    };
  }
  return { health: 'current', plugin };
}

function assertNativePayload(plugin: JsonObject, effects: readonly Effect[]): void {
  try {
    validateNativePayload(plugin);
  } catch (error) {
    throw new ClaudeProfileError(
      'CLAUDE_PLUGIN_PAYLOAD_UNVERIFIED',
      `Claude installed plugin metadata, but its native payload could not be verified: ${error instanceof Error ? error.message : String(error)}`,
      effects,
    );
  }
}

function verifyPlugin(
  cwd: string,
  scope: ClaudePluginScope,
  effects: readonly Effect[],
): JsonObject[] {
  let entries: JsonObject[];
  try {
    entries = pluginEntries(cwd, effects);
  } catch (error) {
    throw new ClaudeProfileError(
      'CLAUDE_PLUGIN_POSTCONDITION_UNVERIFIED',
      `Claude completed the selected-scope mutations, but the final plugin state could not be observed: ${error instanceof Error ? error.message : String(error)}`,
      effects,
    );
  }
  const plugin = safewordPlugin(entries, scope, cwd);
  if (
    plugin?.version === SAFEWORD_SCHEMA.version &&
    plugin.enabled === true &&
    plugin.scope === scope
  ) {
    assertNativePayload(plugin, effects);
    return entries;
  }
  throw new ClaudeProfileError(
    'CLAUDE_PLUGIN_UNVERIFIED',
    `Claude did not report ${PLUGIN_ID} ${SAFEWORD_SCHEMA.version} as enabled at ${scope} scope.`,
    effects,
  );
}

export function installClaudePlugin(cwd: string, scope: ClaudePluginScope = 'project'): CliResult {
  const effects: Effect[] = [];
  try {
    const projectRoot = canonicalClaudeProjectRoot(cwd);
    assertSupportedHost(projectRoot);
    ensureMarketplace(projectRoot, scope, effects);
    convergePlugin(projectRoot, scope, effects);
    const plugins = verifyPlugin(projectRoot, scope, effects);
    const overlap = applicableSafewordPlugins(plugins, projectRoot).length > 1;

    return createResult({
      state: effects.length === 0 ? 'healthy' : 'changed',
      effects: {
        configuration: effects,
        network: effects.map(effect => ({ ...effect, target: 'Claude plugin marketplace' })),
      },
      nextActions: [{ command: '/reload-plugins', mutates: false, requiresHuman: true }],
      data: {
        command: 'claude install',
        plugin: PLUGIN_ID,
        version: SAFEWORD_SCHEMA.version,
        scope,
        ...(overlap && { classification: 'scope-overlap' }),
      },
    });
  } catch (error) {
    return failedResult(error, scope);
  }
}
