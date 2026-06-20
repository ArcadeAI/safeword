/**
 * Shared types and helpers for `.safeword/.update-cache.json`.
 *
 * The cache is written and read by session-auto-upgrade.ts, which refreshes it
 * with a 24h-throttled npm registry fetch and gates upgrade decisions on it.
 *
 * `releaseAgeStatus` is the supply-chain defense: it returns whether a
 * version is too freshly published to auto-install. Mirrors pnpm's
 * `minimumReleaseAge` (https://pnpm.io/supply-chain-security) — the
 * 24h window lets the community detect and yank malicious releases
 * before they auto-propagate.
 */

/**
 * Shape of `.safeword/.update-cache.json`. All fields optional for forward compat.
 *
 * @public — consumed by session-auto-upgrade.ts via a `.ts`-extension import,
 * which knip's resolver doesn't trace. The tag suppresses the false-positive
 * "unused exports" finding.
 */
export interface UpdateCache {
  latestVersion?: string;
  /** Unix ms timestamp of when `latestVersion` was published to npm (from registry `time[version]`). */
  publishedAt?: number;
  /** Unix ms timestamp of the most recent successful registry poll. */
  checkedAt?: number;
  /** Consecutive failed auto-upgrade attempts against {@link failedVersion}. */
  failedAttempts?: number;
  /** The target version those failures are against; the counter resets when the latest version changes. */
  failedVersion?: string;
}

/** Default release-age cooldown — mirrors pnpm v11's `minimumReleaseAge` default of 1 day. */
export const RELEASE_AGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Discriminated result of the release-age gate.
 * - `unknown`: publishedAt is missing — fail closed, treat as too new
 * - `cooling`: version was published within the cooldown window
 * - `ready`: version is older than the cooldown threshold, safe to install
 *
 * Note: we fail closed on missing `publishedAt`. This intentionally diverges
 * from pnpm's `minimumReleaseAgeIgnoreMissingTime: true` default (which
 * fails open). pnpm's default is a usability concession for interactive
 * installs; our hook runs silently at session start, so fail-closed gives
 * the user a clear "waiting" message AND prevents an attacker who can
 * suppress the npm `time` field from bypassing the cooldown.
 */
export type ReleaseAgeStatus =
  | { state: 'unknown' }
  | { state: 'cooling'; remainingHours: number }
  | { state: 'ready' };

/**
 * Decide whether `publishedAt` is past the cooldown window.
 *
 * Pure function — takes `now` explicitly so tests don't need to mock Date.
 *
 * @param publishedAt Unix ms when the version was published. `undefined` → `unknown`.
 * @param now Unix ms current time.
 * @param cooldownMs Window in ms during which a fresh version is held back.
 *                   Defaults to {@link RELEASE_AGE_COOLDOWN_MS}.
 */
export function releaseAgeStatus(
  publishedAt: number | undefined,
  now: number,
  cooldownMs: number = RELEASE_AGE_COOLDOWN_MS,
): ReleaseAgeStatus {
  if (publishedAt === undefined) return { state: 'unknown' };
  const ageMs = now - publishedAt;
  if (ageMs >= cooldownMs) return { state: 'ready' };
  const remainingMs = cooldownMs - ageMs;
  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  return { state: 'cooling', remainingHours };
}

/**
 * After this many consecutive failed auto-upgrade attempts against the same
 * version, the hook stops retrying silently and surfaces one actionable message.
 * A circuit breaker: a failure that recurs this many times is structural
 * (commit signing, a rejecting pre-commit hook, a protected branch), not flaky,
 * so further silent retries are just per-session noise.
 */
export const MAX_UPGRADE_ATTEMPTS = 3;

/**
 * Whether to attempt the upgrade given prior recorded failures.
 *
 * Pure function. Returns `false` only once the failure count for the SAME
 * `latest` version has reached `max` — a different (newer) version always gets a
 * fresh attempt, since a new release may not carry whatever blocked the last one
 * (and gives a user who fixed their setup a clean retry).
 */
export function shouldAttemptUpgrade(
  cache: UpdateCache,
  latest: string,
  max: number = MAX_UPGRADE_ATTEMPTS,
): boolean {
  if (cache.failedVersion !== latest) return true;
  return (cache.failedAttempts ?? 0) < max;
}

/** Result of recording a failed attempt: the next cache plus whether this failure tripped the cap. */
export interface FailureRecord {
  cache: UpdateCache;
  attempts: number;
  /** True exactly when this failure brings the count to `max` — the caller surfaces the message once. */
  reachedCap: boolean;
}

/**
 * Compute the cache after a failed upgrade attempt against `latest`.
 *
 * Pure function — no I/O. The counter resets to 1 when the target version
 * changed (a fresh problem for a fresh version), otherwise increments.
 */
export function recordUpgradeFailure(
  cache: UpdateCache,
  latest: string,
  max: number = MAX_UPGRADE_ATTEMPTS,
): FailureRecord {
  const prior = cache.failedVersion === latest ? (cache.failedAttempts ?? 0) : 0;
  const attempts = prior + 1;
  return {
    cache: { ...cache, failedVersion: latest, failedAttempts: attempts },
    attempts,
    reachedCap: attempts === max,
  };
}

/** Clear failure state (call after a successful upgrade). Pure function. */
export function clearUpgradeFailures(cache: UpdateCache): UpdateCache {
  const { failedAttempts: _attempts, failedVersion: _version, ...rest } = cache;
  return rest;
}
