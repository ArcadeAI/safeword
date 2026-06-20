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
