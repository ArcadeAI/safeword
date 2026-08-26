import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { acquireProfileLock, releaseProfileLock } from '../utils/profile-lock.js';
import { type OpenCodeIdentityV1, parseOpenCodeIdentity } from './identity.js';

export type { OpenCodeIdentityV1 } from './identity.js';

export interface PlatformEnvironment {
  readonly platform: 'unix' | 'windows';
  readonly env: Readonly<Record<string, string | undefined>>;
}

export interface OpenCodeProfilePaths {
  readonly plugin: string;
  readonly identity: string;
  readonly safeword: string;
  readonly activation: string;
  readonly conformance: string;
  readonly profileError: string;
  readonly lock: string;
}

export type ProfileOwnership = 'absent' | 'managed' | 'managed-drift' | 'partial' | 'collision';

interface ProfileObservation {
  readonly ownership: ProfileOwnership;
  readonly detail?: 'identity-only' | 'plugin-only' | 'plugin-modified';
}

type FileObservation =
  | { readonly kind: 'absent' }
  | { readonly kind: 'collision' }
  | { readonly kind: 'file'; readonly bytes: Buffer };

type IdentityObservation =
  | { readonly kind: 'absent' }
  | { readonly kind: 'collision' }
  | { readonly kind: 'identity'; readonly value: OpenCodeIdentityV1 };

export interface ReconcileOpenCodeProfileInput {
  readonly operation: 'install' | 'uninstall';
  readonly root: string;
  readonly pluginBytes: Buffer | string;
  readonly identity: OpenCodeIdentityV1;
}

function usable(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 || !nodePath.isAbsolute(trimmed)
    ? undefined
    : trimmed;
}

export function resolveOpenCodeConfigRoot(input: PlatformEnvironment): string | undefined {
  const configured = usable(input.env.OPENCODE_CONFIG_DIR);
  if (configured !== undefined) return configured;
  const xdg = usable(input.env.XDG_CONFIG_HOME);
  if (xdg !== undefined) return nodePath.join(xdg, 'opencode');
  if (input.platform === 'windows') {
    const userProfile = usable(input.env.USERPROFILE);
    return userProfile === undefined
      ? undefined
      : nodePath.join(userProfile, '.config', 'opencode');
  }
  const home = usable(input.env.HOME);
  return home === undefined ? undefined : nodePath.join(home, '.config', 'opencode');
}

export function openCodeProfilePaths(root: string): OpenCodeProfilePaths {
  const safeword = nodePath.join(root, 'safeword');
  return {
    plugin: nodePath.join(root, 'plugins', 'safeword.js'),
    identity: nodePath.join(safeword, 'identity-v1.json'),
    safeword,
    activation: nodePath.join(safeword, 'activation-v1'),
    conformance: nodePath.join(safeword, 'conformance-v1'),
    profileError: nodePath.join(safeword, 'profile-error-v1.json'),
    lock: nodePath.join(safeword, 'profile-mutation.lock'),
  };
}

function observeFile(path: string): FileObservation {
  if (!existsSync(path)) return { kind: 'absent' };
  try {
    if (!lstatSync(path).isFile()) return { kind: 'collision' };
    return { kind: 'file', bytes: readFileSync(path) };
  } catch {
    return { kind: 'collision' };
  }
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function observeOpenCodeProfile(root: string): CliResult {
  const paths = openCodeProfilePaths(root);
  const plugin = observeFile(paths.plugin);
  const identityFile = observeFile(paths.identity);
  if (plugin.kind === 'absent' && identityFile.kind === 'absent') {
    return actionRequired(
      'OPENCODE_PROFILE_MISSING',
      'The Safeword OpenCode profile plugin is not installed.',
      'safeword install --agents=opencode',
    );
  }
  if (plugin.kind === 'collision' || identityFile.kind !== 'file') {
    return actionRequired(
      'OPENCODE_PROFILE_COLLISION',
      'The Safeword OpenCode profile cannot be verified.',
      'safeword install --agents=opencode',
    );
  }
  let identity: OpenCodeIdentityV1 | undefined;
  try {
    identity = parseOpenCodeIdentity(JSON.parse(identityFile.bytes.toString('utf8')));
  } catch {
    identity = undefined;
  }
  if (identity === undefined) {
    return actionRequired(
      'OPENCODE_IDENTITY_COLLISION',
      'The Safeword OpenCode identity cannot be verified.',
      'safeword install --agents=opencode',
    );
  }
  if (plugin.kind !== 'file' || sha256(plugin.bytes) !== identity.plugin_sha256) {
    return actionRequired(
      'OPENCODE_PLUGIN_DRIFT',
      'The Safeword OpenCode plugin does not match its identity.',
      'safeword install --agents=opencode',
    );
  }
  return createResult({ state: 'healthy' });
}

function sameIdentity(left: OpenCodeIdentityV1, right: OpenCodeIdentityV1): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parsedIdentity(file: FileObservation): IdentityObservation {
  if (file.kind !== 'file') return { kind: file.kind };
  try {
    const identity = parseOpenCodeIdentity(JSON.parse(file.bytes.toString('utf8')));
    return identity === undefined ? { kind: 'collision' } : { kind: 'identity', value: identity };
  } catch {
    return { kind: 'collision' };
  }
}

function classifyWithoutIdentity(
  plugin: FileObservation,
  expectedIdentity: OpenCodeIdentityV1,
): ProfileObservation {
  return plugin.kind === 'file' && sha256(plugin.bytes) === expectedIdentity.plugin_sha256
    ? { ownership: 'partial', detail: 'plugin-only' }
    : { ownership: 'collision' };
}

function classifyWithIdentity(
  plugin: FileObservation,
  identity: OpenCodeIdentityV1,
  expectedPlugin: Buffer | string,
  expectedIdentity: OpenCodeIdentityV1,
): ProfileObservation {
  if (plugin.kind === 'absent') return { ownership: 'partial', detail: 'identity-only' };
  if (plugin.kind !== 'file') return { ownership: 'collision' };
  if (sha256(plugin.bytes) !== identity.plugin_sha256) {
    return { ownership: 'managed-drift', detail: 'plugin-modified' };
  }
  const matchesExpected =
    sha256(plugin.bytes) === sha256(expectedPlugin) && sameIdentity(identity, expectedIdentity);
  return { ownership: matchesExpected ? 'managed' : 'managed-drift' };
}

function observeProfile(
  paths: OpenCodeProfilePaths,
  expectedPlugin: Buffer | string,
  expectedIdentity: OpenCodeIdentityV1,
): ProfileObservation {
  const plugin = observeFile(paths.plugin);
  const identity = parsedIdentity(observeFile(paths.identity));
  if (plugin.kind === 'collision' || identity.kind === 'collision') {
    return { ownership: 'collision' };
  }
  if (plugin.kind === 'absent' && identity.kind === 'absent') return { ownership: 'absent' };
  return identity.kind === 'absent'
    ? classifyWithoutIdentity(plugin, expectedIdentity)
    : classifyWithIdentity(plugin, identity.value, expectedPlugin, expectedIdentity);
}

function actionRequired(code: string, message: string, command: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'error' }],
    nextActions: [{ command, mutates: true, requiresHuman: true }],
  });
}

