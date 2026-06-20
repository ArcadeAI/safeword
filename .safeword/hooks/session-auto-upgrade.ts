#!/usr/bin/env bun
// Safeword: Auto-upgrade at session start (SessionStart)
// Refreshes .safeword/.update-cache.json (24h-throttled npm fetch), then applies
// patch + minor upgrades with a dedicated commit.
// Skips if: major bump, dirty working tree, autoUpgrade disabled, or CI environment.
//
// Wired as an `asyncRewake` hook (see config.ts), so it runs in the background and
// never blocks session start. Because the check and the apply happen in the same
// pass, an upgrade lands the session it's discovered — no check→apply handoff lag.
// User-facing outcomes (upgraded / major available / blocked) are surfaced by
// exiting with code 2, which delivers the stderr message to Claude as a system
// reminder. Transient skips (cooling, dirty tree, opted out) exit 0 and stay
// silent to avoid per-session noise.
// Policy reference: .claude/skills/versioning/SKILL.md

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync } from 'node:fs';

import { isDogfoodRepo } from './lib/dogfood.ts';
import { filterSafewordFiles } from './lib/owned-paths.ts';
import { releaseAgeStatus, type UpdateCache } from './lib/update-cache.ts';
import { bumpType, upgradeDecision } from './lib/version.ts';

const CHECK_COOLDOWN_MS = 24 * 60 * 60 * 1000; // throttle npm registry polling to once/day

/**
 * Fetch the latest version + its publish time from the npm registry.
 * Returns undefined on any network/parse failure (caller falls back to cache).
 *
 * Uses the full packument (not /safeword/latest) so we can read `time[version]`,
 * which is npm-generated (tamper-resistant) and feeds the release-age cooldown.
 * Fails closed: a missing version or publish time yields undefined rather than a
 * partial cache, since the auto-upgrade path treats missing `publishedAt` as
 * "too new" and would otherwise block indefinitely.
 */
async function fetchLatestFromNpm(): Promise<UpdateCache | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3000);
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

    return { latestVersion, publishedAt, checkedAt: Date.now() };
  } catch {
    return undefined; // network failure — caller falls back to existing cache
  }
}

/**
 * Return a fresh-enough cache: reuse the on-disk cache while it's within the 24h
 * cooldown, otherwise refresh from npm and write it back atomically. A failed
 * refresh falls back to whatever cache exists (possibly undefined when offline).
 */
async function loadOrRefreshCache(cachePath: string): Promise<UpdateCache | undefined> {
  const cacheFile = Bun.file(cachePath);
  let cache: UpdateCache | undefined;
  if (await cacheFile.exists()) {
    try {
      cache = (await cacheFile.json()) as UpdateCache;
    } catch {
      cache = undefined; // corrupted — treat as missing and refresh
    }
  }

  const fresh = cache?.checkedAt !== undefined && Date.now() - cache.checkedAt < CHECK_COOLDOWN_MS;
  if (fresh) return cache;

  const fetched = await fetchLatestFromNpm();
  if (!fetched) return cache; // offline — keep last known cache

  // Atomic write (temp file + rename) so a concurrent reader never sees a partial file.
  // Random suffix avoids a temp-name collision between two near-simultaneous starts.
  const tempPath = `${cachePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await Bun.write(tempPath, JSON.stringify(fetched));
  renameSync(tempPath, cachePath);
  return fetched;
}

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDir = `${projectDir}/.safeword`;

if (!existsSync(safewordDir)) {
  process.exit(0);
}

// Skip the safeword dev (dogfood) repo entirely (ticket 975N5T). Its `.safeword/`
// + `.claude/` are deployed mirrors of the LOCAL `packages/cli/templates/` source
// (routinely ahead of npm); installing the published package would regress
// unreleased work, and the follow-up commit is blocked by the dogfood-direction
// pre-commit guard. No version compare, no "available" message, no install.
if (isDogfoodRepo(projectDir)) {
  process.exit(0);
}

// --- Read current version ---
const versionPath = `${safewordDir}/version`;
const currentVersion = existsSync(versionPath) ? readFileSync(versionPath, 'utf8').trim() : '0.0.0';

// --- Refresh or load the update cache (24h-throttled npm fetch) ---
const cachePath = `${safewordDir}/.update-cache.json`;
const cache = await loadOrRefreshCache(cachePath);
const latest = cache?.latestVersion;
if (!latest) {
  process.exit(0); // No version info (offline first run, or corrupted) — retry next session
}

// --- Version comparison + policy decision ---
// Policy is defined in lib/version.ts:upgradeDecision and pinned by unit tests.
const bump = bumpType(currentVersion, latest);
const decision = upgradeDecision(bump);

if (decision === 'skip') {
  process.exit(0); // No update needed (latest <= current)
}

// --- Check opt-out (before notify too) ---
// Opt-out suppresses BOTH the major-available notify and the auto-apply: if the
// user turned safeword upgrades off — or we're in CI — don't wake Claude every
// session. Silent (exit 0). A user who still wants major-version awareness can
// run `safeword check` manually.
if (process.env.SAFEWORD_NO_AUTO_UPGRADE || process.env.CI) {
  process.exit(0);
}

// Check config file opt-out
try {
  const configPath = `${safewordDir}/config.json`;
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { autoUpgrade?: boolean };
    if (config.autoUpgrade === false) {
      process.exit(0);
    }
  }
} catch {
  // Config parse error, proceed with upgrade
}

if (decision === 'notify') {
  // Major bump — may carry breaking changes, so we notify rather than apply.
  // exit 2 delivers this message to Claude (asyncRewake rewake contract).
  console.error(
    `SAFEWORD: v${latest} available (${bump}) — run \`bunx safeword@${latest} upgrade\` to update`,
  );
  process.exit(2);
}

