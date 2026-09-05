import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { applyEdits, modify, parse, type ParseError } from 'jsonc-parser';

import { type CliResult, createResult, type Effect } from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { canonicalDirectory } from '../utils/fs.js';
import { compareVersions, isSafePackageVersion } from '../utils/version.js';
import { VERSION } from '../version.js';
import {
  CLAUDE_NATIVE_METADATA_FILES,
  CLAUDE_NATIVE_REQUIRED_ASSETS,
  CLAUDE_PLUGIN_ID,
  claudeNativePayloadFiles,
} from './inventory.js';
import { claudeConfigDirectory } from './plugin-data.js';
import { canonicalClaudeProjectRoot } from './project-root.js';

const MINIMUM_CLAUDE_VERSION = [2, 1, 170] as const;
const CLAUDE_COMMAND_TIMEOUT_MS = 30_000;
const MAXIMUM_CLAUDE_OUTPUT_BYTES = 10 * 1024 * 1024;
const MARKETPLACE_NAME = 'safeword';
const MARKETPLACE_BASE = 'https://github.com/ArcadeAI/safeword.git';
const MARKETPLACE_REPO = 'ArcadeAI/safeword';

export type ClaudePluginScope = 'project' | 'user';

export type JsonObject = Record<string, unknown>;

type ClaudeProfileHealth =
  'current' | 'unsupported-host' | 'missing' | 'disabled' | 'wrong-version' | 'errored';

interface ClaudeProfileObservation {
  readonly health: ClaudeProfileHealth;
  readonly plugin?: JsonObject;
  readonly message?: string;
  readonly nextAction?: string;
}

interface ClaudeScopedInstallationObservation {
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
  const outputDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-output-'));
  const outputPath = nodePath.join(outputDirectory, 'stdout');
  const outputDescriptor = openSync(outputPath, 'w');
  let outputOpen = true;

  try {
    const result = spawnSync('claude', arguments_, {
      cwd,
      encoding: 'utf8',
      maxBuffer: MAXIMUM_CLAUDE_OUTPUT_BYTES,
      stdio: ['ignore', outputDescriptor, 'pipe'],
      timeout: CLAUDE_COMMAND_TIMEOUT_MS,
    });
    closeSync(outputDescriptor);
    outputOpen = false;

    if (result.error !== undefined) {
      const errorCode = (result.error as NodeJS.ErrnoException).code;
      if (errorCode === 'ENOBUFS') {
        throw new ClaudeProfileError(
          'CLAUDE_PROFILE_OUTPUT_TOO_LARGE',
          `Claude command output exceeded ${MAXIMUM_CLAUDE_OUTPUT_BYTES} bytes: claude ${arguments_.join(' ')}`,
          effects,
        );
      }
      if (errorCode !== 'ENOENT') {
        throw new ClaudeProfileError(
          'CLAUDE_PROFILE_COMMAND_FAILED',
          `Claude command could not complete: claude ${arguments_.join(' ')} (${result.error.message})`,
          effects,
        );
      }
      throw new ClaudeProfileError(
        'CLAUDE_HOST_UNAVAILABLE',
        `Claude Code could not be started: ${result.error.message}`,
        effects,
      );
    }
    const outputBytes = statSync(outputPath).size;
    if (outputBytes > MAXIMUM_CLAUDE_OUTPUT_BYTES) {
      throw new ClaudeProfileError(
        'CLAUDE_PROFILE_OUTPUT_TOO_LARGE',
        `Claude command output exceeded ${MAXIMUM_CLAUDE_OUTPUT_BYTES} bytes: claude ${arguments_.join(' ')}`,
        effects,
      );
    }
    const output = readFileSync(outputPath, 'utf8');
    if (result.status !== 0) {
      const detail = `${result.stderr ?? ''}${output}`.trim();
      const detailSuffix = detail === '' ? '' : ` (${detail})`;
      throw new ClaudeProfileError(
        'CLAUDE_PROFILE_COMMAND_FAILED',
        `Claude command failed: claude ${arguments_.join(' ')}${detailSuffix}`,
        effects,
      );
    }
    return output;
  } finally {
    if (outputOpen) closeSync(outputDescriptor);
    rmSync(outputDirectory, { recursive: true, force: true });
  }
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
  const ref = VERSION.includes('-') ? `v${VERSION}` : 'stable';
  return `${MARKETPLACE_BASE}#${ref}`;
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
    const errors: ParseError[] = [];
    settings = parse(readFileSync(path, 'utf8'), errors, {
      allowTrailingComma: true,
      disallowComments: false,
    }) as unknown;
    if (errors.length > 0) throw new SyntaxError(`parse error at offset ${errors[0]?.offset ?? 0}`);
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

