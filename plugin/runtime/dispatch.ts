import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
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
    !/^[\da-f]{64}$/u.test(value.hook_manifest_sha256 ?? '')
  ) {
    throw new Error('Safeword Claude plugin identity is malformed.');
  }
  return value as PluginIdentityV1;
}

function verifyManifest(pluginRoot: string, identity: PluginIdentityV1): void {
  const manifest = readFileSync(nodePath.join(pluginRoot, 'hooks', 'hooks.json'));
  const digest = createHash('sha256').update(manifest).digest('hex');
  if (digest !== identity.hook_manifest_sha256) {
    throw new Error('Safeword Claude plugin hook manifest does not match its bundled identity.');
  }
}

function writeDurableProof(pluginData: string, proof: Record<string, unknown>): void {
  mkdirSync(pluginData, { recursive: true });
  const destination = nodePath.join(pluginData, 'execution-proof-v1.json');
  const temporary = `${destination}.${process.pid}.tmp`;
  const descriptor = openSync(temporary, 'w', 0o600);
  try {
    writeFileSync(descriptor, `${JSON.stringify(proof, undefined, 2)}\n`);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, destination);
}

function recordExecutionProof(event: string, pluginRoot: string, identity: PluginIdentityV1): void {
  if (event !== 'SessionStart' && event !== 'UserPromptSubmit') return;
  writeDurableProof(requiredEnvironment('CLAUDE_PLUGIN_DATA'), {
    schema_version: 1,
    plugin_version: identity.plugin_version,
    hook_manifest_sha256: identity.hook_manifest_sha256,
    canonical_plugin_root: pluginRoot,
    event,
    recorded_at: new Date().toISOString(),
  });
}

function runFunctionalCommand(arguments_: string[]): number {
  if (arguments_.length === 0) return 0;
  const [executable, ...parameters] = arguments_;
  if (executable === undefined) return 0;
  const result = spawnSync(executable, parameters, { stdio: 'inherit' });
  return result.status ?? 1;
}

function main(): number {
  const [event, separator, ...command] = process.argv.slice(2);
  if (event === undefined) throw new Error('Claude hook event is required.');
  if (separator !== undefined && separator !== '--')
    throw new Error('Expected -- before hook command.');
  const pluginRoot = realpathSync(requiredEnvironment('CLAUDE_PLUGIN_ROOT'));
  const identity = readIdentity(pluginRoot);
  verifyManifest(pluginRoot, identity);
  recordExecutionProof(event, pluginRoot, identity);
  return runFunctionalCommand(command);
}

process.exitCode = main();
