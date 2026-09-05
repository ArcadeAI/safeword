import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { parse, type ParseError } from 'jsonc-parser';

import { isDogfoodRepo } from '../../../templates/hooks/lib/dogfood.js';
import { writeDurableFile } from '../../codex-plugin/durable-write.js';
import { claudeLegacyMutations, migrateClaudeLegacyAutomatically } from '../cleanup.js';
import {
  historicalCatalogueDigest,
  isAcceptedHistoricalHook,
  isAcceptedHistoricalHookFile,
} from '../historical-ownership.js';
import {
  CLAUDE_NATIVE_METADATA_FILES,
  CLAUDE_NATIVE_REQUIRED_ASSETS,
  claudeNativePayloadFiles,
} from '../inventory.js';
import {
  advisoryStateDigest,
  claimClaudeMigrationAdvisory,
  claimClaudeMigrationAttempt,
  claudeProjectStatePath,
  claudeWatchedSettingsDigest,
  pluginModeIsTerminal,
  readClaudePluginMode,
  removeLegacyClaudePluginMode,
  writeClaudeMigrationAttention,
} from '../migration-state.js';
import {
  claudeConfigDirectory,
  claudeProjectDigest,
  claudeProofDirectory,
} from '../plugin-data.js';
import { canonicalClaudeProjectRoot } from '../project-root.js';

interface PluginIdentityV1 {
  readonly schema_version: 1;
  readonly plugin_version: string;
  readonly hook_manifest_sha256: string;
  readonly inventory_sha256: string;
}

interface InventoryAssetV1 {
  readonly path: string;
  readonly sha256: string;
}

interface PluginInventoryV1 {
  readonly schema_version: 1;
  readonly assets: readonly InventoryAssetV1[];
}

interface HookInput {
  readonly tool_name?: string;
  readonly cwd?: string;
  readonly session_id?: string;
  readonly source?: string;
}

interface EventGroupEntryV1 {
  readonly matcher?: string;
  readonly hooks?: readonly { readonly type?: string; readonly command?: string }[];
}

interface EventGroupsV1 {
  readonly schema_version: 1;
  readonly groups: Readonly<Record<string, readonly EventGroupEntryV1[]>>;
}

type HookResponse = Record<string, unknown>;

interface FunctionalCommandResult {
  readonly status: number;
  readonly stdout: string;
}

interface VerifiedPlugin {
  readonly eventGroupsContent: Buffer;
  readonly identity: PluginIdentityV1;
}

function parseSettings(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined;
  const errors: ParseError[] = [];
  const parsed = parse(readFileSync(path, 'utf8'), errors, {
    allowTrailingComma: true,
    disallowComments: false,
  }) as unknown;
  return errors.length === 0 &&
    typeof parsed === 'object' &&
    parsed !== null &&
    !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;
}

function acceptedLegacyHookReference(value: string, projectRoot: string): boolean {
  const reference = /\.safeword\/hooks\/[^\s"';&|)]+/u.exec(value)?.[0];
  if (reference === undefined) return false;
  try {
    const hooksRoot = nodePath.resolve(projectRoot, '.safeword/hooks');
    const target = nodePath.resolve(projectRoot, reference);
    if (!target.startsWith(`${hooksRoot}${nodePath.sep}`)) return false;
    if (realpathSync(hooksRoot) !== hooksRoot || realpathSync(target) !== target) return false;
    return (
      lstatSync(target).isFile() && isAcceptedHistoricalHookFile(reference, readFileSync(target))
    );
  } catch {
    return false;
  }
}

function acceptedLegacyHookFile(value: unknown, projectRoot: string): boolean {
  if (typeof value === 'string') return acceptedLegacyHookReference(value, projectRoot);
  if (Array.isArray(value)) {
    return value.some(child => acceptedLegacyHookFile(child, projectRoot));
  }
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).some(child => acceptedLegacyHookFile(child, projectRoot));
}

