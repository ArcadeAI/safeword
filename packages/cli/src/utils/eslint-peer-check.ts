/**
 * ESLint peer-dep mismatch detection for safeword install/upgrade flows.
 *
 * Reads the project's declared `eslint` version (dependencies or devDependencies)
 * and compares its major against safeword's own peerDependencies.eslint range.
 * Returns a human-readable warning when the customer's major is outside the
 * supported set; returns undefined otherwise (including when nothing is
 * declared or the range can't be parsed — only positively-mismatched majors
 * warn).
 *
 * Background: safeword's ESLint preset bundles plugins whose internals can
 * break on ESLint majors safeword hasn't tested against. The vitest plugin's
 * transitive @typescript-eslint/utils@7.x crashed on ESLint 10 LegacyESLint
 * removal; that motivated this guard so the next collision surfaces at
 * install time rather than the first lint run.
 */

import nodePath from 'node:path';

import { SAFEWORD_PEER_DEPENDENCIES } from '../version.js';
import { exists, readJson } from './fs.js';

interface ProjectPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Pull the supported eslint major versions from safeword's own peerDependencies.
 * `^9.22.0` → [9]; `^9.22.0 || ^10.0.0` → [9, 10].
 *
 * Reads from version.ts rather than calling require() locally — version.ts sits
 * at src/ depth (same as the bundled dist/) so its `require('../package.json')`
 * resolves correctly in both contexts. A direct require() here would resolve
 * `../../package.json` to a nonexistent path post-bundling.
 */
function getSupportedEslintMajors(): number[] {
  const range = SAFEWORD_PEER_DEPENDENCIES.eslint;
  if (!range) return [];
  return extractMajors(range);
}

/**
 * Extract the leading numeric major from a single version comparator
 * (e.g. `^9.22.0`, `>=9.0.0`, `9.x`, `9.0.0`). Returns undefined for ranges
 * that can't be coerced (workspace:*, file:, git+, *, latest).
 */
function extractMajorFromComparator(comparator: string): number | undefined {
  const cleaned = comparator.trim().replace(/^[\^~>=<]+/, '');
  const match = /^(\d+)\./.exec(cleaned) ?? /^(\d+)(?:\.x|\.\*|$)/.exec(cleaned);
  const majorString = match?.[1];
  if (majorString === undefined) return undefined;
  const major = Number.parseInt(majorString, 10);
  return Number.isNaN(major) ? undefined : major;
}

/**
 * Parse a possibly-disjunctive range (`^9.22.0 || ^10.0.0`) into the set of
 * majors it covers. Comparators that don't yield a major are dropped.
 */
function extractMajors(range: string): number[] {
  const majors = new Set<number>();
  for (const part of range.split('||')) {
    const major = extractMajorFromComparator(part);
    if (major !== undefined) majors.add(major);
  }
  return [...majors].toSorted((a, b) => a - b);
}

/**
 * Returns a warning string when the project's declared eslint major is
 * outside safeword's supported peer range; undefined otherwise.
 */
export function getEslintPeerMismatchWarning(cwd: string): string | undefined {
  const packageJsonPath = nodePath.join(cwd, 'package.json');
  if (!exists(packageJsonPath)) return undefined;

  const pkg = readJson(packageJsonPath) as ProjectPackageJson | undefined;
  if (!pkg) return undefined;

  const declared = pkg.dependencies?.eslint ?? pkg.devDependencies?.eslint;
  if (!declared) return undefined;

  const installedMajor = extractMajorFromComparator(declared);
  if (installedMajor === undefined) return undefined;

  const supportedMajors = getSupportedEslintMajors();
  if (supportedMajors.length === 0) return undefined;
  if (supportedMajors.includes(installedMajor)) return undefined;

  const supportedDisplay = supportedMajors.map(major => `${major}.x`).join(' or ');
  return [
    `Project declares eslint@${declared} (major ${installedMajor}), but safeword`,
    `supports eslint ${supportedDisplay}. Safeword's bundled plugins are tested`,
    `against the supported range; lint may crash on other majors (e.g. plugin`,
    `transitives that reference removed ESLint APIs).`,
  ].join('\n');
}
