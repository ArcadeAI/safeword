import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult, type Effect } from '../cli-protocol/result.js';
import { SAFEWORD_SCHEMA } from '../schema.js';
import { compareVersions, isSafePackageVersion } from '../utils/version.js';

const MINIMUM_CLAUDE_VERSION = [2, 1, 170] as const;
const MARKETPLACE_NAME = 'safeword';
const PLUGIN_ID = 'safeword@safeword';
const MARKETPLACE_BASE = 'https://github.com/ArcadeAI/safeword.git';

export type JsonObject = Record<string, unknown>;

export type ClaudeProfileHealth =
  'current' | 'unsupported-host' | 'missing' | 'disabled' | 'wrong-version' | 'errored';

export interface ClaudeProfileObservation {
  readonly health: ClaudeProfileHealth;
  readonly plugin?: JsonObject;
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
  return `${MARKETPLACE_BASE}#v${SAFEWORD_SCHEMA.version}`;
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
  if (typeof ref !== 'string' || !ref.startsWith('v')) return 'conflict';
  const version = ref.slice(1);
  if (!isSafePackageVersion(version)) return 'conflict';
  if (kind !== undefined && (typeof kind !== 'string' || !['url', 'git'].includes(kind))) {
    return 'conflict';
  }
  if (version === SAFEWORD_SCHEMA.version) return 'current';
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

function safewordMarketplace(entries: readonly JsonObject[]): JsonObject | undefined {
  return entries.find(entry => entry.name === MARKETPLACE_NAME);
}

function safewordPlugin(entries: readonly JsonObject[]): JsonObject | undefined {
  return entries.find(entry => entry.id === PLUGIN_ID);
}

function failedResult(error: unknown): CliResult {
  let failure: ClaudeProfileError;
  if (error instanceof ClaudeProfileError) failure = error;
  else {
    const message = error instanceof Error ? error.message : String(error);
    failure = new ClaudeProfileError('CLAUDE_PLUGIN_INSTALL_FAILED', message);
  }
  let classification = 'errored';
  let nextAction = 'safeword claude install';
  if (failure.code === 'CLAUDE_VERSION_UNSUPPORTED') {
    classification = 'unsupported-host';
    nextAction = 'claude update';
  } else if (failure.code === 'CLAUDE_MARKETPLACE_CONFLICT') {
    classification = 'marketplace-conflict';
    nextAction = `claude plugin marketplace add ${officialMarketplaceSource()} --scope user`;
  }
  return createResult({
    state: 'failed',
    changed: failure.effects.length > 0,
    effects: { configuration: failure.effects },
    errors: [{ code: failure.code, message: failure.message, retryable: true }],
    nextActions: [
      {
        command: nextAction,
        mutates: true,
        requiresHuman: true,
      },
    ],
    data: { command: 'claude install', classification },
  });
}

function ensureMarketplace(cwd: string, effects: Effect[]): void {
  let marketplace = safewordMarketplace(marketplaceEntries(cwd, effects));
  const sourceStatus = marketplace === undefined ? undefined : marketplaceSourceStatus(marketplace);
  if (sourceStatus === 'conflict') {
    throw new ClaudeProfileError(
      'CLAUDE_MARKETPLACE_CONFLICT',
      `Claude marketplace ${MARKETPLACE_NAME} has an untrusted source or version; expected ${officialMarketplaceSource()} or an older valid tag from the same repository.`,
    );
  }
  if (sourceStatus === 'current') return;
  runClaude(
    cwd,
    ['plugin', 'marketplace', 'add', officialMarketplaceSource(), '--scope', 'user'],
    effects,
  );
  effects.push({
    kind: sourceStatus === 'stale' ? 'update' : 'add',
    target: MARKETPLACE_NAME,
    operation: 'user',
  });
  marketplace = safewordMarketplace(marketplaceEntries(cwd, effects));
  if (marketplace === undefined || marketplaceSourceStatus(marketplace) !== 'current') {
    throw new ClaudeProfileError(
      'CLAUDE_MARKETPLACE_UNVERIFIED',
      'Claude did not report the exact official Safeword marketplace after adding it.',
      effects,
    );
  }
}

function convergePlugin(cwd: string, effects: Effect[]): void {
  const plugin = safewordPlugin(pluginEntries(cwd, effects));
  if (plugin === undefined) {
    runClaude(cwd, ['plugin', 'install', PLUGIN_ID, '--scope', 'user'], effects);
    effects.push({ kind: 'install', target: PLUGIN_ID, operation: 'user' });
  } else if (plugin.version !== SAFEWORD_SCHEMA.version) {
    runClaude(cwd, ['plugin', 'update', PLUGIN_ID, '--scope', 'user'], effects);
    effects.push({ kind: 'update', target: PLUGIN_ID, operation: 'user' });
  } else if (plugin.enabled !== true) {
    runClaude(cwd, ['plugin', 'enable', PLUGIN_ID, '--scope', 'user'], effects);
    effects.push({ kind: 'enable', target: PLUGIN_ID, operation: 'user' });
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
export function observeClaudeProfile(cwd: string): ClaudeProfileObservation {
  try {
    assertSupportedHost(cwd);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      health: 'unsupported-host',
      message,
      nextAction: message.startsWith('Could not parse')
        ? 'reinstall Claude Code'
        : 'update Claude Code',
    };
  }

  let plugin: JsonObject | undefined;
  try {
    plugin = safewordPlugin(pluginEntries(cwd, []));
  } catch (error) {
    return {
      health: 'errored',
      message: error instanceof Error ? error.message : String(error),
      nextAction: 'repair the reported Claude plugin error',
    };
  }
  return observeInstalledPlugin(plugin);
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

function verifyPlugin(cwd: string, effects: readonly Effect[]): void {
  const plugin = safewordPlugin(pluginEntries(cwd, effects));
  if (
    plugin?.version === SAFEWORD_SCHEMA.version &&
    plugin.enabled === true &&
    plugin.scope === 'user'
  ) {
    assertNativePayload(plugin, effects);
    return;
  }
  throw new ClaudeProfileError(
    'CLAUDE_PLUGIN_UNVERIFIED',
    `Claude did not report ${PLUGIN_ID} ${SAFEWORD_SCHEMA.version} as enabled at user scope.`,
    effects,
  );
}

export function installClaudePlugin(cwd: string): CliResult {
  const effects: Effect[] = [];
  try {
    assertSupportedHost(cwd);
    ensureMarketplace(cwd, effects);
    convergePlugin(cwd, effects);
    verifyPlugin(cwd, effects);

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
        scope: 'user',
      },
    });
  } catch (error) {
    return failedResult(error);
  }
}
