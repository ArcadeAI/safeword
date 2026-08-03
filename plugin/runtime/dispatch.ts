import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

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

function legacyHookCommand(value: unknown, projectRoot: string): boolean {
  if (typeof value === 'string') {
    const reference = /\.safeword\/hooks\/[^\s"']+/u.exec(value)?.[0];
    if (reference === undefined) return false;
    try {
      return lstatSync(nodePath.join(projectRoot, reference)).isFile();
    } catch {
      return false;
    }
  }
  if (Array.isArray(value)) return value.some(child => legacyHookCommand(child, projectRoot));
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).some(child => legacyHookCommand(child, projectRoot));
}

function viableLegacyAuthority(event: string): boolean {
  const projectRoot = process.env.CLAUDE_PROJECT_DIR;
  if (projectRoot === undefined || projectRoot === '') return false;
  const settingsPath = nodePath.join(projectRoot, '.claude/settings.json');
  if (!existsSync(settingsPath)) return false;
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      hooks?: Record<string, unknown>;
    };
    return legacyHookCommand(settings.hooks?.[event], projectRoot);
  } catch {
    // Malformed legacy configuration is not viable authority. The plugin stays
    // functional, while status reports the project conflict before cleanup.
    return false;
  }
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
  const pathSegments = typeof asset.path === 'string' ? asset.path.split(nodePath.sep) : [];
  if (
    typeof asset.path !== 'string' ||
    nodePath.isAbsolute(asset.path) ||
    pathSegments.includes('..') ||
    !/^[\da-f]{64}$/u.test(asset.sha256 ?? '')
  ) {
    throw new Error('Safeword Claude plugin inventory contains an unsafe asset.');
  }
}

function verifyInventoryAsset(pluginRoot: string, asset: Partial<InventoryAssetV1>): void {
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
}

function verifyInventory(pluginRoot: string, identity: PluginIdentityV1): void {
  const inventoryContent = readFileSync(nodePath.join(pluginRoot, 'inventory.json'), 'utf8');
  const inventoryDigest = createHash('sha256').update(inventoryContent).digest('hex');
  if (inventoryDigest !== identity.inventory_sha256) {
    throw new Error('Safeword Claude plugin inventory does not match its bundled identity.');
  }
  const inventory = JSON.parse(inventoryContent) as Partial<PluginInventoryV1>;
  if (inventory.schema_version !== 1 || !Array.isArray(inventory.assets)) {
    throw new Error('Safeword Claude plugin inventory is malformed.');
  }
  for (const asset of inventory.assets) {
    verifyInventoryAsset(pluginRoot, asset);
  }
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
  mkdirSync(pluginData, { recursive: true });
  const destination = nodePath.join(pluginData, filename);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  const descriptor = openSync(temporary, 'wx', 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(record, undefined, 2)}\n`);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, destination);
  const directoryDescriptor = openSync(pluginData, 'r');
  try {
    fsyncSync(directoryDescriptor);
  } finally {
    closeSync(directoryDescriptor);
  }
}

function setupRanForSession(pluginData: string, sessionId: string | undefined): boolean {
  if (sessionId === undefined) return false;
  const path = nodePath.join(pluginData, 'cache-smoke-v1.json');
  if (!existsSync(path)) return false;
  try {
    const smoke = JSON.parse(readFileSync(path, 'utf8')) as {
      event?: string;
      session_id?: string;
    };
    return smoke.event === 'Setup' && smoke.session_id === sessionId;
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
  if (event === 'SessionStart' && setupRanForSession(pluginData, input.session_id)) return;
  const projectRootValue = process.env.CLAUDE_PROJECT_DIR;
  if (projectRootValue === undefined || projectRootValue.trim() === '') {
    throw new Error('CLAUDE_PROJECT_DIR is required for execution proof.');
  }
  if (!statSync(projectRootValue).isDirectory()) {
    throw new Error('CLAUDE_PROJECT_DIR must identify a directory.');
  }
  const projectRoot = realpathSync(projectRootValue);
  const projectDigest = createHash('sha256').update(projectRoot).digest('hex');
  writeDurableRecord(nodePath.join(pluginData, 'execution-proofs-v2'), `${projectDigest}.json`, {
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
  writeDurableRecord(requiredEnvironment('CLAUDE_PLUGIN_DATA'), 'cache-smoke-v1.json', {
    schema_version: 1,
    plugin_version: identity.plugin_version,
    hook_manifest_sha256: identity.hook_manifest_sha256,
    inventory_sha256: identity.inventory_sha256,
    canonical_plugin_root: pluginRoot,
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

function eventEntryMatches(entry: EventGroupEntryV1, input: HookInput): boolean {
  if (entry.matcher === undefined || entry.matcher === '') return true;
  return entry.matcher.split('|').includes(input.source ?? '');
}

function readEventEntries(event: string, pluginRoot: string): readonly EventGroupEntryV1[] {
  const value = JSON.parse(
    readFileSync(nodePath.join(pluginRoot, 'runtime', 'event-groups.json'), 'utf8'),
  ) as Partial<EventGroupsV1>;
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
    !['reason', 'stopReason', 'systemMessage'].includes(key) ||
    typeof current !== 'string' ||
    typeof value !== 'string'
  ) {
    return false;
  }
  target[key] = appendUniqueText(current, value);
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
      throw new TypeError('Hook JSON response must be an object.');
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
    if (result.status !== 0) return result.status;
    mergeHookOutput(event, response, result.stdout);
  }
  return 0;
}

function runEventGroup(
  event: string,
  pluginRoot: string,
  hookInput: HookInput,
  standardInput: Buffer,
): FunctionalCommandResult {
  const entries = readEventEntries(event, pluginRoot);
  const response: HookResponse = {};
  for (const entry of entries) {
    if (!eventEntryMatches(entry, hookInput)) continue;
    const hooks = entry.hooks ?? [];
    const status = runEventHooks(event, hooks, standardInput, response);
    if (status !== 0) return { status, stdout: '' };
  }
  return {
    status: 0,
    stdout: Object.keys(response).length === 0 ? '' : `${JSON.stringify(response)}\n`,
  };
}

function main(): number {
  const [event, mode, ...command] = process.argv.slice(2);
  if (event === undefined) throw new Error('Claude hook event is required.');
  if (mode !== undefined && mode !== '--' && mode !== '--event-group') {
    throw new Error('Expected -- or --event-group after the hook event.');
  }
  const pluginRoot = realpathSync(requiredEnvironment('CLAUDE_PLUGIN_ROOT'));
  process.env.SAFEWORD_PLUGIN_CLI = nodePath.join(pluginRoot, 'runtime', 'cli.js');
  const standardInput = readFileSync(0);
  let hookInput: HookInput = {};
  try {
    hookInput = JSON.parse(standardInput.toString('utf8')) as HookInput;
  } catch {
    // Functional hooks still receive malformed input and decide their own response.
  }
  const identity = readIdentity(pluginRoot);
  verifyManifest(pluginRoot, identity);
  verifyInventory(pluginRoot, identity);
  let execution: FunctionalCommandResult = { status: 0, stdout: '' };
  if (!viableLegacyAuthority(event)) {
    execution =
      mode === '--event-group'
        ? runEventGroup(event, pluginRoot, hookInput, standardInput)
        : runFunctionalCommand(command, standardInput);
  }
  if (execution.status === 0) {
    if (execution.stdout !== '') process.stdout.write(execution.stdout);
    recordExecutionProof(event, pluginRoot, identity, hookInput);
    recordCacheSmoke(event, pluginRoot, identity, hookInput);
  }
  return execution.status;
}

process.exitCode = main();