function viableLegacyAuthority(event: string, projectRoot: string): boolean {
  const settings = parseSettings(nodePath.join(projectRoot, '.claude/settings.json'));
  const hooks = settings?.hooks;
  if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) return false;
  const entries = (hooks as Record<string, unknown>)[event];
  return (
    Array.isArray(entries) &&
    entries.some(
      entry => isAcceptedHistoricalHook(event, entry) && acceptedLegacyHookFile(entry, projectRoot),
    )
  );
}

function requiredEnvironment(name: 'CLAUDE_PLUGIN_DATA' | 'CLAUDE_PLUGIN_ROOT'): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is required.`);
  return value;
}

function readIdentity(pluginRoot: string): PluginIdentityV1 {
  const value = JSON.parse(
    readFileSync(nodePath.join(pluginRoot, 'identity.json'), 'utf8'),
  ) as Partial<PluginIdentityV1>;
  if (
    value.schema_version !== 1 ||
    typeof value.plugin_version !== 'string' ||
    !/^[\da-f]{64}$/u.test(value.hook_manifest_sha256 ?? '') ||
    !/^[\da-f]{64}$/u.test(value.inventory_sha256 ?? '')
  ) {
    throw new Error('Safeword Claude plugin identity is malformed.');
  }
  return value as PluginIdentityV1;
}

function assertSafeInventoryAsset(
  asset: Partial<InventoryAssetV1>,
): asserts asset is InventoryAssetV1 {
  const pathSegments = typeof asset.path === 'string' ? asset.path.split(/[\\/]/u) : [];
  if (
    typeof asset.path !== 'string' ||
    nodePath.isAbsolute(asset.path) ||
    pathSegments.includes('..') ||
    !/^[\da-f]{64}$/u.test(asset.sha256 ?? '')
  ) {
    throw new Error('Safeword Claude plugin inventory contains an unsafe asset.');
  }
}

function verifyInventoryAsset(pluginRoot: string, asset: Partial<InventoryAssetV1>): Buffer {
  assertSafeInventoryAsset(asset);
  const assetPath = nodePath.join(pluginRoot, asset.path);
  if (!lstatSync(assetPath).isFile()) {
    throw new Error(`Safeword Claude plugin asset is not a regular file: ${asset.path}`);
  }
  const content = readFileSync(assetPath);
  const actualDigest = createHash('sha256').update(content).digest('hex');
  if (actualDigest !== asset.sha256) {
    throw new Error(
      `Safeword Claude plugin asset failed integrity validation: ${asset.path} (${actualDigest})`,
    );
  }
  return content;
}

function verifyInventory(pluginRoot: string, identity: PluginIdentityV1): Map<string, Buffer> {
  const inventoryContent = readFileSync(nodePath.join(pluginRoot, 'inventory.json'), 'utf8');
  const inventoryDigest = createHash('sha256').update(inventoryContent).digest('hex');
  if (inventoryDigest !== identity.inventory_sha256) {
    throw new Error('Safeword Claude plugin inventory does not match its bundled identity.');
  }
  const inventory = JSON.parse(inventoryContent) as Partial<PluginInventoryV1>;
  if (inventory.schema_version !== 1 || !Array.isArray(inventory.assets)) {
    throw new Error('Safeword Claude plugin inventory is malformed.');
  }
  const inventoryPaths = new Set(inventory.assets.map(asset => asset.path));
  for (const requiredPath of CLAUDE_NATIVE_REQUIRED_ASSETS) {
    if (!inventoryPaths.has(requiredPath)) {
      throw new Error(
        `Safeword Claude plugin inventory is missing required asset: ${requiredPath}`,
      );
    }
  }
  const verifiedAssets = new Map<string, Buffer>();
  for (const asset of inventory.assets) {
    assertSafeInventoryAsset(asset);
    verifiedAssets.set(asset.path, verifyInventoryAsset(pluginRoot, asset));
  }
  const expectedPaths = new Set([
    ...inventory.assets.map(asset => asset.path),
    ...CLAUDE_NATIVE_METADATA_FILES,
  ]);
  const unexpectedPath = claudeNativePayloadFiles(pluginRoot).find(
    path => !expectedPaths.has(path),
  );
  if (unexpectedPath !== undefined) {
    throw new Error(`Safeword Claude plugin contains an unlisted asset: ${unexpectedPath}`);
  }
  return verifiedAssets;
}

function verifyManifest(pluginRoot: string, identity: PluginIdentityV1): void {
  const manifest = readFileSync(nodePath.join(pluginRoot, 'hooks', 'hooks.json'));
  const digest = createHash('sha256').update(manifest).digest('hex');
  if (digest !== identity.hook_manifest_sha256) {
    throw new Error('Safeword Claude plugin hook manifest does not match its bundled identity.');
  }
}

function writeDurableRecord(
  pluginData: string,
  filename: string,
  record: Record<string, unknown>,
): void {
  writeDurableFile(
    nodePath.join(pluginData, filename),
    `${JSON.stringify(record, undefined, 2)}\n`,
    {
      mode: 0o600,
    },
  );
}

function setupRanForSession(
  pluginData: string,
  sessionId: string | undefined,
  pluginRoot: string,
  projectRoot: string,
  identity: PluginIdentityV1,
): boolean {
  if (sessionId === undefined) return false;
  const path = nodePath.join(pluginData, 'cache-smoke-v1.json');
  if (!existsSync(path)) return false;
  try {
    const smoke = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const expected: Record<string, unknown> = {
      schema_version: 1,
      event: 'Setup',
      session_id: sessionId,
      project_root: projectRoot,
      plugin_version: identity.plugin_version,
      hook_manifest_sha256: identity.hook_manifest_sha256,
      inventory_sha256: identity.inventory_sha256,
      canonical_plugin_root: pluginRoot,
    };
    return Object.entries(expected).every(([key, value]) => smoke[key] === value);
  } catch {
    return false;
  }
}

function recordExecutionProof(
  event: string,
  pluginRoot: string,
  identity: PluginIdentityV1,
  input: HookInput,
): void {
  if (event !== 'SessionStart' && event !== 'UserPromptSubmit') return;
  const pluginData = requiredEnvironment('CLAUDE_PLUGIN_DATA');
  const projectRoot = canonicalClaudeProjectRoot(input.cwd ?? process.cwd());
  if (
    event === 'SessionStart' &&
    setupRanForSession(pluginData, input.session_id, pluginRoot, projectRoot, identity)
  ) {
    return;
  }
  writeDurableRecord(claudeProofDirectory(), `${claudeProjectDigest(projectRoot)}.json`, {
    schema_version: 2,
    project_root: projectRoot,
    plugin_version: identity.plugin_version,
    hook_manifest_sha256: identity.hook_manifest_sha256,
    canonical_plugin_root: pluginRoot,
    event,
    session_id: input.session_id,
    recorded_at: new Date().toISOString(),
  });
}

function recordCacheSmoke(
  event: string,
  pluginRoot: string,
  identity: PluginIdentityV1,
  input: HookInput,
): void {
  if (event !== 'Setup') return;
  const projectRoot = canonicalClaudeProjectRoot(input.cwd ?? process.cwd());
  writeDurableRecord(requiredEnvironment('CLAUDE_PLUGIN_DATA'), 'cache-smoke-v1.json', {
    schema_version: 1,
    plugin_version: identity.plugin_version,
    hook_manifest_sha256: identity.hook_manifest_sha256,
    inventory_sha256: identity.inventory_sha256,
    canonical_plugin_root: pluginRoot,
    project_root: projectRoot,
    event,
    session_id: input.session_id,
    recorded_at: new Date().toISOString(),
  });
}

function runFunctionalCommand(
  arguments_: string[],
  input: Buffer,
  captureOutput = false,
): FunctionalCommandResult {
  if (arguments_.length === 0) return { status: 0, stdout: '' };
  const [executable, ...parameters] = arguments_;
  if (executable === undefined) return { status: 0, stdout: '' };
  const result = spawnSync(executable, parameters, {
    // Bun snapshots the parent environment for child_process unless it is
    // passed explicitly. The dispatcher sets SAFEWORD_PLUGIN_CLI at runtime,
    // so aggregate child hooks need the current environment rather than the
    // startup snapshot.
    env: process.env,
    input,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['pipe', captureOutput ? 'pipe' : 'inherit', 'inherit'],
  });
  return {
    status: result.status ?? 1,
    stdout: captureOutput ? (result.stdout?.toString('utf8') ?? '') : '',
  };
}

const TOOL_EVENTS = new Set([
  'PermissionDenied',
  'PermissionRequest',
  'PostToolUse',
  'PostToolUseFailure',
  'PreToolUse',
]);

function eventEntryMatches(event: string, entry: EventGroupEntryV1, input: HookInput): boolean {
  if (entry.matcher === undefined || entry.matcher === '') return true;
  const subject = TOOL_EVENTS.has(event) ? input.tool_name : input.source;
  return entry.matcher.split('|').includes(subject ?? '');
}

function readEventEntries(event: string, eventGroupsContent: Buffer): readonly EventGroupEntryV1[] {
  const value = JSON.parse(eventGroupsContent.toString('utf8')) as Partial<EventGroupsV1>;
  if (value.schema_version !== 1 || typeof value.groups !== 'object' || value.groups === null) {
    throw new TypeError('Safeword Claude plugin event groups are malformed.');
  }
  const entries = value.groups[event];
  if (!Array.isArray(entries)) {
    throw new TypeError(`Safeword Claude plugin event group is missing: ${event}`);
  }
  return entries;
}

function appendUniqueText(current: unknown, next: string): string {
  if (typeof current !== 'string' || current === '') return next;
  if (current === next || current.split('\n').includes(next)) return current;
  return `${current}\n${next}`;
}

function mergeBooleanResponse(
  target: HookResponse,
  key: string,
  current: unknown,
  value: unknown,
): boolean {
  if (typeof current !== 'boolean' || typeof value !== 'boolean') return false;
  if (key === 'continue') target[key] = current && value;
  else if (key === 'suppressOutput') target[key] = current || value;
  else return false;
  return true;
}

function mergeTextResponse(
  target: HookResponse,
  key: string,
  current: unknown,
  value: unknown,
): boolean {
  if (
    !['permissionDecisionReason', 'reason', 'stopReason', 'systemMessage'].includes(key) ||
    typeof current !== 'string' ||
    typeof value !== 'string'
  ) {
    return false;
  }
  target[key] = appendUniqueText(current, value);
  return true;
}

const PERMISSION_DECISION_PRECEDENCE = ['allow', 'ask', 'defer', 'deny'] as const;

function mergePermissionDecision(target: HookResponse, key: string, value: unknown): boolean {
  const current = target[key];
  if (key !== 'permissionDecision' || typeof current !== 'string' || typeof value !== 'string') {
    return false;
  }
  const currentRank = PERMISSION_DECISION_PRECEDENCE.indexOf(
    current as (typeof PERMISSION_DECISION_PRECEDENCE)[number],
  );
  const valueRank = PERMISSION_DECISION_PRECEDENCE.indexOf(
    value as (typeof PERMISSION_DECISION_PRECEDENCE)[number],
  );
  if (currentRank === -1 || valueRank === -1) return false;
  target[key] = PERMISSION_DECISION_PRECEDENCE[Math.max(currentRank, valueRank)];
  return true;
}

function mergeScalarResponse(target: HookResponse, key: string, value: unknown): void {
  const current = target[key];
  if (current === undefined || JSON.stringify(current) === JSON.stringify(value)) {
    target[key] = value;
    return;
  }
  if (mergeBooleanResponse(target, key, current, value)) return;
  if (mergeTextResponse(target, key, current, value)) return;
  if (mergePermissionDecision(target, key, value)) return;
  if (key === 'decision' && (current === 'block' || value === 'block')) {
    target[key] = 'block';
    return;
  }
  throw new Error(`Safeword Claude plugin sibling hooks returned conflicting ${key} values.`);
}

function specificOutput(target: HookResponse, event: string): HookResponse {
  const current = target.hookSpecificOutput;
  if (current !== undefined) return current as HookResponse;
  const created = { hookEventName: event };
  target.hookSpecificOutput = created;
  return created;
}

function parseHookOutput(
  event: string,
  target: HookResponse,
  trimmed: string,
): HookResponse | undefined {
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      const output = specificOutput(target, event);
      output.additionalContext = appendUniqueText(output.additionalContext, trimmed);
      return undefined;
    }
    return parsed as HookResponse;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const output = specificOutput(target, event);
    output.additionalContext = appendUniqueText(output.additionalContext, trimmed);
    return undefined;
  }
}

function mergeSpecificOutput(event: string, target: HookResponse, value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Safeword Claude plugin hookSpecificOutput must be an object.');
  }
  const source = value as HookResponse;
  if (source.hookEventName !== event) {
    throw new Error(`Safeword Claude plugin sibling returned the wrong hook event for ${event}.`);
  }
  const destination = specificOutput(target, event);
  for (const [key, next] of Object.entries(source)) {
    if (key === 'hookEventName') continue;
    if (key === 'additionalContext' && typeof next === 'string') {
      destination.additionalContext = appendUniqueText(destination.additionalContext, next);
    } else {
      mergeScalarResponse(destination, key, next);
    }
  }
}

function mergeHookOutput(event: string, target: HookResponse, output: string): void {
  const trimmed = output.trim();
  if (trimmed === '') return;
  const response = parseHookOutput(event, target, trimmed);
  if (response === undefined) return;
  for (const [key, value] of Object.entries(response)) {
    if (key === 'hookSpecificOutput') mergeSpecificOutput(event, target, value);
    else mergeScalarResponse(target, key, value);
  }
}

function appendMigrationAdvisory(event: string, output: string, advisory: string): string {
  const response: HookResponse = {};
  mergeHookOutput(event, response, output);
  const specific = specificOutput(response, event);
  specific.additionalContext = appendUniqueText(specific.additionalContext, advisory);
  return `${JSON.stringify(response)}\n`;
}

function safeAppendMigrationAdvisory(event: string, output: string, advisory: string): string {
  try {
    return appendMigrationAdvisory(event, output, advisory);
  } catch {
    return output;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(child => stableJson(child)).join(',')}]`;
  if (typeof value !== 'object' || value === null) return JSON.stringify(value) ?? 'undefined';
  return `{${Object.entries(value)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
    .join(',')}}`;
}

