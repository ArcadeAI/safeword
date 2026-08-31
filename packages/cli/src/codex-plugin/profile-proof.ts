/* eslint-disable unicorn/no-null -- versioned JSON uses explicit null for unavailable values */

import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  rmdirSync,
  rmSync,
  type Stats,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { SAFEWORD_SCHEMA } from '../schema.js';
import { writeDurableFile } from './durable-write.js';
import {
  type CodexHostProcessIdentity,
  type CodexHostProcessObservation,
  observeCodexHostProcesses,
  sameCodexHost,
} from './host-process.js';

export type { CodexHostProcessIdentity } from './host-process.js';

export interface CodexPluginIdentity {
  plugin_version: string;
  manifest_sha256: string;
}

export interface CodexHookProofV2 {
  schema_version: 2;
  event: CodexPluginHookEvent;
  plugin_version: string;
  manifest_sha256: string;
  activation_id: string | null;
  recorded_at: string;
}

export interface CodexHookProofV3 extends CodexPluginIdentity {
  schema_version: 3;
  event: CodexPluginHookEvent;
  activation_id: string | null;
  project_directory: string;
  session_id: string;
  recorded_at: string;
}

interface CodexSessionProofV1 extends CodexPluginIdentity {
  schema_version: 1;
  project_directory: string;
  session_id: string;
  recorded_at: string;
}

interface CodexSessionProofV2 extends CodexPluginIdentity {
  schema_version: 2;
  activation_id: string | null;
  project_directory: string;
  session_id: string;
  recorded_at: string;
}

type CodexSessionProof = CodexSessionProofV1 | CodexSessionProofV2;

export type CodexSessionProofStatus =
  'activation-pending' | 'current' | 'prior-observed' | 'missing' | 'untrusted';

export interface CodexSessionProofObservation {
  status: CodexSessionProofStatus;
  plugin_version: string | null;
  manifest_sha256: string | null;
  recorded_at: string | null;
}

const SHA256_PATTERN = /^[a-f\d]{64}$/u;
const NUMERIC_VERSION_PART_PATTERN = /^\d+$/u;
const VERSION_IDENTIFIER_PATTERN = /^[\dA-Za-z-]+$/u;
const MAX_PLUGIN_VERSION_LENGTH = 128;
const MAX_RETAINED_SESSION_PROOFS_PER_PROJECT = 256;
const MAX_RETAINED_SESSION_PROOF_PROJECTS = 64;

interface CodexActivationMarkerV1 {
  schema_version: 1;
  plugin_version: string;
  manifest_sha256: string;
}

export interface CodexActivationMarkerV2 {
  schema_version: 2;
  plugin_version: string;
  manifest_sha256: string;
  activation_id: string;
  installed_at: string;
  host_observation: 'observed' | 'unavailable';
  active_hosts: CodexHostProcessIdentity[];
}

interface CodexActivationReceiptV1 {
  schema_version: 1;
  plugin_version: string;
  manifest_sha256: string;
  activation_id: string;
  activated_at: string;
  host: CodexHostProcessIdentity;
}

export const CODEX_PLUGIN_HOOK_EVENTS = [
  'session-start',
  'pre-tool-use',
  'post-tool-use',
  'user-prompt-submit',
  'stop',
] as const;
export type CodexPluginHookEvent = (typeof CODEX_PLUGIN_HOOK_EVENTS)[number];

type CodexHookProofStatus = 'current' | 'partial' | 'missing' | 'stale' | 'malformed';

export interface CodexHookProofObservation {
  status: CodexHookProofStatus;
  plugin_version: string | null;
  manifest_sha256: string | null;
  recorded_at: string | null;
  activation_id: string | null;
  events: readonly CodexPluginHookEvent[];
  missing_events: readonly CodexPluginHookEvent[];
}

function codexProfileDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  const configuredHome = environment.CODEX_HOME?.trim();
  return configuredHome || nodePath.join(homedir(), '.codex');
}

export function codexProofPath(
  environment: NodeJS.ProcessEnv = process.env,
  event: CodexPluginHookEvent = 'session-start',
): string {
  return nodePath.join(
    codexProfileDirectory(environment),
    'safeword/hook-proof-v2',
    `${event}.json`,
  );
}

function canonicalProjectDirectory(projectDirectory: string): string {
  try {
    return realpathSync(projectDirectory);
  } catch {
    return nodePath.resolve(projectDirectory);
  }
}

