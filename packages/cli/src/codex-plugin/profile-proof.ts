/* eslint-disable unicorn/no-null -- versioned JSON uses explicit null for unavailable values */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { SAFEWORD_SCHEMA } from '../schema.js';
import { writeDurableFile } from './durable-write.js';
import {
  type CodexHostProcessIdentity,
  type CodexHostProcessObservation,
  observeCodexHostProcesses,
  observeRunningCodexHosts,
  sameCodexHost,
} from './host-process.js';

export type { CodexHostProcessIdentity } from './host-process.js';

export interface CodexPluginIdentity {
  plugin_version: string;
  manifest_sha256: string;
}

export interface CodexHookProofV1 {
  schema_version: 1;
  event: CodexPluginHookEvent;
  plugin_version: string;
  manifest_sha256: string;
  recorded_at: string;
}

export interface CodexHookProofV2 {
  schema_version: 2;
  event: CodexPluginHookEvent;
  plugin_version: string;
  manifest_sha256: string;
  activation_id: string | null;
  recorded_at: string;
}

export interface CodexActivationMarkerV1 {
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
  return environment.CODEX_HOME ?? nodePath.join(homedir(), '.codex');
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
  const identity = currentCodexPluginIdentity();
  return (
    // The canonical marker is written atomically. If it exists but cannot be
    // parsed or matched, fail closed instead of accepting unbound hook proof.
    existsSync(codexActivationMarkerPath(environment)) ||
    [legacyCodexActivationMarkerPath(environment), legacyCodexRestartMarkerPath(environment)].some(
      path => legacyActivationMarkerMatches(path, identity),
    )
  );
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

export function currentCodexPluginIdentity(): CodexPluginIdentity {
  const manifest = readFileSync(packagedHookManifestPath());
  return {
    plugin_version: SAFEWORD_SCHEMA.version,
    manifest_sha256: createHash('sha256').update(manifest).digest('hex'),
  };
}

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
  } = {},
): CodexActivationMarkerV2 {
  const path = codexActivationMarkerPath(environment);
  const activeHosts =
    options.activeHosts === undefined ? observeRunningCodexHosts() : options.activeHosts;
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
  rmSync(codexActivationReceiptPath(environment), { force: true });
  rmSync(legacyCodexActivationMarkerPath(environment), { force: true });
  rmSync(legacyCodexRestartMarkerPath(environment), { force: true });
  return marker;
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

// eslint-disable-next-line complexity -- activation transition validates independent durable host and time evidence
export function recordCodexHookProof(
  event: CodexPluginHookEvent,
  environment: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  writeOptions: {
    beforeRename?: () => void;
    currentHost?: CodexHostProcessIdentity | null;
    hostObservation?: CodexHostProcessObservation;
  } = {},
): CodexHookProofV2 {
  const identity = currentCodexPluginIdentity();
  const marker = readActivationMarkerV2(environment, identity);
  let receipt = readActivationReceipt(environment, identity);
  if (event === 'session-start' && marker !== null) {
    const hostObservation =
      writeOptions.hostObservation ??
      ('currentHost' in writeOptions
        ? hostObservationForOverride(writeOptions.currentHost)
        : observeCodexHostProcesses());
    const currentHost = hostObservation.current;
    if (
      hostObservation.available &&
      currentHost !== null &&
      marker.host_observation === 'observed' &&
      now.getTime() >= Date.parse(marker.installed_at) &&
      marker.active_hosts.every(installedHost =>
        hostObservation.running.every(runningHost => !sameCodexHost(installedHost, runningHost)),
      )
    ) {
      receipt = {
        schema_version: 1,
        ...identity,
        activation_id: marker.activation_id,
        activated_at: now.toISOString(),
        host: currentHost,
      };
      writeAtomicJson(codexActivationReceiptPath(environment), receipt);
      rmSync(codexActivationMarkerPath(environment), { force: true });
    }
  }
  const proof: CodexHookProofV2 = {
    schema_version: 2,
    event,
    ...identity,
    activation_id: receipt?.activation_id ?? marker?.activation_id ?? null,
    recorded_at: now.toISOString(),
  };
  writeAtomicJson(codexProofPath(environment, event), proof, writeOptions);
  return proof;
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

function readIdentityBoundJson<T extends CodexPluginIdentity>(
  path: string,
  identity: CodexPluginIdentity,
  validator: (value: unknown) => value is T,
): T | null {
  if (!existsSync(path)) return null;
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return validator(value) && matchesCodexPluginIdentity(value, identity) ? value : null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line complexity -- aggregates independently written event proofs and preserves malformed/stale distinctions
export function observeCodexHookProof(
  environment: NodeJS.ProcessEnv = process.env,
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

  const parsed: (CodexHookProofV1 | CodexHookProofV2)[] = [];
  for (const item of existing) {
    try {
      const candidate = JSON.parse(readFileSync(item.path, 'utf8')) as unknown;
      if (!isCodexHookProof(candidate) || candidate.event !== item.event) {
        return malformedObservation();
      }
      parsed.push(candidate);
    } catch {
      return malformedObservation();
    }
  }

  const identity = currentCodexPluginIdentity();
  const activationId =
    readActivationMarkerV2(environment, identity)?.activation_id ??
    readActivationReceipt(environment, identity)?.activation_id ??
    null;
  const current = parsed.filter(
    proof =>
      matchesCodexPluginIdentity(proof, identity) &&
      (activationId === null ||
        (proof.schema_version === 2 && proof.activation_id === activationId)),
  );
  const events = current.map(proof => proof.event);
  const missingEvents = CODEX_PLUGIN_HOOK_EVENTS.filter(event => !events.includes(event));
  const latest = current
    .toSorted((left, right) => right.recorded_at.localeCompare(left.recorded_at))
    .at(0);
  let status: CodexHookProofStatus = 'stale';
  if (current.length === CODEX_PLUGIN_HOOK_EVENTS.length) status = 'current';
  else if (current.length > 0) status = 'partial';
  return {
    status,
    plugin_version: latest?.plugin_version ?? parsed[0]?.plugin_version ?? null,
    manifest_sha256: latest?.manifest_sha256 ?? parsed[0]?.manifest_sha256 ?? null,
    recorded_at: latest?.recorded_at ?? null,
    activation_id: activationId,
    events,
    missing_events: missingEvents,
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
function isCodexHookProof(value: unknown): value is CodexHookProofV1 | CodexHookProofV2 {
  if (typeof value !== 'object' || value === null) return false;
  const proof = value as Partial<CodexHookProofV1>;
  return (
    (proof.schema_version === 1 || proof.schema_version === 2) &&
    isCodexPluginHookEvent(proof.event) &&
    typeof proof.plugin_version === 'string' &&
    typeof proof.manifest_sha256 === 'string' &&
    /^[\da-f]{64}$/u.test(proof.manifest_sha256) &&
    (proof.schema_version === 1 ||
      ('activation_id' in proof &&
        (typeof proof.activation_id === 'string' || proof.activation_id === null))) &&
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
    typeof marker.plugin_version === 'string' &&
    typeof marker.manifest_sha256 === 'string' &&
    /^[\da-f]{64}$/u.test(marker.manifest_sha256) &&
    typeof marker.activation_id === 'string' &&
    typeof marker.installed_at === 'string' &&
    !Number.isNaN(Date.parse(marker.installed_at)) &&
    (marker.host_observation === 'observed' || marker.host_observation === 'unavailable') &&
    Array.isArray(marker.active_hosts) &&
    marker.active_hosts.every(isCodexHostProcessIdentity)
  );
}

function isActivationReceiptV1(value: unknown): value is CodexActivationReceiptV1 {
  if (typeof value !== 'object' || value === null) return false;
  const receipt = value as Partial<CodexActivationReceiptV1>;
  return (
    receipt.schema_version === 1 &&
    typeof receipt.plugin_version === 'string' &&
    typeof receipt.manifest_sha256 === 'string' &&
    /^[\da-f]{64}$/u.test(receipt.manifest_sha256) &&
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