function scopeDeclaration(path: string): { enabled: boolean; marketplace: unknown } {
  const settings = parseSettings(path);
  const enabledPlugins = settings?.enabledPlugins;
  const marketplaces = settings?.extraKnownMarketplaces;
  return {
    enabled:
      typeof enabledPlugins === 'object' &&
      enabledPlugins !== null &&
      !Array.isArray(enabledPlugins) &&
      (enabledPlugins as Record<string, unknown>)['safeword@safeword'] === true,
    marketplace:
      typeof marketplaces === 'object' && marketplaces !== null && !Array.isArray(marketplaces)
        ? (marketplaces as Record<string, unknown>).safeword
        : undefined,
  };
}

function incompatibleScopeOverlap(projectRoot: string): boolean {
  const project = scopeDeclaration(nodePath.join(projectRoot, '.claude/settings.json'));
  const user = scopeDeclaration(nodePath.join(claudeConfigDirectory(), 'settings.json'));
  return (
    project.enabled &&
    user.enabled &&
    stableJson(project.marketplace) !== stableJson(user.marketplace)
  );
}

interface MigrationExecutionContext {
  readonly event: string;
  readonly execution: FunctionalCommandResult;
  readonly projectRoot: string;
  readonly sessionId: string | undefined;
}

function advisoryExecution(
  context: MigrationExecutionContext,
  advisory: string,
  stateDigest = advisoryStateDigest(advisory),
): FunctionalCommandResult {
  const { event, execution, projectRoot, sessionId } = context;
  if (!claimClaudeMigrationAdvisory(projectRoot, sessionId, stateDigest)) return execution;
  return {
    ...execution,
    stdout: appendMigrationAdvisory(event, execution.stdout, advisory),
  };
}

