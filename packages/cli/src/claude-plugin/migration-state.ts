import { createHash, randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import nodePath from 'node:path';

import { writeDurableFile, writeDurableFileExclusive } from '../codex-plugin/durable-write.js';
import { CLAUDE_ADOPTED_LEGACY_STATE, CLAUDE_MIGRATION_SCHEMA } from './inventory.js';
import { claudeConfigDirectory, claudeProjectStateDirectory } from './plugin-data.js';

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

/**
 * Project roots whose legacy working-tree state has already been considered in
 * this process. Adoption is idempotent on disk; the set only keeps a hook from
 * re-walking four paths on every accessor call.
 */
const adopted = new Set<string>();

/**
 * Move legacy state, falling back to a copy across a filesystem boundary.
 *
 * The copy lands on a staging sibling and is published with a rename, so the
 * destination only ever appears complete. Copying straight into place looked
 * equivalent and was not: a copy that failed partway (a full disk, an
 * interrupted process) left a partial destination behind, and because adoption
 * treats an existing destination as the newer authoritative state, the next run
 * would delete the intact working-tree copy in its favour — destroying the
 * durable cleanup transaction that is the only record a half-finished migration
 * can be recovered from. Found by an independent review of the original fix.
 *
 * `rename` and `copy` are injectable so both failure modes can be exercised
 * without a second filesystem or a permissions trick: a copy that dies partway,
 * and a copy that completes but cannot be published. A crash between the two
 * orphans one `*.partial` entry, which no reader resolves and the next attempt
 * replaces.
 */
export function relocateLegacyState(
  from: string,
  to: string,
  rename: (source: string, destination: string) => void = renameSync,
  copy: (source: string, destination: string) => void = (source, destination) => {
    cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
  },
): void {
  try {
    rename(from, to);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
  }
  const staging = `${to}.${randomUUID()}.partial`;
  try {
    copy(from, staging);
    rename(staging, to);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  rmSync(from, { recursive: true, force: true });
}

/**
 * Adopts the state releases up to 0.83.1 wrote into the working tree (#3787).
 *
 * The durable cleanup transaction lives here, so skipping a repository that
 * still holds one would strand a half-finished cleanup with no record to
 * recover from. Anything already present in the plugin data directory wins —
 * that is the newer writer — and the stale working-tree copy is discarded.
 */
function adoptLegacyProjectState(cwd: string, directory: string): void {
  if (adopted.has(directory)) return;
  adopted.add(directory);
  for (const key of CLAUDE_ADOPTED_LEGACY_STATE) {
    const legacy = nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.legacy[key]);
    if (!existsSync(legacy)) continue;
    const destination = nodePath.join(directory, CLAUDE_MIGRATION_SCHEMA.state[key]);
    try {
      if (existsSync(destination)) rmSync(legacy, { recursive: true, force: true });
      else {
        mkdirSync(directory, { recursive: true, mode: 0o700 });
        relocateLegacyState(legacy, destination);
      }
      recordAdoption(directory, key);
    } catch {
      // A repository we cannot write to must not fail the session. The legacy
      // copy stays put and the next run tries again.
    }
  }
}

/**
 * Marks one key as adopted, so a legacy copy that survived removal is inert.
 * Written in the data directory, which is necessarily writable at this point —
 * the publish that precedes it just succeeded there.
 */
function adoptionReceipt(
  directory: string,
  key: keyof typeof CLAUDE_MIGRATION_SCHEMA.state,
): string {
  return nodePath.join(directory, `.adopted-${CLAUDE_MIGRATION_SCHEMA.state[key]}`);
}

function recordAdoption(directory: string, key: keyof typeof CLAUDE_MIGRATION_SCHEMA.state): void {
  try {
    writeDurableFile(adoptionReceipt(directory, key), '', { mode: 0o600 });
  } catch {
    // A missing receipt only costs a redundant reconciliation next run.
  }
}

/** Resolved per-project state directory, with legacy working-tree state adopted. */
function stateDirectory(cwd: string): string {
  const directory = claudeProjectStateDirectory(cwd);
  adoptLegacyProjectState(cwd, directory);
  return directory;
}

/**
 * Where one per-project state entry actually lives.
 *
 * Normally the plugin data directory, because adoption has already moved
 * anything the working tree held. When adoption could not complete — an
 * unwritable data directory, a full disk — it deliberately leaves the legacy
 * bytes intact, and this resolves to them rather than to the empty new path.
 * Retaining the source is worthless if no reader can find it: a stranded
 * cleanup transaction would read as "no migration in progress", and a stranded
 * marker would hide the preserved paths `delivery-schema.ts` reads from it.
 *
 * One resolver serves reads, writes and deletes, which is what makes the
 * fallback safe: an exclusive create still collides with a stranded
 * transaction instead of opening a second one beside it.
 */
export function claudeProjectStatePath(
  cwd: string,
  key: keyof typeof CLAUDE_MIGRATION_SCHEMA.state,
): string {
  const directory = stateDirectory(cwd);
  const adoptedPath = nodePath.join(directory, CLAUDE_MIGRATION_SCHEMA.state[key]);
  if (existsSync(adoptedPath)) return adoptedPath;
  // Adoption may publish the copy and still fail to remove the source, leaving
  // both. Falling back on the source's mere presence would then resurrect it:
  // deleting a completed transaction would make its stale twin read as pending
  // again, and recovery would loop. The receipt records that this key was
  // adopted, so a source that outlived its adoption never resolves again.
  if (existsSync(adoptionReceipt(directory, key))) return adoptedPath;
  const legacy = nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.legacy[key]);
  return existsSync(legacy) ? legacy : adoptedPath;
}