function codexSessionProofPath(
  projectDirectory: string,
  sessionId: string,
  environment: NodeJS.ProcessEnv,
): string {
  // The directory suffix versions the storage layout, independently from the
  // schema_version inside each retained proof record.
  const project = canonicalProjectDirectory(projectDirectory);
  const projectDigest = createHash('sha256').update(project).digest('hex');
  const sessionDigest = createHash('sha256').update(sessionId).digest('hex');
  return nodePath.join(
    codexProfileDirectory(environment),
    'safeword/session-proof-v1',
    projectDigest,
    `${sessionDigest}.json`,
  );
}

function legacyCodexActivationMarkerPath(environment: NodeJS.ProcessEnv = process.env): string {
  return nodePath.join(codexProfileDirectory(environment), 'safeword/activation-pending-v1.json');
}

function codexActivationMarkerPath(environment: NodeJS.ProcessEnv = process.env): string {
  return nodePath.join(codexProfileDirectory(environment), 'safeword/activation-pending-v2.json');
}

function codexActivationReceiptPath(environment: NodeJS.ProcessEnv = process.env): string {
  return nodePath.join(codexProfileDirectory(environment), 'safeword/activation-current-v1.json');
}

function legacyCodexRestartMarkerPath(environment: NodeJS.ProcessEnv = process.env): string {
  return nodePath.join(codexProfileDirectory(environment), 'safeword/restart-pending-v1.json');
}

export function codexActivationIsPending(environment: NodeJS.ProcessEnv = process.env): boolean {
  try {
    return activationIsPendingForIdentity(environment, currentCodexPluginIdentity());
  } catch {
    return true;
  }
}

export function codexActivationRestartWasObserved(
  environment: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  options: { hostObservation?: CodexHostProcessObservation } = {},
): boolean {
  try {
    const identity = currentCodexPluginIdentity();
    const marker = readActivationMarkerV2(environment, identity);
    if (marker === null) return false;
    return (
      activationReceiptForRestart(
        marker,
        options.hostObservation ?? observeCodexHostProcesses(),
        identity,
        now,
      ) !== null
    );
  } catch {
    return false;
  }
}

export function codexActivationRestartIsProven(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    return readActivationReceipt(environment, currentCodexPluginIdentity()) !== null;
  } catch {
    return false;
  }
}

function activationIsPendingForIdentity(
  environment: NodeJS.ProcessEnv,
  identity: CodexPluginIdentity,
): boolean {
  return (
    // The canonical marker is written atomically. If it exists but cannot be
    // parsed or matched, fail closed instead of accepting unbound hook proof.
    existsSync(codexActivationMarkerPath(environment)) ||
    [legacyCodexActivationMarkerPath(environment), legacyCodexRestartMarkerPath(environment)].some(
      path => legacyActivationMarkerMatches(path, identity),
    )
  );
}

export type CodexActivationMarkerIssue = 'identity-mismatch' | 'malformed' | 'package-unavailable';

export function codexActivationMarkerIssue(
  environment: NodeJS.ProcessEnv = process.env,
): CodexActivationMarkerIssue | undefined {
  const markerPath = codexActivationMarkerPath(environment);
  if (!existsSync(markerPath)) return undefined;
  let identity: CodexPluginIdentity;
  try {
    identity = currentCodexPluginIdentity();
  } catch {
    return 'package-unavailable';
  }
  try {
    const marker = readTrustedHookProofJson(markerPath);
    if (!isActivationMarkerV2(marker)) return 'malformed';
    return matchesCodexPluginIdentity(marker, identity) ? undefined : 'identity-mismatch';
  } catch {
    return 'malformed';
  }
}

function packagedHookManifestPath(): string {
  const candidates = [
    nodePath.resolve(import.meta.dirname, '../codex-plugin/hooks.json'),
    nodePath.resolve(import.meta.dirname, '../../codex-plugin/hooks.json'),
  ];
  const manifest = candidates.find(candidate => existsSync(candidate));
  if (manifest === undefined) {
    throw new Error('Could not locate the packaged Codex hook manifest.');
  }
  return manifest;
}