function scopeOverlapExecution(
  context: MigrationExecutionContext,
  identity: PluginIdentityV1,
  catalogueSha256: string,
): FunctionalCommandResult {
  const { projectRoot } = context;
  const advisory =
    'Safeword found different project and user Claude plugin declarations. It preserved the old integration and did not block your prompt. Align the two Safeword plugin versions, then retry.';
  const stateDigest = advisoryStateDigest(advisory);
  writeClaudeMigrationAttention(projectRoot, {
    schema_version: 1,
    state_digest: stateDigest,
    plugin_version: identity.plugin_version,
    catalogue_sha256: catalogueSha256,
    watched_settings_sha256: claudeWatchedSettingsDigest(projectRoot),
    classification: 'scope-overlap',
    advisory,
  });
  return advisoryExecution(context, advisory, stateDigest);
}

function automaticMigrationAttemptKind(projectRoot: string): 'migration' | 'recovery' {
  return existsSync(claudeProjectStatePath(projectRoot, 'transaction')) ? 'recovery' : 'migration';
}

function automaticMigrationProjectRoot(
  event: string,
  hookCwd: string | undefined,
): string | undefined {
  if (event !== 'UserPromptSubmit') return undefined;
  const projectRoot = canonicalClaudeProjectRoot(hookCwd ?? process.cwd());
  // The dogfood repo's .claude/ mirrors are the LOCAL canonical source
  // (packages/cli/templates/), routinely ahead of what this same plugin
  // build ships. Auto-retiring them here as "legacy" would delete
  // in-progress framework work and desync the repo's own dogfood-parity
  // contract (ticket 2598) — the same reason session-auto-upgrade.ts skips
  // this repo.
  return isDogfoodRepo(projectRoot) ? undefined : projectRoot;
}

