import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;

interface LockRecord {
  readonly owner: string;
  readonly acquired_at: number;
}

export interface ProfileLock {
  readonly path: string;
  readonly owner: string;
}

export interface ProfileLockOptions {
  readonly owner?: string;
  readonly now?: () => number;
  readonly maxAgeMs?: number;
}

function readRecord(path: string): LockRecord | undefined {
  try {
    const value = JSON.parse(
      readFileSync(nodePath.join(path, 'owner.json'), 'utf8'),
    ) as Partial<LockRecord>;
    return typeof value.owner === 'string' && typeof value.acquired_at === 'number'
      ? { owner: value.owner, acquired_at: value.acquired_at }
      : undefined;
  } catch {
    return undefined;
  }
}

function lockAge(path: string, now: number): number {
  const record = readRecord(path);
  if (record !== undefined) return now - record.acquired_at;
  try {
    return now - statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function createLock(path: string, owner: string, now: number): ProfileLock | undefined {
  try {
    mkdirSync(path);
    writeFileSync(
      nodePath.join(path, 'owner.json'),
      `${JSON.stringify({ owner, acquired_at: now })}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
    return { path, owner };
  } catch {
    return undefined;
  }
}

export function acquireProfileLock(
  path: string,
  options: ProfileLockOptions = {},
): ProfileLock | undefined {
  const owner = options.owner ?? randomUUID();
  const now = (options.now ?? Date.now)();
  mkdirSync(nodePath.dirname(path), { recursive: true });
  const gate = `${path}.acquire`;
  try {
    mkdirSync(gate);
  } catch {
    return undefined;
  }
  try {
    const acquired = createLock(path, owner, now);
    if (acquired !== undefined) return acquired;
    if (lockAge(path, now) <= (options.maxAgeMs ?? DEFAULT_MAX_AGE_MS)) return undefined;
    rmSync(path, { recursive: true, force: true });
    return createLock(path, owner, now);
  } finally {
    rmSync(gate, { recursive: true, force: true });
  }
}

export function releaseProfileLock(lock: ProfileLock): boolean {
  if (readRecord(lock.path)?.owner !== lock.owner) return false;
  rmSync(lock.path, { recursive: true, force: true });
  return true;
}