export const currentCodexPluginIdentity = (() => {
  let cachedIdentity: CodexPluginIdentity | undefined;
  return (): CodexPluginIdentity => {
    cachedIdentity ??= (() => {
      const manifest = readFileSync(packagedHookManifestPath());
      return {
        plugin_version: SAFEWORD_SCHEMA.version,
        manifest_sha256: createHash('sha256').update(manifest).digest('hex'),
      };
    })();
    return cachedIdentity;
  };
})();

function matchesCodexPluginIdentity(
  value: { plugin_version?: unknown; manifest_sha256?: unknown },
  identity: CodexPluginIdentity,
): boolean {
  return (
    value.plugin_version === identity.plugin_version &&
    value.manifest_sha256 === identity.manifest_sha256
  );
}

export function writeCodexActivationMarker(
  environment: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  options: {
    activationId?: string;
    activeHosts?: CodexHostProcessIdentity[] | null;
    hostObservation?: CodexHostProcessObservation;
  } = {},
): CodexActivationMarkerV2 {
  const path = codexActivationMarkerPath(environment);
  const activeHosts = activeHostsForMarker(options);
  const marker: CodexActivationMarkerV2 = {
    schema_version: 2,
    ...currentCodexPluginIdentity(),
    activation_id: options.activationId ?? randomUUID(),
    installed_at: now.toISOString(),
    host_observation: activeHosts === null ? 'unavailable' : 'observed',
    active_hosts: activeHosts ?? [],
  };
  writeAtomicJson(path, marker);
  // A new installation invalidates every earlier execution proof. The v2
  // marker is the only authority until SessionStart proves a different Codex
  // app-server loaded the installed plugin catalogue.
  for (const event of CODEX_PLUGIN_HOOK_EVENTS)
    rmSync(codexProofPath(environment, event), { force: true });
  rmSync(nodePath.join(codexProfileDirectory(environment), 'safeword/hook-proof-v1'), {
    recursive: true,
    force: true,
  });
  // Task-bound SessionStart history is intentionally retained. Exact-current
  // checks still reject it after this marker is written, while bootstrap can
  // distinguish a previously observed runtime from wholly unobserved
  // protection in the already-open task.
  rmSync(codexActivationReceiptPath(environment), { force: true });
  rmSync(legacyCodexActivationMarkerPath(environment), { force: true });
  rmSync(legacyCodexRestartMarkerPath(environment), { force: true });
  return marker;
}

function activeHostsForMarker(options: {
  activeHosts?: CodexHostProcessIdentity[] | null;
  hostObservation?: CodexHostProcessObservation;
}): CodexHostProcessIdentity[] | null {
  if (options.activeHosts !== undefined) {
    return options.activeHosts;
  }
  const observation = options.hostObservation ?? observeCodexHostProcesses();
  if (!observation.available) return null;
  const activeHosts = [...observation.running];
  const currentHost = observation.current;
  if (currentHost !== null && activeHosts.every(host => !sameCodexHost(host, currentHost))) {
    activeHosts.push(currentHost);
  }
  return activeHosts;
}

function hostObservationForOverride(
  current: CodexHostProcessIdentity | null = null,
): CodexHostProcessObservation {
  return {
    available: true,
    current,
    running: current === null ? [] : [current],
  };
}

function activationReceiptForRestart(
  marker: CodexActivationMarkerV2,
  hostObservation: CodexHostProcessObservation,
  identity: CodexPluginIdentity,
  now: Date,
): CodexActivationReceiptV1 | null {
  const currentHost = hostObservation.current;
  const installedAt = Date.parse(marker.installed_at);
  if (
    !hostObservation.available ||
    currentHost === null ||
    marker.host_observation !== 'observed' ||
    now.getTime() < installedAt ||
    Date.parse(currentHost.started_at) < installedAt ||
    marker.active_hosts.some(installedHost => sameCodexHost(installedHost, currentHost)) ||
    marker.active_hosts.some(installedHost =>
      hostObservation.running.some(runningHost => sameCodexHost(installedHost, runningHost)),
    )
  ) {
    return null;
  }
  return {
    schema_version: 1,
    ...identity,
    activation_id: marker.activation_id,
    activated_at: now.toISOString(),
    host: currentHost,
  };
}