function automaticMigrationUnsafe(
  event: string,
  identity: PluginIdentityV1,
  execution: FunctionalCommandResult,
  sessionId: string | undefined,
  hookCwd: string | undefined,
): FunctionalCommandResult {
  const projectRoot = automaticMigrationProjectRoot(event, hookCwd);
  if (projectRoot === undefined) return execution;
  const context = { event, execution, projectRoot, sessionId };
  const catalogueSha256 = historicalCatalogueDigest();
  if (incompatibleScopeOverlap(projectRoot)) {
    return scopeOverlapExecution(context, identity, catalogueSha256);
  }
  const marker = readClaudePluginMode(projectRoot);
  if (
    marker !== undefined &&
    pluginModeIsTerminal(marker, {
      plugin_version: identity.plugin_version,
      hook_manifest_sha256: identity.hook_manifest_sha256,
      catalogue_sha256: catalogueSha256,
    }) &&
    claudeLegacyMutations(projectRoot).length === 0
  ) {
    return execution;
  }
  if (
    !claimClaudeMigrationAttempt(projectRoot, sessionId, automaticMigrationAttemptKind(projectRoot))
  ) {
    const advisory =
      'Safeword could not finish retiring the old Claude integration in this session. Your prompt was not blocked; run `safeword claude recover` to repair it now, or start a new Claude session to retry automatically.';
    return advisoryExecution(context, advisory);
  }
  const result = migrateClaudeLegacyAutomatically(projectRoot, {
    pluginVersion: identity.plugin_version,
    hookManifestSha256: identity.hook_manifest_sha256,
    catalogueSha256,
    deadline: Date.now() + 2000,
  });
  if (result.state === 'complete') removeLegacyClaudePluginMode(projectRoot);
  return result.advisory === undefined ? execution : advisoryExecution(context, result.advisory);
}

