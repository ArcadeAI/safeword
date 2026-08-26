import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
} from 'node:fs';
import nodePath from 'node:path';

import { type CliResult, createResult } from '../cli-protocol/result.js';
import { writeDurableFile } from '../codex-plugin/durable-write.js';
import { acquireProfileLock, releaseProfileLock } from '../utils/profile-lock.js';
import { VERSION } from '../version.js';
import {
  type OpenCodeActivationV1,
  type OpenCodeConformanceV1,
  parseOpenCodeActivation,
  parseOpenCodeConformance,
  parseOpenCodeProfileError,
} from './evidence.js';
import { type OpenCodeIdentityV1, parseOpenCodeIdentity } from './identity.js';
import { generateOpenCodeProfilePlugin } from './plugin.js';

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

export interface ObserveOpenCodeProfileInput {
  readonly now?: number;
  readonly projectDirectory?: string;
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

function packagedDispatcherPath(): string | undefined {
  const moduleDirectory = import.meta.dirname;
  return [
    nodePath.join(moduleDirectory, 'opencode', 'dispatcher.js'),
    nodePath.resolve(moduleDirectory, '../../dist/opencode/dispatcher.js'),
  ].find(candidate => existsSync(candidate));
}

export function installOpenCodeProfile(root: string): CliResult {
  const dispatcherPath = packagedDispatcherPath();
  if (dispatcherPath === undefined) {
    return actionRequired(
      'OPENCODE_DISPATCHER_MISSING',
      'The packaged OpenCode dispatcher is unavailable.',
      'safeword install --agents=opencode',
    );
  }
  const pluginBytes = generateOpenCodeProfilePlugin();
  return reconcileOpenCodeProfile({
    operation: 'install',
    root,
    pluginBytes,
    identity: {
      schema_version: 1,
      safeword_version: VERSION,
      plugin_path: 'plugins/safeword.js',
      plugin_sha256: sha256(pluginBytes),
      runtime_path: process.execPath,
      dispatcher_path: dispatcherPath,
      dispatcher_sha256: sha256(readFileSync(dispatcherPath)),
    },
  });
}

function hasCurrentProfileError(path: string, identity: OpenCodeIdentityV1): boolean {
  const profileError = observeFile(path);
  if (profileError.kind !== 'file') return false;
  try {
    const parsed = parseOpenCodeProfileError(JSON.parse(profileError.bytes.toString('utf8')));
    return (
      parsed?.safeword_version === identity.safeword_version &&
      parsed.plugin_sha256 === identity.plugin_sha256
    );
  } catch {
    return false;
  }
}

function hasCurrentDispatcher(identity: OpenCodeIdentityV1): boolean {
  const dispatcher = observeFile(identity.dispatcher_path);
  return dispatcher.kind === 'file' && sha256(dispatcher.bytes) === identity.dispatcher_sha256;
}

function observeIdentityBindings(
  plugin: FileObservation,
  identity: OpenCodeIdentityV1,
): CliResult | undefined {
  if (plugin.kind !== 'file' || sha256(plugin.bytes) !== identity.plugin_sha256) {
    return actionRequired(
      'OPENCODE_PLUGIN_DRIFT',
      'The Safeword OpenCode plugin does not match its identity.',
      'safeword install --agents=opencode',
    );
  }
  if (!hasCurrentDispatcher(identity)) {
    return actionRequired(
      'OPENCODE_DISPATCHER_UNAVAILABLE',
      'The identity-bound OpenCode dispatcher is unavailable.',
      'safeword install --agents=opencode',
      { installed: true, activated: false, pre_tool: 'block' },
    );
  }
  return undefined;
}

interface NamedEvidence<T> {
  readonly name: string;
  readonly value: T;
}

function readEvidence<T>(
  directory: string,
  parse: (value: unknown) => T | undefined,
): readonly NamedEvidence<T>[] {
  let names: string[];
  try {
    names = readdirSync(directory);
  } catch {
    return [];
  }
  const records: NamedEvidence<T>[] = [];
  for (const name of names) {
    const file = observeFile(nodePath.join(directory, name));
    if (file.kind !== 'file') continue;
    try {
      const value = parse(JSON.parse(file.bytes.toString('utf8')));
      if (value !== undefined) records.push({ name, value });
    } catch {
      // Malformed evidence is ignored rather than promoted into proof.
    }
  }
  return records;
}

function hasCurrentPreToolActivation(
  directory: string,
  identity: OpenCodeIdentityV1,
  now: number,
  expectedProjectSha256: string | undefined,
): boolean {
  const maximumAge = 7 * 24 * 60 * 60 * 1000;
  return readEvidence<OpenCodeActivationV1>(directory, parseOpenCodeActivation).some(record => {
    const observedAt = Date.parse(record.value.observed_at);
    const age = now - observedAt;
    return (
      record.name === `${record.value.project_sha256}.json` &&
      record.value.safeword_version === identity.safeword_version &&
      record.value.plugin_sha256 === identity.plugin_sha256 &&
      record.value.event === 'pre_tool' &&
      (expectedProjectSha256 === undefined ||
        record.value.project_sha256 === expectedProjectSha256) &&
      age >= 0 &&
      age <= maximumAge
    );
  });
}

function isPassingConformance(
  record: NamedEvidence<OpenCodeConformanceV1>,
  identity: OpenCodeIdentityV1,
): boolean {
  const evidence = record.value;
  return [
    record.name === `${evidence.opencode_version}-${identity.plugin_sha256}.json`,
    evidence.opencode_version.startsWith('1.'),
    evidence.safeword_version === identity.safeword_version,
    evidence.plugin_sha256 === identity.plugin_sha256,
    evidence.platform === process.platform,
    evidence.arch === process.arch,
    evidence.command_catalogue,
    evidence.agent_catalogue,
    evidence.denial,
    evidence.control,
    evidence.result === 'passed',
  ].every(Boolean);
}

function hasPassingConformance(directory: string, identity: OpenCodeIdentityV1): boolean {
  return readEvidence<OpenCodeConformanceV1>(directory, parseOpenCodeConformance).some(record =>
    isPassingConformance(record, identity),
  );
}

function observeProtectionEvidence(
  paths: OpenCodeProfilePaths,
  identity: OpenCodeIdentityV1,
  input: ObserveOpenCodeProfileInput,
): CliResult {
  let expectedProjectSha256: string | undefined;
  try {
    expectedProjectSha256 =
      input.projectDirectory === undefined
        ? undefined
        : sha256(realpathSync(input.projectDirectory));
  } catch {
    expectedProjectSha256 = '';
  }
  const activated = hasCurrentPreToolActivation(
    paths.activation,
    identity,
    input.now ?? Date.now(),
    expectedProjectSha256,
  );
  const conformant = hasPassingConformance(paths.conformance, identity);
  const data = { installed: true, activated, pre_tool: 'block', conformant };
  if (!conformant) {
    return actionRequired(
      'OPENCODE_CONFORMANCE_REQUIRED',
      'This OpenCode version has not passed conformance for the installed Safeword plugin.',
      'safeword conformance --agents=opencode',
      data,
    );
  }
  if (conformant && !activated) {
    return createResult({
      state: 'action_required',
      findings: [
        {
          code: 'OPENCODE_ACTIVATION_REQUIRED',
          message: 'OpenCode has not loaded the current Safeword protection.',
          severity: 'error',
        },
      ],
      nextActions: [
        {
          kind: 'human',
          instruction: 'Fully restart OpenCode, then reopen this project.',
          mutates: false,
          requiresHuman: true,
        },
      ],
      data,
    });
  }
  return createResult({ state: 'healthy', data });
}

export function observeOpenCodeProfile(
  root: string,
  input: ObserveOpenCodeProfileInput = {},
): CliResult {
  const paths = openCodeProfilePaths(root);
  const plugin = observeFile(paths.plugin);
  const identityFile = observeFile(paths.identity);
  if (plugin.kind === 'absent' && identityFile.kind === 'absent') {
    return actionRequired(
      'OPENCODE_PROFILE_MISSING',
      'The Safeword OpenCode profile plugin is not installed.',
      'safeword install --agents=opencode',
      { installed: false, activated: false, pre_tool: 'unavailable', conformant: false },
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
  const bindingProblem = observeIdentityBindings(plugin, identity);
  if (bindingProblem !== undefined) return bindingProblem;
  if (hasCurrentProfileError(paths.profileError, identity)) {
    return actionRequired(
      'OPENCODE_MARKER_RESOLUTION_FAILED',
      'OpenCode project classification could not be verified.',
      'safeword install --agents=opencode',
      { installed: true, activated: false, pre_tool: 'block' },
    );
  }
  return observeProtectionEvidence(paths, identity, input);
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

function actionRequired(
  code: string,
  message: string,
  command: string,
  data?: Record<string, unknown>,
): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'error' }],
    nextActions: [{ command, mutates: true, requiresHuman: true }],
    data,
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

export { generateOpenCodeProfilePlugin } from './plugin.js';
