/* eslint-disable unicorn/no-null -- schema-1 JSON uses explicit null for unavailable values */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { SAFEWORD_SCHEMA } from '../schema.js';

export interface CodexHookProofV1 {
  schema_version: 1;
  plugin_version: string;
  manifest_sha256: string;
  recorded_at: string;
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
  return nodePath.resolve(import.meta.dirname, '../codex-plugin/hooks.json');
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