function automaticMigration(
  event: string,
  identity: PluginIdentityV1,
  execution: FunctionalCommandResult,
  sessionId: string | undefined,
  hookCwd: string | undefined,
): FunctionalCommandResult {
  try {
    return automaticMigrationUnsafe(event, identity, execution, sessionId, hookCwd);
  } catch (error) {
    if (event !== 'UserPromptSubmit') return execution;
    const advisory = `Safeword could not inspect the old Claude integration: ${error instanceof Error ? error.message : String(error)} Your prompt was not blocked; run \`safeword claude status\` for the repair action.`;
    return { ...execution, stdout: safeAppendMigrationAdvisory(event, execution.stdout, advisory) };
  }
}

function executionProofFailure(
  event: string,
  execution: FunctionalCommandResult,
  error: unknown,
): FunctionalCommandResult {
  if (event !== 'UserPromptSubmit') return execution;
  const advisory = `Safeword could not record native plugin proof: ${error instanceof Error ? error.message : String(error)} The prompt was not blocked; verify protection with \`safeword claude status\`.`;
  return { ...execution, stdout: safeAppendMigrationAdvisory(event, execution.stdout, advisory) };
}

function postExecutionLifecycle(
  event: string,
  pluginRoot: string,
  identity: PluginIdentityV1,
  hookInput: HookInput,
  execution: FunctionalCommandResult,
): FunctionalCommandResult {
  try {
    recordExecutionProof(event, pluginRoot, identity, hookInput);
  } catch (error) {
    return executionProofFailure(event, execution, error);
  }
  try {
    recordCacheSmoke(event, pluginRoot, identity, hookInput);
  } catch {
    // Cache-smoke evidence is diagnostic; exact execution proof remains authoritative.
  }
  return automaticMigration(event, identity, execution, hookInput.session_id, hookInput.cwd);
}