  let updated = readFileSync(path, 'utf8');
  if (!autoUpdateEnabled) {
    updated = applyEdits(
      updated,
      modify(updated, ['extraKnownMarketplaces', MARKETPLACE_NAME, 'autoUpdate'], true, {}),
    );
  }
  if (!failurePolicy.configured) {
    updated = applyEdits(
      updated,
      modify(updated, ['env', 'CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE'], '1', {}),
    );
  }
  writeDurableFile(path, updated, {
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
  return { url: url ?? gitHubShorthandUrl(kind, source.repo), ref, kind };
}

/**
 * `claude plugin marketplace add ArcadeAI/safeword` — the form the Claude Code
 * docs lead with — registers a GitHub shorthand source carrying a `repo` and
 * neither a URL nor a ref. Resolve it to the repository it names so the
 * same-repository comparison recognises it. The absent ref still leaves it
 * unpinned, which marketplaceReferenceStatus reports as repairable rather than
 * untrusted (issue #3338).
 */
function gitHubShorthandUrl(kind: unknown, repo: unknown): unknown {
  if (kind !== 'github' || typeof repo !== 'string') return undefined;
  return repo.toLowerCase() === MARKETPLACE_REPO.toLowerCase() ? MARKETPLACE_BASE : repo;
}

function marketplaceSourceStatus(entry: JsonObject): MarketplaceSourceStatus {
  const { url, ref, kind } = marketplaceSource(entry);
  if (url !== MARKETPLACE_BASE) return 'conflict';
  if (
    kind !== undefined &&
    (typeof kind !== 'string' || !['url', 'git', 'github'].includes(kind))
  ) {
    return 'conflict';
  }
  return marketplaceReferenceStatus(ref);
}

function marketplaceReferenceStatus(ref: unknown): MarketplaceSourceStatus {
  if (ref === 'stable') return 'current';
  // Same repository, no pinned ref: the registration tracks a default branch
  // rather than a promoted tag. That is a reason to re-add the canonical pinned
  // source, not to refuse the install and strand the project (issue #3338).
  if (ref === undefined) return 'stale';
  if (typeof ref !== 'string' || !ref.startsWith('v')) return 'conflict';
  return marketplaceTagStatus(ref.slice(1));
}

function marketplaceTagStatus(version: string): MarketplaceSourceStatus {
  if (!isSafePackageVersion(version)) return 'conflict';
  if (version === VERSION) {
    return VERSION.includes('-') ? 'current' : 'stale';
  }
  // Only the exact version being exercised by a prerelease build is trusted.
  // Historical marketplace refs must be canonical release tags: treating an
  // older prerelease or build-qualified tag as a normal upgrade source would
  // silently bless a channel that `stable` never promoted.
  if (version.includes('-') || version.includes('+')) return 'conflict';
  const comparison = compareVersions(version, VERSION);
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

function pluginScope(entry: JsonObject): ClaudePluginScope | undefined {
  const scope = entry.scope ?? 'user';
  return scope === 'project' || scope === 'user' ? scope : undefined;
}

function entryMatchesScope(entry: JsonObject, scope: ClaudePluginScope, cwd: string): boolean {
  if (pluginScope(entry) !== scope) return false;
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
  return entries.find(
    entry => entry.id === CLAUDE_PLUGIN_ID && entryMatchesScope(entry, scope, cwd),
  );
}

function applicableSafewordPlugins(entries: readonly JsonObject[], cwd: string): JsonObject[] {
  return entries.filter(entry => {
    const scope = pluginScope(entry);
    return (
      entry.id === CLAUDE_PLUGIN_ID &&
      (scope === 'user' || (scope === 'project' && canonicalDirectory(entry.projectPath) === cwd))
    );
  });
}

const DIAGNOSTIC_FAILURES: Readonly<
  Record<string, { classification: string; nextAction: string }>
> = {
  CLAUDE_MARKETPLACE_UNVERIFIED: {
    classification: 'marketplace-unverified',
    nextAction: 'claude plugin marketplace list --json',
  },
  CLAUDE_PLUGIN_METADATA_UNVERIFIED: {
    classification: 'unverified-metadata',
    nextAction: 'claude plugin list --json',
  },
  CLAUDE_PLUGIN_DOWNGRADE_REFUSED: {
    classification: 'downgrade-refused',
    nextAction: 'claude plugin list --json',
  },
  CLAUDE_PLUGIN_POSTCONDITION_UNVERIFIED: {
    classification: 'postcondition-verification-failed',
    nextAction: 'claude plugin list --json',
  },
  CLAUDE_PLUGIN_PAYLOAD_UNVERIFIED: {
    classification: 'payload-unverified',
    nextAction: 'safeword claude status',
  },
};

function failedResult(error: unknown, scope: ClaudePluginScope): CliResult {
  let failure: ClaudeProfileError;
  if (error instanceof ClaudeProfileError) failure = error;
  else {
    const message = error instanceof Error ? error.message : String(error);
    failure = new ClaudeProfileError('CLAUDE_PLUGIN_INSTALL_FAILED', message);
  }
  let classification = 'errored';
  let nextAction = 'safeword install --agents=claude';
  let nextActionMutates = true;
  const diagnostic = DIAGNOSTIC_FAILURES[failure.code];
  if (diagnostic !== undefined) {
    classification = diagnostic.classification;
    nextAction = diagnostic.nextAction;
    nextActionMutates = false;
  }
  switch (failure.code) {
    case 'CLAUDE_VERSION_UNSUPPORTED': {
      classification = 'unsupported-host';
      nextAction = 'claude update';
      break;
    }
    case 'CLAUDE_HOST_UNAVAILABLE': {
      classification = 'host-unavailable';
      nextAction = 'claude --version';
      nextActionMutates = false;
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

function describeMarketplaceSource(entry: JsonObject | undefined): string | undefined {
  if (entry === undefined) return undefined;
  const { url, ref } = marketplaceSource(entry);
  if (typeof url !== 'string') return undefined;
  return typeof ref === 'string' ? `${url}#${ref}` : url;
}

function assertTrustedMarketplace(observation: MarketplaceObservation): void {
  if (observation.declarationStatus !== 'conflict' && observation.sharedStatus !== 'conflict') {
    return;
  }
  // Name the offending registration: the untrusted source usually lives in a
  // different scope than the one being installed, so "expected X" alone does not
  // say which entry to repair.
  const offending = describeMarketplaceSource(
    observation.declarationStatus === 'conflict' ? observation.declaration : observation.shared,
  );
  const found = offending === undefined ? '' : ` Found ${offending}.`;
  throw new ClaudeProfileError(
    'CLAUDE_MARKETPLACE_CONFLICT',
    `Claude marketplace ${MARKETPLACE_NAME} has an untrusted source or version; expected ${officialMarketplaceSource()} or an older valid tag from the same repository.${found} Safeword changed nothing.`,
  );
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
      `Claude reported malformed ${CLAUDE_PLUGIN_ID} version metadata in the selected scope.`,
    );
  }
  if (compareVersions(plugin.version, VERSION) > 0) {
    throw new ClaudeProfileError(
      'CLAUDE_PLUGIN_DOWNGRADE_REFUSED',
      `Claude reported ${CLAUDE_PLUGIN_ID} ${plugin.version}, which is newer than ${VERSION}; refusing an implicit downgrade.`,
    );
  }
}

function convergePlugin(cwd: string, scope: ClaudePluginScope, effects: Effect[]): void {
  const plugin = safewordPlugin(pluginEntries(cwd, effects), scope, cwd);
  if (plugin === undefined) {
    runClaude(cwd, ['plugin', 'install', CLAUDE_PLUGIN_ID, '--scope', scope], effects);
    effects.push({ kind: 'install', target: CLAUDE_PLUGIN_ID, operation: scope });
  } else {
    assertConvergeablePluginVersion(plugin);
    if (plugin.version !== VERSION) {
      runClaude(cwd, ['plugin', 'update', CLAUDE_PLUGIN_ID, '--scope', scope], effects);
      effects.push({ kind: 'update', target: CLAUDE_PLUGIN_ID, operation: scope });
    }
    // Independent conditions on purpose: a plugin that is BOTH outdated and
    // disabled needs updating AND re-enabling. Chaining these with `else`
    // updates it and leaves it disabled.
    if (plugin.enabled !== true) {
      runClaude(cwd, ['plugin', 'enable', CLAUDE_PLUGIN_ID, '--scope', scope], effects);
      effects.push({ kind: 'enable', target: CLAUDE_PLUGIN_ID, operation: scope });
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
    asset.path.split(/[\\/]/u).includes('..') ||
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
    identity.plugin_version !== VERSION ||
    identity.inventory_sha256 !== createHash('sha256').update(inventoryContent).digest('hex') ||
    inventory.schema_version !== 1 ||
    !Array.isArray(inventory.assets)
  ) {
    throw new TypeError('installed identity or inventory is inconsistent');
  }
}

function assertRequiredNativeAssets(assets: readonly JsonObject[]): void {
  const paths = new Set(assets.map(asset => asset.path));
  for (const required of CLAUDE_NATIVE_REQUIRED_ASSETS) {
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
  const expectedPaths = new Set([
    ...inventory.assets.map(asset => asset.path as string),
    ...CLAUDE_NATIVE_METADATA_FILES,
  ]);
  const unexpectedPath = claudeNativePayloadFiles(plugin.installPath).find(
    path => !expectedPaths.has(path),
  );
  if (unexpectedPath !== undefined) {
    throw new TypeError(`installed native payload contains an unlisted asset: ${unexpectedPath}`);
  }
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
    if (!isUnsupportedHostError(error)) {
      return {
        status: 'errored',
        installations: [],
        message,
        nextAction: 'repair the reported Claude host error',
      };
    }
    return {
      status: 'unsupported-host',
      installations: [],
      message,
      nextAction: unsupportedHostNextAction(error, message),
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
      scope: pluginScope(plugin) ?? 'user',
      plugin,
      ...observeInstalledPlugin(plugin),
    })),
  };
}

/** Backward-compatible single-installation view used by the legacy status flow. */
function observeInstalledPlugin(plugin: JsonObject | undefined): ClaudeProfileObservation {
  if (plugin === undefined) return { health: 'missing' };
  if (plugin.version !== VERSION) return { health: 'wrong-version', plugin };
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

function unsupportedHostNextAction(error: unknown, message: string): string {
  if (error instanceof ClaudeProfileError && error.code === 'CLAUDE_HOST_UNAVAILABLE') {
    return 'install Claude Code';
  }
  return message.startsWith('Could not parse') ? 'reinstall Claude Code' : 'update Claude Code';
}

function isUnsupportedHostError(error: unknown): boolean {
  return (
    error instanceof ClaudeProfileError &&
    ['CLAUDE_HOST_UNAVAILABLE', 'CLAUDE_VERSION_UNSUPPORTED'].includes(error.code)
  );
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
  if (plugin?.version === VERSION && plugin.enabled === true && pluginScope(plugin) === scope) {
    assertNativePayload(plugin, effects);
    return entries;
  }
  throw new ClaudeProfileError(
    'CLAUDE_PLUGIN_UNVERIFIED',
    `Claude did not report ${CLAUDE_PLUGIN_ID} ${VERSION} as enabled at ${scope} scope.`,
    effects,
  );
}

/**
 * The Claude installation that applies to this project: a project-scoped one
 * when present, otherwise a user-scoped one. Used by lifecycle preconditions.
 */
export function observeClaudeProfile(
  cwd: string,
  scope?: ClaudePluginScope,
): ClaudeProfileObservation {
  const observation = observeApplicableClaudePlugins(cwd);
  if (observation.status !== 'observed') {
    return {
      health: observation.status,
      message: observation.message,
      nextAction: observation.nextAction,
    };
  }
  const installation =
    scope === undefined
      ? (observation.installations.find(candidate => candidate.scope === 'project') ??
        observation.installations.find(candidate => candidate.scope === 'user'))
      : observation.installations.find(candidate => candidate.scope === scope);
  return installation ?? { health: 'missing' };
}

export function claudeInstallRequiresMutation(cwd: string, scope: ClaudePluginScope): boolean {
  try {
    if (observeClaudeProfile(cwd, scope).health !== 'current') return true;
    const marketplace = observeMarketplace(cwd, scope, []);
    if (!marketplaceIsCurrent(marketplace)) return true;
    const settings = readScopedSettings(cwd, scope);
    const declaration = marketplace.declaration;
    if (!isJsonObject(settings) || declaration === undefined) return true;
    const autoUpdatePreference = marketplaceAutoUpdatePreference(declaration, scope);
    if (autoUpdatePreference === false) return false;
    const failurePolicy = marketplaceFailurePolicy(settings, scope);
    return autoUpdatePreference !== true || !failurePolicy.configured;
  } catch {
    // Planning must remain conservative when the host or settings cannot be
    // observed: the real install may still need marketplace/profile effects.
    return true;
  }
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
      state: effects.length === 0 ? 'healthy' : 'action_required',
      changed: effects.length > 0,
      effects: {
        configuration: effects,
        network: effects
          .filter(
            effect =>
              (effect.target === MARKETPLACE_NAME && ['add', 'update'].includes(effect.kind)) ||
              (effect.target === CLAUDE_PLUGIN_ID && ['install', 'update'].includes(effect.kind)),
          )
          .map(effect => ({ ...effect, target: 'Claude plugin marketplace' })),
      },
      nextActions:
        effects.length === 0
          ? []
          : [{ command: '/reload-plugins', mutates: false, requiresHuman: true }],
      data: {
        command: 'claude install',
        plugin: CLAUDE_PLUGIN_ID,
        version: VERSION,
        scope,
        ...(overlap && { classification: 'scope-overlap' }),
      },
    });
  } catch (error) {
    return failedResult(error, scope);
  }
}

export function uninstallClaudePlugin(
  cwd: string,
  scope: ClaudePluginScope = 'project',
): CliResult {
  const effects: Effect[] = [];
  try {
    // Project-scope matching compares a realpath'd projectPath, so resolve the
    // same canonical root install used before looking the plugin up.
    const projectRoot = canonicalClaudeProjectRoot(cwd);
    assertSupportedHost(projectRoot);
    if (safewordPlugin(pluginEntries(projectRoot, effects), scope, projectRoot) === undefined) {
      return createResult({
        state: 'healthy',
        data: { command: 'claude uninstall', plugin: CLAUDE_PLUGIN_ID, scope },
      });
    }
    runClaude(
      projectRoot,
      ['plugin', 'uninstall', CLAUDE_PLUGIN_ID, '--scope', scope, '--keep-data'],
      effects,
    );
    effects.push({ kind: 'remove', target: CLAUDE_PLUGIN_ID, operation: scope });
    if (safewordPlugin(pluginEntries(projectRoot, effects), scope, projectRoot) !== undefined) {
      throw new ClaudeProfileError(
        'CLAUDE_PLUGIN_UNINSTALL_UNVERIFIED',
        `Claude still reports ${CLAUDE_PLUGIN_ID} after uninstall.`,
        effects,
      );
    }
    return createResult({
      state: 'changed',
      effects: { destructive: effects },
      recovery: [
        {
          command: `safeword install --agents=claude --scope ${scope}`,
          description: 'Reinstall the Claude plugin if this removal must be reversed.',
          requiresHuman: true,
        },
      ],
      data: { command: 'claude uninstall', plugin: CLAUDE_PLUGIN_ID, scope, data_preserved: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure =
      error instanceof ClaudeProfileError
        ? error
        : new ClaudeProfileError('CLAUDE_PLUGIN_UNINSTALL_FAILED', message, effects);
    return createResult({
      state: 'failed',
      changed: failure.effects.length > 0,
      effects: { destructive: failure.effects },
      errors: [{ code: failure.code, message: failure.message, retryable: true }],
      recovery: [
        {
          command: `safeword install --agents=claude --scope ${scope}`,
          description: 'Repair or restore the Claude plugin.',
          requiresHuman: true,
        },
      ],
      data: { command: 'claude uninstall', plugin: CLAUDE_PLUGIN_ID, scope },
    });
  }
}