// eslint-disable-next-line complexity -- coordinates optional host overrides with durable proof writes
export function recordCodexHookProof(
  event: CodexPluginHookEvent,
  environment: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  writeOptions: {
    beforeRename?: () => void;
    currentHost?: CodexHostProcessIdentity | null;
    hostObservation?: CodexHostProcessObservation;
    projectDirectory?: string;
    sessionId?: string;
  } = {},
): CodexHookProofV2 | CodexHookProofV3 {
  const identity = currentCodexPluginIdentity();
  const marker = readActivationMarkerV2(environment, identity);
  let receipt = readActivationReceipt(environment, identity);
  if (event === 'session-start' && marker !== null) {
    const hostObservation =
      writeOptions.hostObservation ??
      ('currentHost' in writeOptions
        ? hostObservationForOverride(writeOptions.currentHost)
        : observeCodexHostProcesses());
    const restartedReceipt = activationReceiptForRestart(marker, hostObservation, identity, now);
    if (restartedReceipt !== null) {
      receipt = restartedReceipt;
      writeAtomicJson(codexActivationReceiptPath(environment), receipt);
      rmSync(codexActivationMarkerPath(environment), { force: true });
    }
  }
  const projectDirectory =
    writeOptions.projectDirectory === undefined
      ? undefined
      : canonicalProjectDirectory(writeOptions.projectDirectory);
  const sessionId = writeOptions.sessionId?.trim();
  const activationId = activeCodexActivationId(marker, receipt);
  const recordedAt = now.toISOString();
  const proof: CodexHookProofV2 | CodexHookProofV3 =
    projectDirectory !== undefined && sessionId
      ? {
          schema_version: 3,
          event,
          ...identity,
          activation_id: activationId,
          project_directory: projectDirectory,
          session_id: sessionId,
          recorded_at: recordedAt,
        }
      : {
          schema_version: 2,
          event,
          ...identity,
          activation_id: activationId,
          recorded_at: recordedAt,
        };
  writeAtomicJson(codexProofPath(environment, event), proof, writeOptions);
  if (event === 'session-start' && projectDirectory !== undefined && sessionId) {
    const sessionProof: CodexSessionProofV2 = {
      schema_version: 2,
      ...identity,
      activation_id: activationId,
      project_directory: projectDirectory,
      session_id: sessionId,
      recorded_at: recordedAt,
    };
    const path = codexSessionProofPath(projectDirectory, sessionId, environment);
    writeAtomicJson(path, sessionProof);
    pruneCodexSessionProofs(path);
  }
  return proof;
}

export function codexSessionProofIsCurrent(
  projectDirectory: string,
  sessionId: string,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return observeCodexSessionProof(projectDirectory, sessionId, environment).status === 'current';
}

function validSessionProof(
  value: unknown,
  canonicalProject: string,
  sessionId: string,
): value is CodexSessionProof {
  if (typeof value !== 'object' || value === null) return false;
  const proof = value as Record<string, unknown>;
  return (
    sessionProofBindingMatches(proof, canonicalProject, sessionId) &&
    sessionProofIdentityIsWellFormed(proof) &&
    sessionProofTimeIsWellFormed(proof)
  );
}

function sessionProofBindingMatches(
  proof: Record<string, unknown>,
  canonicalProject: string,
  sessionId: string,
): boolean {
  return (
    (proof.schema_version === 1 || proof.schema_version === 2) &&
    proof.project_directory === canonicalProject &&
    proof.session_id === sessionId &&
    (proof.schema_version === 1 ||
      typeof proof.activation_id === 'string' ||
      proof.activation_id === null)
  );
}

function sessionProofIdentityIsWellFormed(proof: Record<string, unknown>): boolean {
  return (
    pluginVersionIsWellFormed(proof.plugin_version) &&
    typeof proof.manifest_sha256 === 'string' &&
    SHA256_PATTERN.test(proof.manifest_sha256)
  );
}

function numericVersionPartIsWellFormed(part: string): boolean {
  return (
    part.length > 0 &&
    NUMERIC_VERSION_PART_PATTERN.test(part) &&
    (part === '0' || !part.startsWith('0'))
  );
}

function versionIdentifiersAreWellFormed(value: string | undefined): boolean {
  return (
    value === undefined ||
    value
      .split('.')
      .every(identifier =>
        identifier.length > 0 ? VERSION_IDENTIFIER_PATTERN.test(identifier) : false,
      )
  );
}

