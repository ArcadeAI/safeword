/**
 * Shared types and helpers for `.safeword/.update-cache.json`.
 *
 * The cache is written by session-update-check.ts (async npm registry fetch)
 * and read by session-auto-upgrade.ts (gating decisions before upgrade).
 *
 * `releaseAgeStatus` is the supply-chain defense: it returns whether a
 * version is too freshly published to auto-install. Mirrors pnpm's
 * `minimumReleaseAge` (https://pnpm.io/supply-chain-security) — the
 * 24h window lets the community detect and yank malicious releases
 * before they auto-propagate.
 */

/** Shape of `.safeword/.update-cache.json`. All fields optional for forward compat. */
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
