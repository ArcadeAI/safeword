import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
  type Stats,
} from 'node:fs';
import nodePath from 'node:path';
export const CLAUDE_PLUGIN_ID = 'safeword@safeword';

export const CLAUDE_MIGRATION_SCHEMA = {
  paths: {
    proof: 'plugins/data/safeword-safeword/execution-proof-v1.json',
    proofDirectory: 'plugins/data/safeword-safeword/execution-proofs-v2',
    pluginMarker: '.safeword/claude-plugin/plugin-mode-v1.json',
    pluginMarkerV2: '.safeword/claude-plugin/plugin-mode-v2.json',
    attention: '.safeword/claude-plugin/attention-v1.json',
    attemptsDirectory: '.safeword/claude-plugin/attempts-v1',
    transaction: '.safeword/claude-plugin/cleanup-transaction-v1.json',
  },
} as const;

/** Files required to authenticate and execute the native Claude delivery surface. */
export const CLAUDE_NATIVE_REQUIRED_ASSETS = [
  '.claude-plugin/plugin.json',
  'hooks/hooks.json',
  'runtime/cli.js',
  'runtime/dispatch.js',
  'runtime/event-groups.json',
] as const;

export const CLAUDE_NATIVE_METADATA_FILES = [
  'README.md',
  'identity.json',
  'inventory.json',
] as const;

const MAX_CLAUDE_CACHE_METADATA_BYTES = 1024;

function isSmallRegularMetadata(metadata: Stats): boolean {
  return (
    metadata.isFile() &&
    !metadata.isSymbolicLink() &&
    metadata.size <= MAX_CLAUDE_CACHE_METADATA_BYTES
  );
}

function isSameSmallMetadata(before: Stats, opened: Stats, after: Stats): boolean {
  return (
    opened.isFile() &&
    isSmallRegularMetadata(after) &&
    opened.dev === before.dev &&
    opened.ino === before.ino &&
    opened.dev === after.dev &&
    opened.ino === after.ino &&
    opened.nlink === 1 &&
    opened.size <= MAX_CLAUDE_CACHE_METADATA_BYTES
  );
}

function readSmallDescriptor(descriptor: number): string | undefined {
  const buffer = Buffer.alloc(MAX_CLAUDE_CACHE_METADATA_BYTES + 1);
  let offset = 0;
  while (offset < buffer.length) {
    const count = readSync(descriptor, buffer, offset, buffer.length - offset, offset);
    if (count === 0) break;
    offset += count;
  }
  return offset > MAX_CLAUDE_CACHE_METADATA_BYTES
    ? undefined
    : buffer.subarray(0, offset).toString('utf8');
}

