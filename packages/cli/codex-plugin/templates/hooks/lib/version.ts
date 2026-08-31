/**
 * Semantic version helpers for safeword hooks.
 *
 * Pure functions — no I/O, no side effects. Safe to unit-test.
 */

/** Parsed semver tuple: [major, minor, patch]. Missing components default to 0. */
export type ParsedVersion = [number, number, number];

/** Bump classification between two versions. */
export type BumpType = 'major' | 'minor' | 'patch' | 'none';

/**
 * Parse a dotted version string into a [major, minor, patch] tuple.
 * Missing components default to 0. Non-numeric components become NaN
 * (which is fine in practice — npm version strings are well-formed).
 *
 * @example parseVersion('0.30.1') // [0, 30, 1]
 * @example parseVersion('1.2')    // [1, 2, 0]
 */
export function parseVersion(v: string): ParsedVersion {
  const parts = v.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Standard three-way comparator. Returns -1 if a < b, 0 if equal, 1 if a > b.
 *
 * @example compareVersions('0.30.0', '0.30.1') // -1
 * @example compareVersions('0.30.1', '0.30.1') // 0
 * @example compareVersions('0.30.2', '0.30.1') // 1
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);
  if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1;
  if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1;
  if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1;
  return 0;
}

/**
 * Classify the bump between `from` and `to`. Returns `'none'` if `to <= from`.
 *
 * @example bumpType('0.30.0', '0.30.1') // 'patch'
 * @example bumpType('0.30.0', '0.31.0') // 'minor'
 * @example bumpType('0.30.0', '1.0.0')  // 'major'
 * @example bumpType('0.30.1', '0.30.0') // 'none'
 */
export function bumpType(from: string, to: string): BumpType {
  if (compareVersions(to, from) <= 0) return 'none';
  const [fMajor, fMinor] = parseVersion(from);
  const [tMajor, tMinor] = parseVersion(to);
  if (tMajor > fMajor) return 'major';
  if (tMinor > fMinor) return 'minor';
  return 'patch';
}

/** Auto-upgrade policy action for a given bump type. */
export type UpgradeDecision = 'skip' | 'apply' | 'notify';

/**
 * Safeword's auto-upgrade policy as a pure function.
 *
 * - `'skip'`: latest <= current, no action
 * - `'apply'`: auto-upgrade silently (patch + minor) per the versioning
 *   contract at `.claude/skills/versioning/SKILL.md` — minor releases are
 *   strictly additive
 * - `'notify'`: print manual-upgrade hint (major only) — may carry breaking
 *   changes, user decides
 *
 * Pinning the policy as data means reverting it (e.g., back to patch-only)
 * fails a test rather than silently drifting.
 */
export function upgradeDecision(bump: BumpType): UpgradeDecision {
  if (bump === 'none') return 'skip';
  if (bump === 'major') return 'notify';
  return 'apply'; // patch + minor
}