function verifiedIdentity(event: string, pluginRoot: string): VerifiedPlugin | undefined {
  try {
    const identity = readIdentity(pluginRoot);
    verifyManifest(pluginRoot, identity);
    const verifiedAssets = verifyInventory(pluginRoot, identity);
    const eventGroupsContent = verifiedAssets.get('runtime/event-groups.json');
    if (eventGroupsContent === undefined) {
      throw new Error('Safeword Claude plugin verified event groups are unavailable.');
    }
    return { eventGroupsContent, identity };
  } catch (error) {
    if (event !== 'UserPromptSubmit') throw error;
    const advisory = `Safeword detected a damaged native plugin cache: ${error instanceof Error ? error.message : String(error)} The prompt was not blocked; no native Safeword hook result was applied.`;
    try {
      process.stdout.write(safeAppendMigrationAdvisory(event, '', advisory));
    } catch {
      // Integrity failure still must not block the submitted prompt.
    }
    return undefined;
  }
}

function runEventHooks(
  event: string,
  hooks: readonly { readonly type?: string; readonly command?: string }[],
  standardInput: Buffer,
  response: HookResponse,
): number {
  for (const hook of hooks) {
    if (hook.type !== 'command' || typeof hook.command !== 'string') {
      throw new Error(`Safeword Claude plugin event group has an unsupported ${event} hook.`);
    }
    const result = runFunctionalCommand(['bash', '-lc', hook.command], standardInput, true);
    if (result.status !== 0) {
      // Claude treats exit 1 as a non-blocking hook error. A blockable event
      // must therefore fail closed even when an earlier sibling already
      // produced a denial that would otherwise be discarded by this return.
      return event === 'UserPromptSubmit' ? result.status : 2;
    }
    mergeHookOutput(event, response, result.stdout);
  }
  return 0;
}

function runEventGroup(
  event: string,
  eventGroupsContent: Buffer,
  hookInput: HookInput,
  standardInput: Buffer,
): FunctionalCommandResult {
  const entries = readEventEntries(event, eventGroupsContent);
  const response: HookResponse = {};
  for (const entry of entries) {
    if (!eventEntryMatches(event, entry, hookInput)) continue;
    const hooks = entry.hooks ?? [];
    const status = runEventHooks(event, hooks, standardInput, response);
    if (status !== 0) return { status, stdout: '' };
  }
  return {
    status: 0,
    stdout: Object.keys(response).length === 0 ? '' : `${JSON.stringify(response)}\n`,
  };
}