function readSmallMetadataFile(path: string): string | undefined {
  let descriptor: number | undefined;
  try {
    const linkedBefore = lstatSync(path);
    if (!isSmallRegularMetadata(linkedBefore)) return undefined;
    descriptor = openSync(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NONBLOCK | (fsConstants.O_NOFOLLOW ?? 0),
    );
    const opened = fstatSync(descriptor);
    const linkedAfter = lstatSync(path);
    if (!isSameSmallMetadata(linkedBefore, opened, linkedAfter)) return undefined;
    const content = readSmallDescriptor(descriptor);
    const final = fstatSync(descriptor);
    return content !== undefined && isSameSmallMetadata(linkedBefore, final, linkedAfter)
      ? content
      : undefined;
  } catch {
    return undefined;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function isLeaseRecord(value: unknown, expectedPid: number): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const hasExactFields =
    Object.keys(record).length === 2 &&
    Object.hasOwn(record, 'pid') &&
    Object.hasOwn(record, 'procStart');
  return (
    hasExactFields &&
    Number.isSafeInteger(record.pid) &&
    record.pid === expectedPid &&
    typeof record.procStart === 'string' &&
    record.procStart.length > 0
  );
}

/**
 * Claude Code writes an `.in_use/<pid>` lease by creating `<pid>.tmp.<hex>` and
 * renaming it into place. A process that dies between the write and the rename
 * leaves the temp name behind forever, so both forms are host-owned metadata.
 * Rejecting the orphan made every Safeword hook fail closed until someone
 * deleted it by hand (#3690).
 */
const LEASE_TEMP_INFIX = '.tmp.';
const LEASE_PID = /^\d{1,10}$/u;
const LEASE_TEMP_SUFFIX = /^[0-9a-f]{1,32}$/u;

/** The PID a lease file name claims, or undefined when it is not a lease name. */
function leaseMarkerPid(name: string): string | undefined {
  const infix = name.indexOf(LEASE_TEMP_INFIX);
  if (infix === -1) return LEASE_PID.test(name) ? name : undefined;
  const pid = name.slice(0, infix);
  const suffix = name.slice(infix + LEASE_TEMP_INFIX.length);
  if (!LEASE_PID.test(pid) || !LEASE_TEMP_SUFFIX.test(suffix)) return undefined;
  return pid;
}

/**
 * True once the entry is gone from the directory we just listed. Claude completes
 * the rename mid-traversal, so a lease temp routinely disappears between
 * `readdirSync` and the read. Accepting that is safe because nothing loads a path
 * that no longer exists; a file still present with the wrong content is a payload
 * file and stays rejected below. Only ENOENT qualifies, so an entry we merely
 * failed to stat keeps failing closed.
 *
 * The observation is point-in-time: a path that ENOENTs here and is recreated
 * afterwards is absent from the list `validateNativePayload` compares against the
 * inventory. That window already applies to an accepted `<pid>` lease and needs
 * write access to the installed cache, so it bounds the claim rather than
 * weakening it — this is not protection against an actor already inside the
 * plugin cache.
 */
function vanishedDuringScan(path: string): boolean {
  try {
    lstatSync(path);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}

function isClaudeLeaseMarker(path: string, name: string): boolean {
  const pid = leaseMarkerPid(name);
  if (pid === undefined) return false;
  const content = readSmallMetadataFile(path);
  // `leaseMarkerPid` already proved the whole `<pid>.tmp.<hex>` shape, so an
  // unreadable temp name that is now absent was renamed onto its final `<pid>`.
  if (content === undefined) return name.includes(LEASE_TEMP_INFIX) && vanishedDuringScan(path);
  try {
    return isLeaseRecord(JSON.parse(content) as unknown, Number(pid));
  } catch {
    return false;
  }
}

function isClaudeCacheMetadataFile(
  logicalDirectory: string,
  physicalPath: string,
  entry: { readonly name: string; isFile(): boolean },
): boolean {
  if (!entry.isFile()) return false;
  if (logicalDirectory === '.in_use') return isClaudeLeaseMarker(physicalPath, entry.name);
  if (logicalDirectory !== '' || entry.name !== '.orphaned_at') return false;
  return /^\d{13}\n?$/u.test(readSmallMetadataFile(physicalPath) ?? '');
}

interface DirectoryIdentity {
  readonly canonical: string;
  readonly device: number;
  readonly inode: number;
}

function directoryIdentity(
  physicalDirectory: string,
  logicalDirectory: string,
  canonicalRoot: string,
): DirectoryIdentity {
  const metadata = lstatSync(physicalDirectory);
  const canonical = realpathSync(physicalDirectory);
  const insideRoot =
    canonical === canonicalRoot || canonical.startsWith(`${canonicalRoot}${nodePath.sep}`);
  if (!metadata.isDirectory() || !insideRoot) {
    throw new Error(`Claude plugin cache traversal escaped its root: ${logicalDirectory || '.'}`);
  }
  return { canonical, device: metadata.dev, inode: metadata.ino };
}

/** Enumerate files without following untrusted symlinks in an installed plugin cache. */
export function claudeNativePayloadFiles(root: string): string[] {
  const files: string[] = [];
  const canonicalRoot = realpathSync(root);
  const visit = (physicalDirectory: string, logicalDirectory: string): void => {
    const before = directoryIdentity(physicalDirectory, logicalDirectory, canonicalRoot);
    const entries = readdirSync(physicalDirectory, { withFileTypes: true });
    const after = directoryIdentity(physicalDirectory, logicalDirectory, canonicalRoot);
    if (
      before.device !== after.device ||
      before.inode !== after.inode ||
      before.canonical !== after.canonical
    ) {
      throw new Error(`Claude plugin cache changed during traversal: ${logicalDirectory || '.'}`);
    }
    for (const entry of entries) {
      const physicalPath = nodePath.join(physicalDirectory, entry.name);
      const logicalPath =
        logicalDirectory === '' ? entry.name : nodePath.posix.join(logicalDirectory, entry.name);
      // Claude owns cache lifecycle metadata next to the copied plugin payload.
      // Validate its exact shape so this exception cannot conceal payload files.
      if (isClaudeCacheMetadataFile(logicalDirectory, physicalPath, entry)) continue;
      // Symlinks are returned as leaf paths. Callers must reject them with lstat
      // when listed, or as unexpected paths when they are absent from inventory.
      if (entry.isDirectory()) visit(physicalPath, logicalPath);
      else files.push(logicalPath);
    }
  };
  visit(root, '');
  return files;
}