function writeManagedProfile(
  paths: OpenCodeProfilePaths,
  pluginBytes: Buffer | string,
  identity: OpenCodeIdentityV1,
): void {
  writeDurableFile(paths.plugin, pluginBytes, { mode: 0o600 });
  writeDurableFile(paths.identity, `${JSON.stringify(identity, undefined, 2)}\n`, { mode: 0o600 });
}

function removeEmptyDirectory(path: string): void {
  try {
    if (readdirSync(path).length === 0) rmdirSync(path);
  } catch {
    // A missing, non-empty, or inaccessible directory is not Safeword-owned cleanup work.
  }
}

function removeManagedProfile(paths: OpenCodeProfilePaths): void {
  rmSync(paths.plugin, { force: true });
  rmSync(paths.identity, { force: true });
  rmSync(paths.activation, { recursive: true, force: true });
  rmSync(paths.conformance, { recursive: true, force: true });
  rmSync(paths.profileError, { force: true });
  removeEmptyDirectory(nodePath.dirname(paths.plugin));
  removeEmptyDirectory(paths.safeword);
}

function terminalObservationResult(
  observation: ProfileObservation,
  operation: 'install' | 'uninstall',
): CliResult | undefined {
  if (observation.ownership === 'collision') {
    return actionRequired(
      'OPENCODE_PROFILE_COLLISION',
      'An OpenCode profile path contains unrecognized content; Safeword preserved it.',
      'safeword install --agents=opencode',
    );
  }
  if (operation === 'uninstall' && observation.detail === 'plugin-only') {
    return actionRequired(
      'OPENCODE_IDENTITY_MISSING',
      'The OpenCode plugin has no verifiable Safeword identity; Safeword preserved it.',
      'safeword install --agents=opencode',
    );
  }
  if (operation === 'uninstall' && observation.detail === 'plugin-modified') {
    return actionRequired(
      'OPENCODE_PLUGIN_DRIFT',
      'The managed OpenCode plugin was modified; Safeword preserved it.',
      'safeword install --agents=opencode',
    );
  }
  if (observation.ownership === 'absent' && operation === 'uninstall') {
    return createResult({ state: 'healthy' });
  }
  if (observation.ownership === 'managed' && operation === 'install') {
    return createResult({ state: 'healthy' });
  }
  return undefined;
}

export function reconcileOpenCodeProfile(input: ReconcileOpenCodeProfileInput): CliResult {
  const paths = openCodeProfilePaths(input.root);
  const initial = observeProfile(paths, input.pluginBytes, input.identity);
  const initialResult = terminalObservationResult(initial, input.operation);
  if (initialResult !== undefined) return initialResult;

  const lock = acquireProfileLock(paths.lock);
  if (lock === undefined) {
    return actionRequired(
      'OPENCODE_PROFILE_BUSY',
      'Another OpenCode profile change is in progress.',
      `safeword ${input.operation} --agents=opencode`,
    );
  }
  try {
    const current = observeProfile(paths, input.pluginBytes, input.identity);
    const currentResult = terminalObservationResult(current, input.operation);
    if (currentResult !== undefined) return currentResult;
    if (input.operation === 'install') {
      writeManagedProfile(paths, input.pluginBytes, input.identity);
    } else {
      removeManagedProfile(paths);
    }
    return createResult({ state: 'changed' });
  } finally {
    releaseProfileLock(lock);
    if (input.operation === 'uninstall') removeEmptyDirectory(paths.safeword);
  }
}