function pluginVersionIsWellFormed(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_PLUGIN_VERSION_LENGTH) return false;
  const buildSplit = value.split('+');
  if (buildSplit.length > 2) return false;
  const coreAndPrerelease = buildSplit[0] ?? '';
  const prereleaseSeparator = coreAndPrerelease.indexOf('-');
  const coreText =
    prereleaseSeparator === -1
      ? coreAndPrerelease
      : coreAndPrerelease.slice(0, prereleaseSeparator);
  const prerelease =
    prereleaseSeparator === -1 ? undefined : coreAndPrerelease.slice(prereleaseSeparator + 1);
  const core = coreText.split('.');
  return (
    core.length === 3 &&
    core.every(part => numericVersionPartIsWellFormed(part)) &&
    versionIdentifiersAreWellFormed(prerelease) &&
    versionIdentifiersAreWellFormed(buildSplit[1])
  );
}

function sessionProofTimeIsWellFormed(proof: Record<string, unknown>): boolean {
  return typeof proof.recorded_at === 'string' && !Number.isNaN(Date.parse(proof.recorded_at));
}

function classifySessionProof(
  proof: CodexSessionProof,
  identity: CodexPluginIdentity,
  marker: CodexActivationMarkerV2 | null,
  receipt: CodexActivationReceiptV1 | null,
  activationPending: boolean,
): CodexSessionProofStatus {
  if (proof.schema_version === 1) return 'prior-observed';
  if (!matchesCodexPluginIdentity(proof, identity)) return 'prior-observed';
  if (marker !== null && Date.parse(proof.recorded_at) < Date.parse(marker.installed_at)) {
    return 'prior-observed';
  }
  if (activationPending) return 'activation-pending';
  if (receipt === null) return proof.activation_id === null ? 'current' : 'prior-observed';
  return proof.activation_id === receipt.activation_id &&
    Date.parse(proof.recorded_at) >= Date.parse(receipt.activated_at)
    ? 'current'
    : 'prior-observed';
}

export function observeCodexSessionProof(
  projectDirectory: string,
  sessionId: string,
  environment: NodeJS.ProcessEnv = process.env,
): CodexSessionProofObservation {
  const canonicalProject = canonicalProjectDirectory(projectDirectory);
  const path = codexSessionProofPath(canonicalProject, sessionId, environment);
  if (!existsSync(path)) {
    return {
      status: 'missing',
      plugin_version: null,
      manifest_sha256: null,
      recorded_at: null,
    };
  }
  try {
    const value = readTrustedHookProofJson(path);
    if (!validSessionProof(value, canonicalProject, sessionId)) throw new Error('Invalid proof.');
    const identity = currentCodexPluginIdentity();
    const marker = readActivationMarkerV2(environment, identity);
    const receipt = readActivationReceipt(environment, identity);
    const status = classifySessionProof(
      value,
      identity,
      marker,
      receipt,
      activationIsPendingForIdentity(environment, identity),
    );
    return {
      status,
      plugin_version: value.plugin_version,
      manifest_sha256: value.manifest_sha256,
      recorded_at: value.recorded_at,
    };
  } catch {
    return {
      status: 'untrusted',
      plugin_version: null,
      manifest_sha256: null,
      recorded_at: null,
    };
  }
}

function sessionProofProjectDirectories(root: string): {
  modifiedAt: number;
  path: string;
}[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.isSymbolicLink())
      .flatMap(projectEntry => {
        const path = nodePath.join(root, projectEntry.name);
        try {
          // A crash may leave only a durable-write temporary file. Such a
          // directory is not retained proof and must not consume a project
          // retention slot or evict a live sibling project.
          if (sessionProofProjectFiles(path).length === 0) return [];
          return [{ modifiedAt: lstatSync(path).mtimeMs, path }];
        } catch {
          // An unreadable directory is not evidence that its retained history
          // is empty. Leave it untouched and retry on a later SessionStart.
          return [];
        }
      });
  } catch {
    return [];
  }
}

function sessionProofProjectFiles(projectPath: string): { modifiedAt: number; path: string }[] {
  try {
    return readdirSync(projectPath, { withFileTypes: true }).flatMap(entry => {
      if (
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        entry.name.startsWith('.') ||
        !entry.name.endsWith('.json')
      )
        return [];
      const path = nodePath.join(projectPath, entry.name);
      try {
        return [{ modifiedAt: lstatSync(path).mtimeMs, path }];
      } catch {
        // Another task may prune the same proof between listing and metadata
        // lookup. Keep the remaining bounded history instead of abandoning it.
        return [];
      }
    });
  } catch {
    return [];
  }
}

