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
import { generateOpenCodeCatalogueAssets, type OpenCodeCatalogueAsset } from './catalogue.js';
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
  readonly dispatcher: string;
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

const PROFILE_LOCK_WAIT_MS = 500;
const PROFILE_LOCK_RETRY_MS = 10;
const PROFILE_LOCK_SLEEP = new Int32Array(new SharedArrayBuffer(4));

export interface ReconcileOpenCodeProfileInput {
  readonly operation: 'install' | 'uninstall';
  readonly root: string;
  readonly pluginBytes: Buffer | string;
  readonly identity: OpenCodeIdentityV1;
  readonly dispatcherBytes?: Buffer;
  readonly catalogueAssets?: readonly OpenCodeCatalogueAsset[];
}

export interface ObserveOpenCodeProfileInput {
  readonly now?: number;
  readonly opencodeVersion?: string;
  readonly projectDirectory?: string;
}

function usable(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 || !nodePath.isAbsolute(trimmed)
    ? undefined
    : trimmed;
}

export function resolveOpenCodeConfigRoot(input: PlatformEnvironment): string | undefined {
  const explicit = input.env.OPENCODE_CONFIG_DIR?.trim();
  if (explicit !== undefined && explicit.length > 0 && !nodePath.isAbsolute(explicit)) {
    return undefined;
  }
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
    dispatcher: nodePath.join(safeword, 'dispatcher.mjs'),
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

function packagedTemplatesRoot(): string | undefined {
  const moduleDirectory = import.meta.dirname;
  return [
    nodePath.resolve(moduleDirectory, '../templates'),
    nodePath.resolve(moduleDirectory, '../../templates'),
  ].find(candidate => existsSync(nodePath.join(candidate, 'skills')));
}

export function installOpenCodeProfile(root: string): CliResult {
  const packagedPath = packagedDispatcherPath();
  const templatesRoot = packagedTemplatesRoot();
  if (packagedPath === undefined || templatesRoot === undefined) {
    return actionRequired(
      'OPENCODE_DISPATCHER_MISSING',
      'The packaged OpenCode dispatcher is unavailable.',
      'safeword install --agents=opencode',
    );
  }
  const dispatcherBytes = readFileSync(packagedPath);
  const paths = openCodeProfilePaths(root);
  const pluginBytes = generateOpenCodeProfilePlugin();
  const catalogueAssets = generateOpenCodeCatalogueAssets(templatesRoot);
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
      dispatcher_path: paths.dispatcher,
      dispatcher_sha256: sha256(dispatcherBytes),
      assets: catalogueAssets.map(asset => ({
        path: asset.relativePath,
        sha256: sha256(asset.content),
      })),
    },
    dispatcherBytes,
    catalogueAssets,
  });
}

function managedDispatcherProblem(
  paths: OpenCodeProfilePaths,
  identity: OpenCodeIdentityV1,
): CliResult | undefined {
  const dispatcher = observeFile(paths.dispatcher);
  if (dispatcher.kind === 'absent') return undefined;
  if (
    identity.dispatcher_path === paths.dispatcher &&
    dispatcher.kind === 'file' &&
    sha256(dispatcher.bytes) === identity.dispatcher_sha256
  ) {
    return undefined;
  }
  return humanActionRequired(
    'OPENCODE_DISPATCHER_DRIFT',
    'The OpenCode dispatcher path is not bound to the managed profile; Safeword preserved it.',
    `Inspect or move ${paths.dispatcher}, then rerun safeword uninstall --agents=opencode.`,
  );
}

