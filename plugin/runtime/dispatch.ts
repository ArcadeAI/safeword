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
  writeDurableRecord(pluginData, 'execution-proof-v1.json', {
    schema_version: 1,
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

function runFunctionalCommand(arguments_: string[], input: Buffer): number {
  if (arguments_.length === 0) return 0;
  const [executable, ...parameters] = arguments_;
  if (executable === undefined) return 0;
  const result = spawnSync(executable, parameters, {
    input,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  return result.status ?? 1;
}

function main(): number {
  const [event, separator, ...command] = process.argv.slice(2);
  if (event === undefined) throw new Error('Claude hook event is required.');
  if (separator !== undefined && separator !== '--')
    throw new Error('Expected -- before hook command.');
  const pluginRoot = realpathSync(requiredEnvironment('CLAUDE_PLUGIN_ROOT'));
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
  const status = runFunctionalCommand(command, standardInput);
  if (status === 0) {
    recordExecutionProof(event, pluginRoot, identity, hookInput);
    recordCacheSmoke(event, pluginRoot, identity, hookInput);
  }
  return status;
}

process.exitCode = main();
