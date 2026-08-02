/* eslint-disable unicorn/no-null -- schema-1 JSON uses explicit null for unavailable values */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { SAFEWORD_SCHEMA } from '../schema.js';
import { writeDurableFile } from './durable-write.js';

export interface CodexHookProofV1 {
  schema_version: 1;
  event: CodexPluginHookEvent;
  plugin_version: string;
  manifest_sha256: string;
  recorded_at: string;
}

export interface CodexActivationMarkerV1 {
  schema_version: 1;
  plugin_version: string;
  manifest_sha256: string;
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
    'safeword/hook-proof-v1',
    `${event}.json`,
  );
}

function codexActivationMarkerPath(environment: NodeJS.ProcessEnv = process.env): string {
  return nodePath.join(codexProfileDirectory(environment), 'safeword/activation-pending-v1.json');
}

function legacyCodexRestartMarkerPath(environment: NodeJS.ProcessEnv = process.env): string {
  return nodePath.join(codexProfileDirectory(environment), 'safeword/restart-pending-v1.json');
}

export function codexActivationIsPending(environment: NodeJS.ProcessEnv = process.env): boolean {
  const identity = currentCodexPluginIdentity();
  return [codexActivationMarkerPath(environment), legacyCodexRestartMarkerPath(environment)].some(
    path => activationMarkerMatches(path, identity),
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

export function currentCodexPluginIdentity(): {
  plugin_version: string;
  manifest_sha256: string;
} {
  const manifest = readFileSync(packagedHookManifestPath());
  return {
    plugin_version: SAFEWORD_SCHEMA.version,
    manifest_sha256: createHash('sha256').update(manifest).digest('hex'),
  };
}

export function writeCodexActivationMarker(
  environment: NodeJS.ProcessEnv = process.env,
): CodexActivationMarkerV1 {
  const path = codexActivationMarkerPath(environment);
  const marker: CodexActivationMarkerV1 = {
    schema_version: 1,
    ...currentCodexPluginIdentity(),
  };
  writeAtomicJson(path, marker);
  // A successful canonical write supersedes every v0.70 pending marker. The
  // new marker retains the exact current identity even when the legacy input
  // was malformed or bound to the previously installed release.
  rmSync(legacyCodexRestartMarkerPath(environment), { force: true });
  return marker;
}

export function recordCodexHookProof(
  event: CodexPluginHookEvent,
  environment: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  writeOptions: { beforeRename?: () => void } = {},
): CodexHookProofV1 {
  const identity = currentCodexPluginIdentity();
  const proof: CodexHookProofV1 = {
    schema_version: 1,
    event,
    ...identity,
    recorded_at: now.toISOString(),
  };
  writeAtomicJson(codexProofPath(environment, event), proof, writeOptions);

  if (event === 'session-start') {
    for (const markerPath of [
      codexActivationMarkerPath(environment),
      legacyCodexRestartMarkerPath(environment),
    ]) {
      if (activationMarkerMatches(markerPath, identity)) rmSync(markerPath, { force: true });
    }
  }
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

function activationMarkerMatches(
  path: string,
  identity: { plugin_version: string; manifest_sha256: string },
): boolean {
  if (!existsSync(path)) return false;
  try {
    const marker = JSON.parse(readFileSync(path, 'utf8')) as Partial<CodexActivationMarkerV1>;
    return (
      marker.schema_version === 1 &&
      marker.plugin_version === identity.plugin_version &&
      marker.manifest_sha256 === identity.manifest_sha256
    );
  } catch {
    return false;
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
      events: [],
      missing_events: CODEX_PLUGIN_HOOK_EVENTS,
    };
  }

  const parsed: CodexHookProofV1[] = [];
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
  const current = parsed.filter(
    proof =>
      proof.plugin_version === identity.plugin_version &&
      proof.manifest_sha256 === identity.manifest_sha256,
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
    events: [],
    missing_events: CODEX_PLUGIN_HOOK_EVENTS,
  };
}

/*
  Each manifest entry is trusted independently by Codex, so finalization proof
  is intentionally one file per event. Separate files also avoid concurrent
  hook processes racing on a shared read-modify-write document.
*/

function isCodexHookProof(value: unknown): value is CodexHookProofV1 {
  if (typeof value !== 'object' || value === null) return false;
  const proof = value as Partial<CodexHookProofV1>;
  return (
    proof.schema_version === 1 &&
    isCodexPluginHookEvent(proof.event) &&
    typeof proof.plugin_version === 'string' &&
    typeof proof.manifest_sha256 === 'string' &&
    /^[\da-f]{64}$/u.test(proof.manifest_sha256) &&
    typeof proof.recorded_at === 'string' &&
    !Number.isNaN(Date.parse(proof.recorded_at))
  );
}

function isCodexPluginHookEvent(value: unknown): value is CodexPluginHookEvent {
  return (
    typeof value === 'string' && CODEX_PLUGIN_HOOK_EVENTS.includes(value as CodexPluginHookEvent)
  );
}
