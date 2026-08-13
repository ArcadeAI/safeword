import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { writeDurableFile, writeDurableFileExclusive } from '../codex-plugin/durable-write.js';
import { CLAUDE_MIGRATION_SCHEMA } from './inventory.js';

export interface ClaudePluginModeV2 {
  readonly schema_version: 2;
  readonly state: 'clean' | 'unresolved';
  readonly plugin_version: string;
  readonly hook_manifest_sha256: string;
  readonly catalogue_sha256: string;
  readonly unresolved_paths: readonly string[];
  readonly advisory?: string;
  readonly transaction_id?: string;
}

/**
 * Derives plugin mode so `state` can never disagree with `unresolved_paths`.
 *
 * The spread comes FIRST on purpose. TypeScript's excess-property check does
 * not apply to spreads, so `createClaudePluginMode({ ...existingMarker, ... })`
 * compiles — and with the spread last it would overwrite the derived state with
 * a stale one, defeating the only thing this factory exists to guarantee.
 */
export function createClaudePluginMode(
  marker: Omit<ClaudePluginModeV2, 'schema_version' | 'state'>,
): ClaudePluginModeV2 {
  return {
    ...marker,
    schema_version: 2,
    state: marker.unresolved_paths.length === 0 ? 'clean' : 'unresolved',
  };
}

interface InitialSessionV1 {
  readonly schema_version: 1;
  readonly session_digest: string;
}

const PROCESS_SESSION_ID = `process-${randomUUID()}`;

function migrationSessionDigest(sessionId: string | undefined, fallbackSessionId: string): string {
  return digest(sessionId?.trim() || fallbackSessionId);
}

export interface ClaudeMigrationAttentionV1 {
  readonly schema_version: 1;
  readonly state_digest: string;
  readonly plugin_version: string;
  readonly catalogue_sha256: string;
  readonly watched_settings_sha256: string;
  readonly classification: string;
  readonly advisory: string;
}

function digest(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function attemptsPath(cwd: string): string {
  return nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.attemptsDirectory);
}

function exclusiveRecord(path: string, value: unknown): boolean {
  try {
    writeDurableFileExclusive(path, `${JSON.stringify(value)}\n`, { mode: 0o600 });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
}

function initialSessionDigest(cwd: string, sessionDigest: string): string {
  const directory = attemptsPath(cwd);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = nodePath.join(directory, 'initial-session-v1.json');
  exclusiveRecord(path, { schema_version: 1, session_digest: sessionDigest });
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as Partial<InitialSessionV1>;
    return value.schema_version === 1 && validDigest(value.session_digest)
      ? value.session_digest
      : '';
  } catch {
    return '';
  }
}

/** Atomically claims one bounded automatic-migration launch for a Claude session. */
export function claimClaudeMigrationAttempt(
  cwd: string,
  sessionId: string | undefined,
  kind: 'migration' | 'recovery' = 'migration',
  fallbackSessionId = PROCESS_SESSION_ID,
): boolean {
  const sessionDigest = migrationSessionDigest(sessionId, fallbackSessionId);
  const initialSession = initialSessionDigest(cwd, sessionDigest) === sessionDigest;
  const limit = initialSession ? 3 : 1;
  const directory = nodePath.join(
    attemptsPath(cwd),
    kind === 'recovery' && !initialSession ? 'recoveries' : 'launches',
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (let slot = 1; slot <= limit; slot += 1) {
    if (
      exclusiveRecord(nodePath.join(directory, `${sessionDigest}-${String(slot)}.json`), {
        schema_version: 1,
        session_digest: sessionDigest,
        slot,
      })
    ) {
      return true;
    }
  }
  return false;
}

/** Returns true only once for the same advisory state in one Claude session. */
export function claimClaudeMigrationAdvisory(
  cwd: string,
  sessionId: string | undefined,
  stateDigest: string,
  fallbackSessionId = PROCESS_SESSION_ID,
): boolean {
  const directory = nodePath.join(attemptsPath(cwd), 'advisories');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const sessionDigest = migrationSessionDigest(sessionId, fallbackSessionId);
  return exclusiveRecord(nodePath.join(directory, `${sessionDigest}-${stateDigest}.json`), {
    schema_version: 1,
    session_digest: sessionDigest,
    state_digest: stateDigest,
  });
}

export function advisoryStateDigest(advisory: string): string {
  return digest(advisory);
}

/**
 * Resolves the Claude user-scope configuration directory. An empty or
 * whitespace-only `CLAUDE_CONFIG_DIR` falls back to the default, so every
 * caller watches and reads the same user settings file.
 */
export function claudeConfigDirectory(): string {
  const configured = (process.env.CLAUDE_CONFIG_DIR ?? '').trim();
  return configured === '' ? nodePath.join(homedir(), '.claude') : configured;
}

export function claudeWatchedSettingsDigest(cwd: string): string {
  const configDirectory = claudeConfigDirectory();
  const paths = [
    nodePath.join(cwd, '.claude/settings.json'),
    nodePath.join(configDirectory, 'settings.json'),
  ];
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(path);
    hash.update('\0');
    hash.update(existsSync(path) ? readFileSync(path) : '<absent>');
    hash.update('\0');
  }
  return hash.digest('hex');
}

