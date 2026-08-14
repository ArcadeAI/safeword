/**
 * NP0D72: Delete this tripwire with the root nanoid override once every
 * transitive consumer requires a release outside the vulnerable <3.3.18 range.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse as parseJsonc } from 'jsonc-parser';
import { satisfies } from 'semver';
import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

type DependencyMaps = Partial<
  Record<
    'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies',
    Record<string, string>
  >
>;
type LockfilePackage = [string, string, DependencyMaps?];
const dependencyMapNames = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

function nanoidRanges(maps: DependencyMaps): string[] {
  return dependencyMapNames.flatMap(name => {
    const dependencies = maps[name];
    const range = dependencies?.nanoid;
    return range === undefined ? [] : [range];
  });
}

function nanoidLockfileContract(lockfile: string): {
  consumerRanges: string[];
  resolvedVersions: string[];
} {
  const parsed = parseJsonc(lockfile) as {
    packages?: Record<string, LockfilePackage>;
    workspaces?: Record<string, DependencyMaps>;
  };
  return {
    resolvedVersions: Array.from(lockfile.matchAll(/"nanoid@([^"]+)"/gu), match => match[1] ?? ''),
    consumerRanges: [
      ...Object.values(parsed.workspaces ?? {}).flatMap(nanoidRanges),
      ...Object.values(parsed.packages ?? {}).flatMap(entry => nanoidRanges(entry[2] ?? {})),
    ],
  };
}

describe('GHSA-2v37-7h3g-55p8 workaround', () => {
  it('keeps the manifest override and frozen lockfile on the patched 3.x release', () => {
    const manifest = JSON.parse(readFileSync(nodePath.join(repoRoot, 'package.json'), 'utf8')) as {
      overrides?: Record<string, string>;
    };
    const lockfile = readFileSync(nodePath.join(repoRoot, 'bun.lock'), 'utf8');
    const { consumerRanges, resolvedVersions } = nanoidLockfileContract(lockfile);

    expect(manifest.overrides?.nanoid).toBe('3.3.18');
    expect(resolvedVersions).not.toHaveLength(0);
    expect(new Set(resolvedVersions)).toEqual(new Set(['3.3.18']));
    expect(consumerRanges).not.toHaveLength(0);
    expect(consumerRanges.every(range => satisfies('3.3.18', range))).toBe(true);
  });
});