function functionalExecutionFailure(event: string, error: unknown): FunctionalCommandResult {
  // Prompt submission must remain available during migration failures. Other lifecycle
  // events stay fail-closed because contradictory authorization output is unsafe to guess at.
  if (event !== 'UserPromptSubmit') {
    process.stderr.write(
      `Safeword could not safely combine its ${event} hook output: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return { status: 2, stdout: '' };
  }
  const advisory = `Safeword could not combine its Claude hook output: ${error instanceof Error ? error.message : String(error)} The prompt was not blocked; no combined Safeword hook result was applied.`;
  return { status: 0, stdout: safeAppendMigrationAdvisory(event, '', advisory) };
}

function parseHookInput(standardInput: Buffer): HookInput {
  try {
    const parsed = JSON.parse(standardInput.toString('utf8')) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Functional hooks still receive malformed input and decide their own response.
    return {};
  }
}

function executeConfiguredHooks(input: {
  readonly event: string;
  readonly mode: string | undefined;
  readonly command: string[];
  readonly eventGroupsContent: Buffer;
  readonly hookInput: HookInput;
  readonly projectRoot: string;
  readonly standardInput: Buffer;
}): FunctionalCommandResult {
  if (viableLegacyAuthority(input.event, input.projectRoot)) return { status: 0, stdout: '' };
  try {
    return input.mode === '--event-group'
      ? runEventGroup(input.event, input.eventGroupsContent, input.hookInput, input.standardInput)
      : runFunctionalCommand(
          input.command,
          input.standardInput,
          input.event === 'UserPromptSubmit',
        );
  } catch (error) {
    return functionalExecutionFailure(input.event, error);
  }
}

// Points the SessionStart context hook at the packaged handbook (mirrors the
// same env var Codex's runtime already sets) so it never falls back to
// reading the project's .safeword/SAFEWORD.md.
function exposePackagedSafewordContext(pluginRoot: string): void {
  const packagedSafewordPath = nodePath.join(pluginRoot, 'resources', 'SAFEWORD.md');
  if (existsSync(packagedSafewordPath)) {
    process.env.SAFEWORD_PACKAGED_CONTEXT_PATH = packagedSafewordPath;
  }
}

function mainUnsafe(event: string, mode: string | undefined, command: string[]): number {
  if (mode !== undefined && mode !== '--' && mode !== '--event-group') {
    throw new Error('Expected -- or --event-group after the hook event.');
  }
  if (mode !== '--event-group' && command.length === 0) {
    throw new Error('A direct hook command is required.');
  }
  const pluginRoot = realpathSync(requiredEnvironment('CLAUDE_PLUGIN_ROOT'));
  process.env.SAFEWORD_PLUGIN_CLI = nodePath.join(pluginRoot, 'runtime', 'cli.js');
  exposePackagedSafewordContext(pluginRoot);
  const standardInput = readFileSync(0);
  const hookInput = parseHookInput(standardInput);
  const projectRoot = canonicalClaudeProjectRoot(hookInput.cwd ?? process.cwd());
  const verifiedPlugin = verifiedIdentity(event, pluginRoot);
  if (verifiedPlugin === undefined) return 0;
  const { eventGroupsContent, identity } = verifiedPlugin;
  let execution = executeConfiguredHooks({
    event,
    mode,
    command,
    eventGroupsContent,
    hookInput,
    projectRoot,
    standardInput,
  });
  if (execution.status === 0) {
    execution = postExecutionLifecycle(event, pluginRoot, identity, hookInput, execution);
    if (execution.stdout !== '') process.stdout.write(execution.stdout);
  }
  return execution.status;
}

function startupFailure(event: string, error: unknown): number {
  const detail = error instanceof Error ? error.message : String(error);
  if (event === 'UserPromptSubmit') {
    const advisory = `Safeword could not start its Claude hook: ${detail} The prompt was not blocked; no Safeword hook result was applied.`;
    try {
      process.stdout.write(safeAppendMigrationAdvisory(event, '', advisory));
    } catch {
      // A startup failure must still leave prompt submission available.
    }
    return 0;
  }
  process.stderr.write(`Safeword could not safely start its ${event} hook: ${detail}\n`);
  return 2;
}

function main(): number {
  const [event, mode, ...command] = process.argv.slice(2);
  if (event === undefined) throw new Error('Claude hook event is required.');
  try {
    return mainUnsafe(event, mode, command);
  } catch (error) {
    return startupFailure(event, error);
  }
}

process.exitCode = main();