function pruneCodexSessionProofs(retainedPath: string): void {
  const retainedProjectPath = nodePath.dirname(retainedPath);
  const files = sessionProofProjectFiles(retainedProjectPath).toSorted((left, right) => {
    if (left.path === retainedPath) return -1;
    if (right.path === retainedPath) return 1;
    return right.modifiedAt - left.modifiedAt || left.path.localeCompare(right.path);
  });
  for (const stale of files.slice(MAX_RETAINED_SESSION_PROOFS_PER_PROJECT)) {
    rmSync(stale.path, { force: true });
  }
  const root = nodePath.dirname(retainedProjectPath);
  const projects = sessionProofProjectDirectories(root).toSorted((left, right) => {
    if (left.path === retainedProjectPath) return -1;
    if (right.path === retainedProjectPath) return 1;
    return right.modifiedAt - left.modifiedAt || left.path.localeCompare(right.path);
  });
  for (const stale of projects.slice(MAX_RETAINED_SESSION_PROOF_PROJECTS)) {
    for (const proof of sessionProofProjectFiles(stale.path)) rmSync(proof.path, { force: true });
    try {
      // Non-recursive removal cannot erase a concurrent writer's temporary or
      // newly published proof. A non-empty directory is retried later.
      rmdirSync(stale.path);
    } catch {
      // Advisory history remains bounded per project even when a concurrent
      // writer keeps this project directory alive.
    }
  }
}

function writeAtomicJson(
  path: string,
  value: unknown,
  options: { beforeRename?: () => void } = {},
): void {
  writeDurableFile(path, `${JSON.stringify(value)}\n`, {
    mode: 0o600,
    beforeRename: options.beforeRename,
  });
}

function legacyActivationMarkerMatches(path: string, identity: CodexPluginIdentity): boolean {
  if (!existsSync(path)) return false;
  try {
    const marker = JSON.parse(readFileSync(path, 'utf8')) as Partial<CodexActivationMarkerV1>;
    return marker.schema_version === 1 && matchesCodexPluginIdentity(marker, identity);
  } catch {
    return false;
  }
}

function readActivationMarkerV2(
  environment: NodeJS.ProcessEnv,
  identity: CodexPluginIdentity,
): CodexActivationMarkerV2 | null {
  return readIdentityBoundJson(
    codexActivationMarkerPath(environment),
    identity,
    isActivationMarkerV2,
  );
}

function readActivationReceipt(
  environment: NodeJS.ProcessEnv,
  identity: CodexPluginIdentity,
): CodexActivationReceiptV1 | null {
  return readIdentityBoundJson(
    codexActivationReceiptPath(environment),
    identity,
    isActivationReceiptV1,
  );
}

function activeCodexActivationId(
  marker: CodexActivationMarkerV2 | null,
  receipt: CodexActivationReceiptV1 | null,
): string | null {
  // A completed restart receipt supersedes a leftover pending marker. Sharing
  // this precedence keeps the proof writer and observer on the same identity.
  return receipt?.activation_id ?? marker?.activation_id ?? null;
}

function readIdentityBoundJson<T extends CodexPluginIdentity>(
  path: string,
  identity: CodexPluginIdentity,
  validator: (value: unknown) => value is T,
): T | null {
  if (!existsSync(path)) return null;
  try {
    const value = readTrustedHookProofJson(path);
    return validator(value) && matchesCodexPluginIdentity(value, identity) ? value : null;
  } catch {
    return null;
  }
}

function readEventProof(
  path: string,
  expectedEvent: CodexPluginHookEvent,
): CodexHookProofV2 | CodexHookProofV3 | null {
  try {
    const proof = readTrustedHookProofJson(path);
    return isCodexHookProof(proof) && proof.event === expectedEvent ? proof : null;
  } catch {
    return null;
  }
}

const MAX_CODEX_HOOK_PROOF_BYTES = 64 * 1024;

function assertTrustedHookProofMetadata(metadata: Stats): void {
  const posixPermissionsAreTrusted =
    process.getuid === undefined ||
    (metadata.uid === process.getuid() && (metadata.mode & 0o077) === 0);
  if (
    !metadata.isFile() ||
    metadata.nlink !== 1 ||
    !posixPermissionsAreTrusted ||
    metadata.size > MAX_CODEX_HOOK_PROOF_BYTES
  ) {
    throw new Error('Untrusted Codex hook proof file.');
  }
}

