import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

const LOCK_FILE_NAME = 'safeword-auto-upgrade.lock';
const LOCK_MAX_AGE_MS = 10 * 60 * 1000;

export const AUTO_UPGRADE_LOCK_MESSAGE =
  'Safeword auto-upgrade is already updating this repository. Wait a moment, then retry this edit.';

type LockFile = {
  pid: number;
  startedAt: number;
};

function resolveGitCommonDirectory({ projectDir }: { projectDir: string }): string | undefined {
  try {
    const output = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!output) return undefined;
    return nodePath.resolve(projectDir, output);
  } catch {
    return undefined;
  }
}

export function autoUpgradeLockPath({ projectDir }: { projectDir: string }): string | undefined {
  const gitDirectory = resolveGitCommonDirectory({ projectDir });
  return gitDirectory ? nodePath.join(gitDirectory, LOCK_FILE_NAME) : undefined;
}

function readLock({ lockPath }: { lockPath: string }): LockFile | undefined {
  try {
    const parsed = JSON.parse(readFileSync(lockPath, 'utf8')) as Partial<LockFile>;
    if (typeof parsed.pid !== 'number' || typeof parsed.startedAt !== 'number') return undefined;
    return { pid: parsed.pid, startedAt: parsed.startedAt };
  } catch {
    return undefined;
  }
}

export function releaseAutoUpgradeLock({ lockPath }: { lockPath: string | undefined }): void {
  if (!lockPath) return;
  rmSync(lockPath, { force: true });
}

export function isAutoUpgradeLockActive({
  projectDir,
  now = Date.now,
}: {
  projectDir: string;
  now?: () => number;
}): boolean {
  const lockPath = autoUpgradeLockPath({ projectDir });
  if (!lockPath) return false;

  const lock = readLock({ lockPath });
  if (lock && now() - lock.startedAt < LOCK_MAX_AGE_MS) return true;

  releaseAutoUpgradeLock({ lockPath });
  return false;
}

export function acquireAutoUpgradeLock({
  projectDir,
  now = Date.now,
}: {
  projectDir: string;
  now?: () => number;
}): string | undefined {
  const lockPath = autoUpgradeLockPath({ projectDir });
  if (!lockPath) return undefined;
  if (isAutoUpgradeLockActive({ projectDir, now })) return undefined;

  mkdirSync(nodePath.dirname(lockPath), { recursive: true });
  try {
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: now() }), {
      encoding: 'utf8',
      flag: 'wx',
    });
    return lockPath;
  } catch {
    return undefined;
  }
}
