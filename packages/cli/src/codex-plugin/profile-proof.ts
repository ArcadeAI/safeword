/* eslint-disable unicorn/no-null -- schema-1 JSON uses explicit null for unavailable values */

import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { SAFEWORD_SCHEMA } from '../schema.js';

export interface CodexHookProofV1 {
  schema_version: 1;
  plugin_version: string;
  manifest_sha256: string;
  recorded_at: string;
}

export interface CodexRestartMarkerV1 {
  schema_version: 1;
  plugin_version: string;
  manifest_sha256: string;
}

export type CodexHookProofStatus = 'current' | 'missing' | 'stale' | 'malformed';

export interface CodexHookProofObservation {
  status: CodexHookProofStatus;
  plugin_version: string | null;
  manifest_sha256: string | null;
  recorded_at: string | null;
}

export function codexProfileDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return environment.CODEX_HOME ?? nodePath.join(homedir(), '.codex');
}

export function codexProofPath(environment: NodeJS.ProcessEnv = process.env): string {
  return nodePath.join(codexProfileDirectory(environment), 'safeword/hook-proof-v1.json');
}

export function codexRestartMarkerPath(environment: NodeJS.ProcessEnv = process.env): string {
  return nodePath.join(codexProfileDirectory(environment), 'safeword/restart-pending-v1.json');
}

export function packagedHookManifestPath(): string {
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

export function writeCodexRestartMarker(
  environment: NodeJS.ProcessEnv = process.env,
): CodexRestartMarkerV1 {
  const path = codexRestartMarkerPath(environment);
  const marker: CodexRestartMarkerV1 = {
    schema_version: 1,
    ...currentCodexPluginIdentity(),
  };
  writeAtomicJson(path, marker);
  return marker;
}

export function recordCodexHookProof(
  environment: NodeJS.ProcessEnv = process.env,
  now = new Date(),
  writeOptions: { beforeRename?: () => void } = {},
): CodexHookProofV1 {
  const identity = currentCodexPluginIdentity();
  const proof: CodexHookProofV1 = {
    schema_version: 1,
    ...identity,
    recorded_at: now.toISOString(),
  };
  writeAtomicJson(codexProofPath(environment), proof, writeOptions);

  const markerPath = codexRestartMarkerPath(environment);
  if (restartMarkerMatches(markerPath, identity)) rmSync(markerPath);
  return proof;
}

function writeAtomicJson(
  path: string,
  value: unknown,
  options: { beforeRename?: () => void } = {},
): void {
  const directory = nodePath.dirname(path);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = nodePath.join(directory, `.safeword-${process.pid}-${randomUUID()}.tmp`);
  try {
    const descriptor = openSync(temporaryPath, 'wx', 0o600);
    try {
      writeFileSync(descriptor, `${JSON.stringify(value)}\n`);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    options.beforeRename?.();
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function restartMarkerMatches(
  path: string,
  identity: { plugin_version: string; manifest_sha256: string },
): boolean {
  if (!existsSync(path)) return false;
  try {
    const marker = JSON.parse(readFileSync(path, 'utf8')) as Partial<CodexRestartMarkerV1>;
    return (
      marker.schema_version === 1 &&
      marker.plugin_version === identity.plugin_version &&
      marker.manifest_sha256 === identity.manifest_sha256
    );
  } catch {
    return false;
  }
}

export function observeCodexHookProof(
  environment: NodeJS.ProcessEnv = process.env,
): CodexHookProofObservation {
  const path = codexProofPath(environment);
  if (!existsSync(path)) {
    return {
      status: 'missing',
      plugin_version: null,
      manifest_sha256: null,
      recorded_at: null,
    };
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {
      status: 'malformed',
      plugin_version: null,
      manifest_sha256: null,
      recorded_at: null,
    };
  }

  if (!isCodexHookProof(candidate)) {
    return {
      status: 'malformed',
      plugin_version: null,
      manifest_sha256: null,
      recorded_at: null,
    };
  }

  const identity = currentCodexPluginIdentity();
  return {
    status:
      candidate.plugin_version === identity.plugin_version &&
      candidate.manifest_sha256 === identity.manifest_sha256
        ? 'current'
        : 'stale',
    plugin_version: candidate.plugin_version,
    manifest_sha256: candidate.manifest_sha256,
    recorded_at: candidate.recorded_at,
  };
}

function isCodexHookProof(value: unknown): value is CodexHookProofV1 {
  if (typeof value !== 'object' || value === null) return false;
  const proof = value as Partial<CodexHookProofV1>;
  return (
    proof.schema_version === 1 &&
    typeof proof.plugin_version === 'string' &&
    typeof proof.manifest_sha256 === 'string' &&
    /^[\da-f]{64}$/u.test(proof.manifest_sha256) &&
    typeof proof.recorded_at === 'string' &&
    !Number.isNaN(Date.parse(proof.recorded_at))
  );
}
