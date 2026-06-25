import { execFileSync as nodeExecFileSync, execSync as nodeExecSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

import { isDogfoodRepo } from './dogfood.js';
import {
  clearUpgradeFailures,
  MAX_UPGRADE_ATTEMPTS,
  recordUpgradeFailure,
  releaseAgeStatus,
  shouldAttemptUpgrade,
  type UpdateCache,
} from './update-cache.js';
import { bumpType, upgradeDecision } from './version.js';

export const CHECK_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

export type AutoUpgradeOutcome =
  | { kind: 'skipped'; reason: string }
  | { kind: 'notify'; message: string }
  | { kind: 'applied'; message: string }
  | { kind: 'failure-cap'; message: string };

export interface HookProcessResponse {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

type ExecOptions = {
  cwd: string;
  encoding: 'utf8';
  maxBuffer: number;
  stdio?: 'pipe';
};

export type ExecSyncLike = (command: string, options: ExecOptions) => string;
export type ExecFileSyncLike = (
  command: string,
  args: readonly string[],
  options: ExecOptions,
) => string;

export type SafewordFileFilter = (
  changedFiles: readonly string[],
  untrackedFiles: readonly string[],
) => readonly string[];

export interface RollbackSafewordFilesOptions {
  projectDir: string;
  changedFiles: readonly string[];
  untrackedFiles: readonly string[];
  stagedFiles?: readonly string[];
  filterSafewordFiles: SafewordFileFilter;
  execFileSync?: ExecFileSyncLike;
}

export interface RunAutoUpgradeOptions {
  projectDir: string;
  filterSafewordFiles: SafewordFileFilter;
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  fetchLatestFromNpm?: () => Promise<UpdateCache | undefined>;
  execSync?: ExecSyncLike;
  execFileSync?: ExecFileSyncLike;
  dogfoodRepo?: (projectDir: string) => boolean;
}

function defaultExecSync(command: string, options: ExecOptions): string {
  return nodeExecSync(command, options) as string;
}

function defaultExecFileSync(
  command: string,
  args: readonly string[],
  options: ExecOptions,
): string {
  return nodeExecFileSync(command, [...args], options) as string;
}

function splitGitList(output: string): string[] {
  return output
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

/**
 * Fetch the latest version + publish time from npm's packument. Fails closed:
 * network, parse, or missing publish-time errors return undefined so callers
 * can fall back to an existing cache or skip silently.
 */
export async function fetchLatestSafewordFromNpm(
  now: () => number = Date.now,
): Promise<UpdateCache | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);
    const response = await fetch('https://registry.npmjs.org/safeword', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return undefined;

    const data = (await response.json()) as {
      'dist-tags'?: { latest?: string };
      time?: Record<string, string>;
    };
    const latestVersion = data['dist-tags']?.latest;
    const publishedAtIso = latestVersion ? data.time?.[latestVersion] : undefined;
    if (!latestVersion || !publishedAtIso) return undefined;

    const publishedAt = Date.parse(publishedAtIso);
    if (Number.isNaN(publishedAt)) return undefined;

    return { latestVersion, publishedAt, checkedAt: now() };
  } catch {
    return undefined;
  }
}

export function writeCacheAtomic(cachePath: string, cache: UpdateCache, now: () => number): void {
  const tempPath = `${cachePath}.tmp-${now()}-${Math.random().toString(36).slice(2)}`;
  writeFileSync(tempPath, JSON.stringify(cache), 'utf8');
  renameSync(tempPath, cachePath);
}

async function loadOrRefreshCache(
  cachePath: string,
  now: () => number,
  fetchLatest: () => Promise<UpdateCache | undefined>,
): Promise<UpdateCache | undefined> {
  let cache: UpdateCache | undefined;
  if (existsSync(cachePath)) {
    try {
      cache = JSON.parse(readFileSync(cachePath, 'utf8')) as UpdateCache;
    } catch {
      cache = undefined;
    }
  }

  const fresh = cache?.checkedAt !== undefined && now() - cache.checkedAt < CHECK_COOLDOWN_MS;
  if (fresh) return cache;

  const fetched = await fetchLatest();
  if (!fetched) return cache;

  const merged: UpdateCache = { ...cache, ...fetched };
  writeCacheAtomic(cachePath, merged, now);
  return merged;
}

function isAutoUpgradeDisabled(safewordDir: string, env: NodeJS.ProcessEnv): boolean {
  if (env.SAFEWORD_NO_AUTO_UPGRADE || env.CI) return true;

  try {
    const configPath = `${safewordDir}/config.json`;
    if (!existsSync(configPath)) return false;
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { autoUpgrade?: boolean };
    return config.autoUpgrade === false;
  } catch {
    return false;
  }
}

function noticeOutcome(
  kind: 'notify' | 'applied' | 'failure-cap',
  message: string,
): AutoUpgradeOutcome {
  return { kind, message };
}

export function toClaudeAutoUpgradeResponse(outcome: AutoUpgradeOutcome): HookProcessResponse {
  if ('message' in outcome) {
    return { exitCode: 2, stderr: `${outcome.message}\n` };
  }
  return { exitCode: 0 };
}

export function toCodexSessionStartResponse({
  outcome,
  additionalContext,
}: {
  outcome: AutoUpgradeOutcome;
  additionalContext?: string | null;
}): HookProcessResponse {
  const output: {
    systemMessage?: string;
    hookSpecificOutput?: {
      hookEventName: 'SessionStart';
      additionalContext: string;
    };
  } = {};

  if ('message' in outcome) {
    output.systemMessage = outcome.message;
  }

  if (additionalContext) {
    output.hookSpecificOutput = {
      hookEventName: 'SessionStart',
      additionalContext,
    };
  }

  if (!output.systemMessage && !output.hookSpecificOutput) {
    return { exitCode: 0 };
  }

  return { exitCode: 0, stdout: `${JSON.stringify(output)}\n` };
}

export function rollbackSafewordManagedFiles({
  projectDir,
  changedFiles,
  untrackedFiles,
  stagedFiles = [],
  filterSafewordFiles,
  execFileSync = defaultExecFileSync,
}: RollbackSafewordFilesOptions): string[] {
  const changedOrStagedFiles = [...new Set([...changedFiles, ...stagedFiles])];
  const filesToRollback = [
    ...new Set([...filterSafewordFiles(changedOrStagedFiles, untrackedFiles)]),
  ];
  if (filesToRollback.length === 0) return [];

  const changedOrStagedSet = new Set(changedOrStagedFiles);
  const untrackedSet = new Set(untrackedFiles);
  const resetFiles = filesToRollback.filter(file => changedOrStagedSet.has(file));
  const checkoutFiles = resetFiles;
  const cleanFiles = filesToRollback.filter(
    file => untrackedSet.has(file) || (stagedFiles.includes(file) && !changedFiles.includes(file)),
  );

  const execOptions: ExecOptions = {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: 'pipe',
  };

  if (resetFiles.length > 0) {
    execFileSync('git', ['reset', '--', ...resetFiles], execOptions);
  }
  for (const file of checkoutFiles) {
    try {
      execFileSync('git', ['checkout', '--', file], execOptions);
    } catch {
      // A staged added file has no HEAD version; cleanFiles removes it below.
    }
  }
  if (cleanFiles.length > 0) {
    execFileSync('git', ['clean', '-f', '--', ...cleanFiles], execOptions);
  }

  return filesToRollback;
}

export async function runAutoUpgrade({
  projectDir,
  filterSafewordFiles,
  env = process.env,
  now = Date.now,
  fetchLatestFromNpm = () => fetchLatestSafewordFromNpm(now),
  execSync = defaultExecSync,
  execFileSync = defaultExecFileSync,
  dogfoodRepo = isDogfoodRepo,
}: RunAutoUpgradeOptions): Promise<AutoUpgradeOutcome> {
  const safewordDir = `${projectDir}/.safeword`;

  if (!existsSync(safewordDir)) {
    return { kind: 'skipped', reason: 'missing safeword directory' };
  }

  if (dogfoodRepo(projectDir)) {
    return { kind: 'skipped', reason: 'dogfood repository' };
  }

  if (isAutoUpgradeDisabled(safewordDir, env)) {
    return { kind: 'skipped', reason: 'auto-upgrade disabled' };
  }

  const versionPath = `${safewordDir}/version`;
  const currentVersion = existsSync(versionPath)
    ? readFileSync(versionPath, 'utf8').trim()
    : '0.0.0';

  const cachePath = `${safewordDir}/.update-cache.json`;
  const cache = (await loadOrRefreshCache(cachePath, now, fetchLatestFromNpm)) ?? {};
  const latest = cache.latestVersion;
  if (!latest) {
    return { kind: 'skipped', reason: 'missing latest version' };
  }

  if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)*$/.test(latest)) {
    return { kind: 'skipped', reason: 'invalid latest version' };
  }

  const bump = bumpType(currentVersion, latest);
  const decision = upgradeDecision(bump);

  if (decision === 'skip') {
    return { kind: 'skipped', reason: 'latest is not newer' };
  }

  if (decision === 'notify') {
    return noticeOutcome(
      'notify',
      `v${latest} available (${bump}) — run \`bunx safeword@${latest} upgrade\` to update`,
    );
  }

  if (!shouldAttemptUpgrade(cache, latest)) {
    return { kind: 'skipped', reason: 'failure cap already reached' };
  }

  const ageStatus = releaseAgeStatus(cache.publishedAt, now());
  if (ageStatus.state === 'unknown' || ageStatus.state === 'cooling') {
    return { kind: 'skipped', reason: `release age ${ageStatus.state}` };
  }

  const execOptions: ExecOptions = {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  };

  function gitOk(args: string): boolean {
    try {
      execSync(`git ${args}`, { ...execOptions, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  try {
    const status = execSync('git status --porcelain', execOptions).trim();
    if (status) {
      return { kind: 'skipped', reason: 'dirty working tree' };
    }
  } catch {
    return { kind: 'skipped', reason: 'not a git repository' };
  }

  if (!gitOk('symbolic-ref -q HEAD') || gitOk('rev-parse -q --verify MERGE_HEAD')) {
    return { kind: 'skipped', reason: 'unsafe git state' };
  }

  try {
    execFileSync('bunx', [`safeword@${latest}`, 'upgrade'], { ...execOptions, stdio: 'pipe' });

    const changedFiles = splitGitList(execSync('git diff --name-only', execOptions));
    const untrackedFiles = splitGitList(
      execSync('git ls-files --others --exclude-standard', execOptions),
    );
    const filesToStage = [...filterSafewordFiles(changedFiles, untrackedFiles)];

    if (filesToStage.length > 0) {
      execFileSync('git', ['add', ...filesToStage], execOptions);
      execFileSync(
        'git',
        ['commit', '-m', `chore: safeword auto-upgrade v${currentVersion} → v${latest}`],
        { ...execOptions, stdio: 'pipe' },
      );
    }
  } catch {
    try {
      const changedFiles = splitGitList(execSync('git diff --name-only', execOptions));
      const stagedFiles = splitGitList(execSync('git diff --cached --name-only', execOptions));
      const untrackedFiles = splitGitList(
        execSync('git ls-files --others --exclude-standard', execOptions),
      );
      rollbackSafewordManagedFiles({
        projectDir,
        changedFiles,
        stagedFiles,
        untrackedFiles,
        filterSafewordFiles,
        execFileSync,
      });
    } catch {
      // Best-effort rollback: preserve the original failure handling below.
    }

    const failure = recordUpgradeFailure(cache, latest);
    writeCacheAtomic(cachePath, failure.cache, now);

    if (failure.reachedCap) {
      return noticeOutcome(
        'failure-cap',
        `auto-upgrade to v${latest} failed ${MAX_UPGRADE_ATTEMPTS}× — run \`bunx safeword@${latest} upgrade\` manually, or disable with \`autoUpgrade: false\` in .safeword/config.json`,
      );
    }
    return { kind: 'skipped', reason: 'upgrade failed below failure cap' };
  }

  try {
    if (cache.failedAttempts) {
      writeCacheAtomic(cachePath, clearUpgradeFailures(cache), now);
    }
  } catch {
    // The upgrade already succeeded; failure-state cleanup is best effort.
  }

  return noticeOutcome('applied', `Auto-upgraded v${currentVersion} → v${latest}`);
}