// decision === 'apply' (patch or minor) — proceed to upgrade

// --- Check release-age cooldown ---
// Supply-chain defense: don't install versions published <24h ago. See
// lib/update-cache.ts for rationale and threat model.
// Transient (exit 0, silent): the upgrade applies automatically once the
// cooldown clears or the cache refreshes — no need to interrupt every session.
const ageStatus = releaseAgeStatus(cache?.publishedAt, Date.now());
if (ageStatus.state === 'unknown' || ageStatus.state === 'cooling') {
  process.exit(0);
}

// Node's execSync defaults to a 1MB stdout/stderr buffer and kills the subprocess
// with ENOBUFS on overflow. `safeword upgrade` output exceeds that on a real
// install, so we raise the ceiling for every shell-out. 50MB is generous; real
// upgrade output is well under 1MB but headroom is cheap.
const execOpts = {
  cwd: projectDir,
  encoding: 'utf8' as const,
  maxBuffer: 50 * 1024 * 1024,
};

// --- Check dirty working tree ---
try {
  const status = execSync('git status --porcelain', execOpts).trim();
  if (status) {
    // Transient (exit 0, silent): retries automatically next clean session.
    process.exit(0);
  }
} catch {
  // Not a git repo or git not available — skip auto-upgrade
  process.exit(0);
}

// --- Perform upgrade ---
try {
  // Run the exact version (not @latest) to avoid supply chain ambiguity
  execSync(`bunx safeword@${latest} upgrade`, { ...execOpts, stdio: 'pipe' });

  // Stage only safeword-managed files that changed
  const changedFiles = execSync('git diff --name-only', execOpts)
    .trim()
    .split('\n')
    .filter(Boolean);
  const untrackedFiles = execSync('git ls-files --others --exclude-standard', execOpts)
    .trim()
    .split('\n')
    .filter(Boolean);

  const filesToStage = filterSafewordFiles(changedFiles, untrackedFiles);

  if (filesToStage.length > 0) {
    // execFileSync (no shell): filenames pass as args — no fragile manual
    // quoting that breaks on a name containing a quote or shell metacharacter.
    execFileSync('git', ['add', ...filesToStage], execOpts);
    execFileSync(
      'git',
      ['commit', '-m', `chore: safeword auto-upgrade v${currentVersion} → v${latest}`],
      { ...execOpts, stdio: 'pipe' },
    );
  }

  // exit 2 surfaces the outcome to Claude (asyncRewake rewake contract).
  console.error(`SAFEWORD: Auto-upgraded v${currentVersion} → v${latest}`);
  process.exit(2);
} catch {
  // Don't echo the raw error (it would pollute Claude's context). A capped,
  // actionable failure message is ticket XQ9CXA item #2.
  console.error(`SAFEWORD: Auto-upgrade to v${latest} failed — will retry next session`);
  process.exit(2);
}