function readDescriptorFully(descriptor: number, size: number): Buffer {
  const buffer = Buffer.alloc(size);
  let offset = 0;
  while (offset < buffer.length) {
    const count = readSync(descriptor, buffer, offset, buffer.length - offset, offset);
    if (count === 0) break;
    offset += count;
  }
  if (offset !== buffer.length)
    throw new Error('Codex hook proof changed while it was being read.');
  return buffer;
}

function assertHookProofUnchanged(before: Stats, after: Stats): void {
  if (
    after.size !== before.size ||
    after.mtimeMs !== before.mtimeMs ||
    after.ctimeMs !== before.ctimeMs
  ) {
    throw new Error('Codex hook proof changed while it was being read.');
  }
}

function readTrustedHookProofJson(path: string): unknown {
  const descriptor = openSync(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const metadata = fstatSync(descriptor);
    assertTrustedHookProofMetadata(metadata);
    const buffer = readDescriptorFully(descriptor, metadata.size);
    assertHookProofUnchanged(metadata, fstatSync(descriptor));
    return JSON.parse(buffer.toString('utf8')) as unknown;
  } finally {
    closeSync(descriptor);
  }
}

// eslint-disable-next-line complexity -- aggregates independently written event proofs and preserves malformed/stale distinctions
export function observeCodexHookProof(
  environment: NodeJS.ProcessEnv = process.env,
  binding?: { projectDirectory: string; sessionId: string },
): CodexHookProofObservation {
  const candidates = CODEX_PLUGIN_HOOK_EVENTS.map(event => ({
    event,
    path: codexProofPath(environment, event),
  }));
  const existing = candidates.filter(candidate => existsSync(candidate.path));
  if (existing.length === 0) {
    return {
      status: 'missing',
      plugin_version: null,
      manifest_sha256: null,
      recorded_at: null,
      activation_id: null,
      events: [],
      missing_events: CODEX_PLUGIN_HOOK_EVENTS,
    };
  }

  const parsed = existing.map(item => readEventProof(item.path, item.event));
  if (parsed.includes(null)) return malformedObservation();
  const validProofs = parsed.filter(proof => proof !== null);

  let identity: CodexPluginIdentity;
  try {
    identity = currentCodexPluginIdentity();
  } catch {
    return malformedObservation();
  }
  const marker = readActivationMarkerV2(environment, identity);
  const receipt = readActivationReceipt(environment, identity);
  const activationId = activeCodexActivationId(marker, receipt);
  if (activationIsPendingForIdentity(environment, identity)) {
    return staleHookObservation(validProofs, activationId);
  }
  const canonicalProject =
    binding === undefined ? undefined : canonicalProjectDirectory(binding.projectDirectory);
  const current = validProofs.filter(
    proof =>
      matchesCodexPluginIdentity(proof, identity) &&
      (activationId === null
        ? proof.activation_id === null
        : proof.activation_id === activationId) &&
      (receipt === null || Date.parse(proof.recorded_at) >= Date.parse(receipt.activated_at)) &&
      (binding === undefined ||
        (proof.schema_version === 3 &&
          proof.project_directory === canonicalProject &&
          proof.session_id === binding.sessionId)),
  );
  const events = current.map(proof => proof.event);
  const missingEvents = CODEX_PLUGIN_HOOK_EVENTS.filter(event => !events.includes(event));
  const latest = current
    .toSorted((left, right) => Date.parse(right.recorded_at) - Date.parse(left.recorded_at))
    .at(0);
  let status: CodexHookProofStatus = 'stale';
  if (current.length === CODEX_PLUGIN_HOOK_EVENTS.length) status = 'current';
  else if (current.length > 0) status = 'partial';
  return {
    status,
    plugin_version: latest?.plugin_version ?? validProofs[0]?.plugin_version ?? null,
    manifest_sha256: latest?.manifest_sha256 ?? validProofs[0]?.manifest_sha256 ?? null,
    recorded_at: latest?.recorded_at ?? null,
    activation_id: activationId,
    events,
    missing_events: missingEvents,
  };
}