function attemptsPath(cwd: string): string {
  return claudeProjectStatePath(cwd, 'attemptsDirectory');
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
  if (!validDigest(stateDigest))
    throw new TypeError('Claude migration advisory digest is invalid.');
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
  return claudeProjectStatePath(cwd, 'pluginMarkerV2');
}

function validDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[\da-f]{64}$/u.test(value);
}

function validPluginMode(value: Partial<ClaudePluginModeV2>): value is ClaudePluginModeV2 {
  const unresolvedPaths = value.unresolved_paths;
  const consistentState =
    (value.state === 'clean' && unresolvedPaths?.length === 0) ||
    (value.state === 'unresolved' && (unresolvedPaths?.length ?? 0) > 0);
  return [
    value.schema_version === 2,
    ['clean', 'unresolved'].includes(value.state ?? ''),
    typeof value.plugin_version === 'string',
    validDigest(value.hook_manifest_sha256),
    validDigest(value.catalogue_sha256),
    Array.isArray(unresolvedPaths),
    Array.isArray(unresolvedPaths) && unresolvedPaths.every(item => typeof item === 'string'),
    consistentState,
  ].every(Boolean);
}

export function readClaudePluginMode(cwd: string): ClaudePluginModeV2 | undefined {
  try {
    const path = markerPath(cwd);
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
  const normalized = createClaudePluginMode({
    plugin_version: marker.plugin_version,
    hook_manifest_sha256: marker.hook_manifest_sha256,
    catalogue_sha256: marker.catalogue_sha256,
    unresolved_paths: marker.unresolved_paths,
    ...(marker.advisory !== undefined && { advisory: marker.advisory }),
    ...(marker.transaction_id !== undefined && { transaction_id: marker.transaction_id }),
  });
  writeDurableFile(markerPath(cwd), `${JSON.stringify(normalized, undefined, 2)}\n`, {
    mode: 0o600,
  });
}

export function writeClaudeMigrationAttention(
  cwd: string,
  attention: ClaudeMigrationAttentionV1,
): void {
  writeDurableFile(
    claudeProjectStatePath(cwd, 'attention'),
    `${JSON.stringify(attention, undefined, 2)}\n`,
    { mode: 0o600 },
  );
}

export function hasLegacyClaudePluginMode(cwd: string): boolean {
  return existsSync(nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.legacy.pluginMarker));
}

export function removeLegacyClaudePluginMode(cwd: string): void {
  rmSync(nodePath.join(cwd, CLAUDE_MIGRATION_SCHEMA.legacy.pluginMarker), { force: true });
}