function markerPath(cwd: string): string {
  return nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarkerV2);
}

function validDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[\da-f]{64}$/u.test(value);
}

function validPluginMode(value: Partial<ClaudePluginModeV2>): value is ClaudePluginModeV2 {
  const unresolvedPaths = value.unresolved_paths;
  return [
    value.schema_version === 2,
    ['clean', 'unresolved'].includes(value.state ?? ''),
    typeof value.plugin_version === 'string',
    validDigest(value.hook_manifest_sha256),
    validDigest(value.catalogue_sha256),
    Array.isArray(unresolvedPaths),
    Array.isArray(unresolvedPaths) && unresolvedPaths.every(item => typeof item === 'string'),
  ].every(Boolean);
}

export function readClaudePluginMode(cwd: string): ClaudePluginModeV2 | undefined {
  const path = markerPath(cwd);
  if (!existsSync(path)) return undefined;
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as Partial<ClaudePluginModeV2>;
    return validPluginMode(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function pluginModeIsTerminal(
  marker: ClaudePluginModeV2,
  identity: {
    readonly plugin_version: string;
    readonly hook_manifest_sha256: string;
    readonly catalogue_sha256: string;
  },
): boolean {
  return (
    marker.plugin_version === identity.plugin_version &&
    marker.hook_manifest_sha256 === identity.hook_manifest_sha256 &&
    marker.catalogue_sha256 === identity.catalogue_sha256
  );
}

export function writeClaudePluginMode(cwd: string, marker: ClaudePluginModeV2): void {
  writeDurableFile(markerPath(cwd), `${JSON.stringify(marker, undefined, 2)}\n`, { mode: 0o600 });
}

export function readClaudeMigrationAttention(cwd: string): ClaudeMigrationAttentionV1 | undefined {
  const path = nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.attention);
  if (!existsSync(path)) return undefined;
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as Partial<ClaudeMigrationAttentionV1>;
    if (
      value.schema_version !== 1 ||
      !validDigest(value.state_digest) ||
      typeof value.plugin_version !== 'string' ||
      !validDigest(value.catalogue_sha256) ||
      !validDigest(value.watched_settings_sha256) ||
      typeof value.classification !== 'string' ||
      typeof value.advisory !== 'string'
    ) {
      return undefined;
    }
    return value as ClaudeMigrationAttentionV1;
  } catch {
    return undefined;
  }
}

export function writeClaudeMigrationAttention(
  cwd: string,
  attention: ClaudeMigrationAttentionV1,
): void {
  writeDurableFile(
    nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.attention),
    `${JSON.stringify(attention, undefined, 2)}\n`,
    { mode: 0o600 },
  );
}

export function hasLegacyClaudePluginMode(cwd: string): boolean {
  return existsSync(nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarker));
}

export function removeLegacyClaudePluginMode(cwd: string): void {
  rmSync(nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.paths.pluginMarker), { force: true });
}