function staleHookObservation(
  proofs: (CodexHookProofV2 | CodexHookProofV3)[],
  activationId: string | null,
): CodexHookProofObservation {
  return {
    status: 'stale',
    plugin_version: proofs[0]?.plugin_version ?? null,
    manifest_sha256: proofs[0]?.manifest_sha256 ?? null,
    recorded_at: null,
    activation_id: activationId,
    events: [],
    missing_events: CODEX_PLUGIN_HOOK_EVENTS,
  };
}

function malformedObservation(): CodexHookProofObservation {
  return {
    status: 'malformed',
    plugin_version: null,
    manifest_sha256: null,
    recorded_at: null,
    activation_id: null,
    events: [],
    missing_events: CODEX_PLUGIN_HOOK_EVENTS,
  };
}

/*
  Each manifest entry is trusted independently by Codex, so finalization proof
  is intentionally one file per event. Separate files also avoid concurrent
  hook processes racing on a shared read-modify-write document.
*/

// eslint-disable-next-line complexity -- validates every field of two persisted proof schema versions
function isCodexHookProof(value: unknown): value is CodexHookProofV2 | CodexHookProofV3 {
  if (typeof value !== 'object' || value === null) return false;
  const proof = value as Record<string, unknown>;
  return (
    (proof.schema_version === 2 || proof.schema_version === 3) &&
    isCodexPluginHookEvent(proof.event) &&
    pluginVersionIsWellFormed(proof.plugin_version) &&
    typeof proof.manifest_sha256 === 'string' &&
    SHA256_PATTERN.test(proof.manifest_sha256) &&
    'activation_id' in proof &&
    (typeof proof.activation_id === 'string' || proof.activation_id === null) &&
    (proof.schema_version !== 3 ||
      (typeof proof.project_directory === 'string' &&
        typeof proof.session_id === 'string' &&
        proof.session_id.trim() !== '')) &&
    typeof proof.recorded_at === 'string' &&
    !Number.isNaN(Date.parse(proof.recorded_at))
  );
}

// eslint-disable-next-line complexity -- validates each untrusted persisted marker field
function isActivationMarkerV2(value: unknown): value is CodexActivationMarkerV2 {
  if (typeof value !== 'object' || value === null) return false;
  const marker = value as Partial<CodexActivationMarkerV2>;
  return (
    marker.schema_version === 2 &&
    pluginVersionIsWellFormed(marker.plugin_version) &&
    typeof marker.manifest_sha256 === 'string' &&
    SHA256_PATTERN.test(marker.manifest_sha256) &&
    typeof marker.activation_id === 'string' &&
    typeof marker.installed_at === 'string' &&
    !Number.isNaN(Date.parse(marker.installed_at)) &&
    (marker.host_observation === 'observed' || marker.host_observation === 'unavailable') &&
    Array.isArray(marker.active_hosts) &&
    marker.active_hosts.every(isCodexHostProcessIdentity) &&
    (marker.host_observation === 'observed' || marker.active_hosts.length === 0)
  );
}

function isActivationReceiptV1(value: unknown): value is CodexActivationReceiptV1 {
  if (typeof value !== 'object' || value === null) return false;
  const receipt = value as Partial<CodexActivationReceiptV1>;
  return (
    receipt.schema_version === 1 &&
    pluginVersionIsWellFormed(receipt.plugin_version) &&
    typeof receipt.manifest_sha256 === 'string' &&
    SHA256_PATTERN.test(receipt.manifest_sha256) &&
    typeof receipt.activation_id === 'string' &&
    typeof receipt.activated_at === 'string' &&
    !Number.isNaN(Date.parse(receipt.activated_at)) &&
    isCodexHostProcessIdentity(receipt.host)
  );
}

function isCodexHostProcessIdentity(value: unknown): value is CodexHostProcessIdentity {
  if (typeof value !== 'object' || value === null) return false;
  const host = value as Partial<CodexHostProcessIdentity>;
  return (
    Number.isSafeInteger(host.pid) &&
    (host.pid ?? 0) > 0 &&
    typeof host.started_at === 'string' &&
    !Number.isNaN(Date.parse(host.started_at))
  );
}

function isCodexPluginHookEvent(value: unknown): value is CodexPluginHookEvent {
  return (
    typeof value === 'string' && CODEX_PLUGIN_HOOK_EVENTS.includes(value as CodexPluginHookEvent)
  );
}