export function uninstallOpenCodeProfile(root: string): CliResult {
  const paths = openCodeProfilePaths(root);
  const plugin = observeFile(paths.plugin);
  const identity = parsedIdentity(observeFile(paths.identity));
  if (plugin.kind === 'absent' && identity.kind === 'absent') {
    return createResult({ state: 'healthy' });
  }
  if (plugin.kind === 'file' && identity.kind === 'absent') {
    return actionRequired(
      'OPENCODE_IDENTITY_MISSING',
      'The OpenCode plugin has no verifiable Safeword identity; Safeword preserved it.',
      'safeword install --agents=opencode',
    );
  }
  if (plugin.kind === 'collision' || identity.kind !== 'identity') {
    return actionRequired(
      'OPENCODE_PROFILE_COLLISION',
      'An OpenCode profile path contains unrecognized content; Safeword preserved it.',
      'safeword install --agents=opencode',
    );
  }
  const dispatcherProblem = managedDispatcherProblem(paths, identity.value);
  if (dispatcherProblem !== undefined) return dispatcherProblem;
  return reconcileOpenCodeProfile({
    operation: 'uninstall',
    root,
    pluginBytes: plugin.kind === 'file' ? plugin.bytes : '',
    identity: identity.value,
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
  profileRemovable: boolean,
): CliResult | undefined {
  const unavailable = {
    installed: false,
    activated: false,
    pre_tool: 'unavailable',
    conformant: false,
    profile_removable: profileRemovable,
  } as const;
  if (plugin.kind !== 'file' || sha256(plugin.bytes) !== identity.plugin_sha256) {
    return actionRequired(
      'OPENCODE_PLUGIN_DRIFT',
      'The Safeword OpenCode plugin does not match its identity.',
      'safeword install --agents=opencode',
      unavailable,
    );
  }
  if (
    identity.safeword_version !== VERSION ||
    sha256(plugin.bytes) !== sha256(generateOpenCodeProfilePlugin())
  ) {
    return actionRequired(
      'OPENCODE_PROFILE_STALE',
      'The Safeword OpenCode profile does not match this Safeword version.',
      'safeword install --agents=opencode',
      unavailable,
    );
  }
  if (!hasCurrentDispatcher(identity)) {
    return actionRequired(
      'OPENCODE_DISPATCHER_UNAVAILABLE',
      'The identity-bound OpenCode dispatcher is unavailable.',
      'safeword install --agents=opencode',
      unavailable,
    );
  }
  return undefined;
}

function profileIsRemovable(
  paths: OpenCodeProfilePaths,
  plugin: FileObservation,
  identity: OpenCodeIdentityV1,
): boolean {
  if (managedDispatcherProblem(paths, identity) !== undefined) return false;
  return (
    plugin.kind === 'absent' ||
    (plugin.kind === 'file' && sha256(plugin.bytes) === identity.plugin_sha256)
  );
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

function hasCurrentActivation(
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
      record.name === `${record.value.project_sha256}-${record.value.event}.json` &&
      record.value.safeword_version === identity.safeword_version &&
      record.value.plugin_sha256 === identity.plugin_sha256 &&
      (record.value.event === 'plugin_load' || record.value.event === 'pre_tool') &&
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
  opencodeVersion: string | undefined,
): boolean {
  const evidence = record.value;
  return [
    record.name === `${evidence.opencode_version}-${identity.plugin_sha256}.json`,
    evidence.opencode_version.startsWith('1.'),
    opencodeVersion === undefined || evidence.opencode_version === opencodeVersion,
    evidence.safeword_version === identity.safeword_version,
    evidence.plugin_sha256 === identity.plugin_sha256,
    evidence.dispatcher_sha256 === identity.dispatcher_sha256,
    evidence.platform === process.platform,
    evidence.arch === process.arch,
    evidence.command_catalogue,
    evidence.agent_catalogue,
    evidence.denial,
    evidence.control,
    evidence.result === 'passed',
  ].every(Boolean);
}

function hasPassingConformance(
  directory: string,
  identity: OpenCodeIdentityV1,
  opencodeVersion: string | undefined,
): boolean {
  return readEvidence<OpenCodeConformanceV1>(directory, parseOpenCodeConformance).some(record =>
    isPassingConformance(record, identity, opencodeVersion),
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
  const activated = hasCurrentActivation(
    paths.activation,
    identity,
    input.now ?? Date.now(),
    expectedProjectSha256,
  );
  const conformant = hasPassingConformance(paths.conformance, identity, input.opencodeVersion);
  const data = {
    installed: true,
    activated,
    pre_tool: 'block',
    conformant,
    profile_removable: true,
  };
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
  return createResult({
    state: 'healthy',
    findings: [
      {
        code: 'OPENCODE_STOP_OBSERVATIONAL',
        message: 'OpenCode stop events are observed but cannot block the session from stopping.',
        severity: 'info',
      },
    ],
    data,
  });
}

const UNAVAILABLE_PROTECTION = {
  installed: false,
  activated: false,
  pre_tool: 'unavailable',
  conformant: false,
  profile_removable: false,
} as const;

function profilePresenceProblem(
  plugin: FileObservation,
  identityFile: FileObservation,
): CliResult | undefined {
  if (plugin.kind === 'absent' && identityFile.kind === 'absent') {
    return actionRequired(
      'OPENCODE_PROFILE_MISSING',
      'The Safeword OpenCode profile plugin is not installed.',
      'safeword install --agents=opencode',
      UNAVAILABLE_PROTECTION,
    );
  }
  if (plugin.kind === 'file' && identityFile.kind === 'absent') {
    return actionRequired(
      'OPENCODE_IDENTITY_MISSING',
      'The OpenCode plugin has no verifiable Safeword identity.',
      'safeword install --agents=opencode',
      UNAVAILABLE_PROTECTION,
    );
  }
  if (plugin.kind === 'collision' || identityFile.kind !== 'file') {
    return actionRequired(
      'OPENCODE_PROFILE_COLLISION',
      'The Safeword OpenCode profile cannot be verified.',
      'safeword install --agents=opencode',
      UNAVAILABLE_PROTECTION,
    );
  }
  return undefined;
}

export function observeOpenCodeProfile(
  root: string,
  input: ObserveOpenCodeProfileInput = {},
): CliResult {
  const paths = openCodeProfilePaths(root);
  const plugin = observeFile(paths.plugin);
  const identityFile = observeFile(paths.identity);
  const presenceProblem = profilePresenceProblem(plugin, identityFile);
  if (presenceProblem !== undefined) return presenceProblem;
  if (identityFile.kind !== 'file') {
    return actionRequired(
      'OPENCODE_PROFILE_COLLISION',
      'The Safeword OpenCode profile cannot be verified.',
      'safeword install --agents=opencode',
      UNAVAILABLE_PROTECTION,
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
      UNAVAILABLE_PROTECTION,
    );
  }
  const profileRemovable = profileIsRemovable(paths, plugin, identity);
  const bindingProblem = observeIdentityBindings(plugin, identity, profileRemovable);
  if (bindingProblem !== undefined) return bindingProblem;
  if (hasCurrentProfileError(paths.profileError, identity)) {
    return actionRequired(
      'OPENCODE_MARKER_RESOLUTION_FAILED',
      'OpenCode project classification could not be verified.',
      'safeword install --agents=opencode',
      {
        installed: true,
        activated: false,
        pre_tool: 'block',
        conformant: false,
        profile_removable: profileRemovable,
      },
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

function humanActionRequired(code: string, message: string, instruction: string): CliResult {
  return createResult({
    state: 'action_required',
    findings: [{ code, message, severity: 'error' }],
    nextActions: [{ kind: 'human', instruction, mutates: false, requiresHuman: true }],
  });
}

interface ManagedProfileWrite {
  readonly root: string;
  readonly paths: OpenCodeProfilePaths;
  readonly pluginBytes: Buffer | string;
  readonly identity: OpenCodeIdentityV1;
  readonly dispatcherBytes: Buffer | undefined;
  readonly catalogueAssets: readonly OpenCodeCatalogueAsset[];
}

function writeManagedProfile(input: ManagedProfileWrite): void {
  const { root, paths, pluginBytes, identity, dispatcherBytes, catalogueAssets } = input;
  const previous = parsedIdentity(observeFile(paths.identity));
  const desiredPaths = new Set(catalogueAssets.map(asset => asset.relativePath));
  if (previous.kind === 'identity') {
    const previousAssets = previous.value.assets ?? [];
    for (const asset of previousAssets) {
      if (!desiredPaths.has(asset.path)) rmSync(nodePath.join(root, asset.path), { force: true });
    }
  }
  if (dispatcherBytes !== undefined) {
    writeDurableFile(paths.dispatcher, dispatcherBytes, { mode: 0o600 });
  }
  writeDurableFile(paths.plugin, pluginBytes, { mode: 0o600 });
  for (const asset of catalogueAssets) {
    writeDurableFile(
      nodePath.join(nodePath.dirname(paths.plugin), '..', asset.relativePath),
      asset.content,
      { mode: 0o600 },
    );
  }
  writeDurableFile(paths.identity, `${JSON.stringify(identity, undefined, 2)}\n`, { mode: 0o600 });
}

function retiredCatalogueProblem(
  input: ReconcileOpenCodeProfileInput,
  installed: IdentityObservation,
  desiredPaths: ReadonlySet<string>,
): CliResult | undefined {
  if (installed.kind !== 'identity') return undefined;
  const installedAssets = installed.value.assets ?? [];
  for (const asset of installedAssets) {
    if (desiredPaths.has(asset.path)) continue;
    const observed = observeFile(nodePath.join(input.root, asset.path));
    if (
      observed.kind === 'absent' ||
      (observed.kind === 'file' && sha256(observed.bytes) === asset.sha256)
    )
      continue;
    return humanActionRequired(
      'OPENCODE_MANAGED_ASSET_DRIFT',
      `The retired OpenCode profile asset ${asset.path} was modified; Safeword preserved it.`,
      `Move ${nodePath.join(input.root, asset.path)} aside, then rerun safeword install --agents=opencode.`,
    );
  }
  return undefined;
}

function removeEmptyDirectory(path: string): void {
  try {
    if (readdirSync(path).length === 0) rmdirSync(path);
  } catch {
    // A missing, non-empty, or inaccessible directory is not Safeword-owned cleanup work.
  }
}

function managedCatalogueProblem(input: ReconcileOpenCodeProfileInput): CliResult | undefined {
  if (input.operation !== 'install') return undefined;
  const installed = parsedIdentity(observeFile(openCodeProfilePaths(input.root).identity));
  const catalogueAssets = input.catalogueAssets ?? [];
  const desiredPaths = new Set(catalogueAssets.map(asset => asset.relativePath));
  for (const asset of catalogueAssets) {
    const observed = observeFile(nodePath.join(input.root, asset.relativePath));
    const previous =
      installed.kind === 'identity'
        ? installed.value.assets?.find(candidate => candidate.path === asset.relativePath)
        : undefined;
    if (catalogueAssetRecognized(observed, asset.content, previous?.sha256)) continue;
    return humanActionRequired(
      'OPENCODE_CATALOGUE_COLLISION',
      `The OpenCode profile asset ${asset.relativePath} contains unrecognized content; Safeword preserved it.`,
      `Move ${nodePath.join(input.root, asset.relativePath)} aside, then rerun safeword install --agents=opencode.`,
    );
  }
  return retiredCatalogueProblem(input, installed, desiredPaths);
}

function catalogueAssetRecognized(
  observed: FileObservation,
  desired: string,
  previousHash: string | undefined,
): boolean {
  if (observed.kind === 'absent') return true;
  if (observed.kind !== 'file') return false;
  const observedHash = sha256(observed.bytes);
  return observedHash === sha256(desired) || observedHash === previousHash;
}

function managedAssetProblem(root: string, identity: OpenCodeIdentityV1): CliResult | undefined {
  const assets = identity.assets ?? [];
  for (const asset of assets) {
    const path = nodePath.join(root, asset.path);
    const observed = observeFile(path);
    if (
      observed.kind === 'absent' ||
      (observed.kind === 'file' && sha256(observed.bytes) === asset.sha256)
    )
      continue;
    return humanActionRequired(
      'OPENCODE_MANAGED_ASSET_DRIFT',
      `The managed OpenCode asset ${path} was modified; Safeword preserved the profile.`,
      `Move ${path} aside, then rerun safeword uninstall --agents=opencode.`,
    );
  }
  return undefined;
}

function removeManagedProfile(
  root: string,
  paths: OpenCodeProfilePaths,
  identity: OpenCodeIdentityV1,
): void {
  const assets = identity.assets ?? [];
  for (const asset of assets) rmSync(nodePath.join(root, asset.path), { force: true });
  rmSync(paths.plugin, { force: true });
  rmSync(paths.identity, { force: true });
  rmSync(paths.dispatcher, { force: true });
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

function dispatcherInstallProblem(
  paths: OpenCodeProfilePaths,
  input: ReconcileOpenCodeProfileInput,
): CliResult | undefined {
  if (input.operation !== 'install' || input.dispatcherBytes === undefined) return undefined;
  const dispatcher = observeFile(paths.dispatcher);
  if (dispatcher.kind === 'absent') return undefined;
  if (dispatcher.kind === 'file' && sha256(dispatcher.bytes) === sha256(input.dispatcherBytes)) {
    return undefined;
  }
  const identity = parsedIdentity(observeFile(paths.identity));
  const recognized =
    identity.kind === 'identity' && identity.value.dispatcher_path === paths.dispatcher;
  return recognized
    ? undefined
    : humanActionRequired(
        'OPENCODE_DISPATCHER_COLLISION',
        'The OpenCode dispatcher path contains unrecognized content; Safeword preserved it.',
        `Move or remove ${paths.dispatcher}, then rerun safeword install --agents=opencode.`,
      );
}

function dispatcherMatchesExpected(
  paths: OpenCodeProfilePaths,
  input: ReconcileOpenCodeProfileInput,
): boolean {
  if (input.operation !== 'install' || input.dispatcherBytes === undefined) return true;
  const dispatcher = observeFile(paths.dispatcher);
  return dispatcher.kind === 'file' && sha256(dispatcher.bytes) === sha256(input.dispatcherBytes);
}

function terminalUnlessDispatcherNeedsRepair(
  paths: OpenCodeProfilePaths,
  input: ReconcileOpenCodeProfileInput,
  observation: ProfileObservation,
): CliResult | undefined {
  const terminal = terminalObservationResult(observation, input.operation);
  return input.operation === 'install' && !dispatcherMatchesExpected(paths, input)
    ? undefined
    : terminal;
}

function acquireOpenCodeProfileLock(path: string): ReturnType<typeof acquireProfileLock> {
  const deadline = Date.now() + PROFILE_LOCK_WAIT_MS;
  let lock = acquireProfileLock(path);
  while (lock === undefined && Date.now() < deadline) {
    Atomics.wait(PROFILE_LOCK_SLEEP, 0, 0, PROFILE_LOCK_RETRY_MS);
    lock = acquireProfileLock(path);
  }
  return lock;
}

function profileMutationProblem(
  paths: OpenCodeProfilePaths,
  input: ReconcileOpenCodeProfileInput,
): CliResult | undefined {
  const catalogueProblem = managedCatalogueProblem(input);
  if (catalogueProblem !== undefined) return catalogueProblem;
  const assetProblem =
    input.operation === 'uninstall' ? managedAssetProblem(input.root, input.identity) : undefined;
  return assetProblem ?? dispatcherInstallProblem(paths, input);
}

export function reconcileOpenCodeProfile(input: ReconcileOpenCodeProfileInput): CliResult {
  const paths = openCodeProfilePaths(input.root);
  const initialProblem = profileMutationProblem(paths, input);
  if (initialProblem !== undefined) return initialProblem;
  const initial = observeProfile(paths, input.pluginBytes, input.identity);
  const initialResult = terminalUnlessDispatcherNeedsRepair(paths, input, initial);
  if (initialResult !== undefined) return initialResult;

  const lock = acquireOpenCodeProfileLock(paths.lock);
  if (lock === undefined) {
    return actionRequired(
      'OPENCODE_PROFILE_BUSY',
      'Another OpenCode profile change is in progress.',
      `safeword ${input.operation} --agents=opencode`,
    );
  }
  try {
    const currentProblem = profileMutationProblem(paths, input);
    if (currentProblem !== undefined) return currentProblem;
    const current = observeProfile(paths, input.pluginBytes, input.identity);
    const currentResult = terminalUnlessDispatcherNeedsRepair(paths, input, current);
    if (currentResult !== undefined) return currentResult;
    if (input.operation === 'install') {
      writeManagedProfile({
        root: input.root,
        paths,
        pluginBytes: input.pluginBytes,
        identity: input.identity,
        dispatcherBytes: input.dispatcherBytes,
        catalogueAssets: input.catalogueAssets ?? [],
      });
    } else {
      removeManagedProfile(input.root, paths, input.identity);
    }
    return createResult({ state: 'changed' });
  } finally {
    releaseProfileLock(lock);
    if (input.operation === 'uninstall') removeEmptyDirectory(paths.safeword);
  }
}

export { generateOpenCodeProfilePlugin } from './plugin.js';
