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
const dependencyMapNames = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nanoidRanges(maps: DependencyMaps): string[] {
  return dependencyMapNames.flatMap(name => {
    const dependencies = maps[name];
    const range = dependencies?.nanoid;
    return range === undefined ? [] : [range];
  });
}

function packageNanoidRanges(entry: unknown): string[] {
  if (!Array.isArray(entry)) return [];
  return entry.flatMap(part => (isRecord(part) ? nanoidRanges(part as DependencyMaps) : []));
}

function nanoidLockfileContract(lockfile: string): {
  consumerRanges: string[];
  resolvedVersions: string[];
} {
  const parsed = parseJsonc(lockfile) as {
    packages?: Record<string, unknown>;
    workspaces?: Record<string, DependencyMaps>;
  };
  const packages = parsed.packages ?? {};
  return {
    resolvedVersions: Object.entries(packages).flatMap(([name, entry]) => {
      if (name !== 'nanoid' || !Array.isArray(entry)) return [];
      const resolution = entry[0];
      if (typeof resolution !== 'string') return [];
      const match = /^nanoid@(.+)$/u.exec(resolution);
      return match?.[1] === undefined ? [] : [match[1]];
    }),
    consumerRanges: [
      ...Object.values(parsed.workspaces ?? {}).flatMap(nanoidRanges),
      ...Object.values(packages).flatMap(packageNanoidRanges),
    ],
  };
}

describe('GHSA-2v37-7h3g-55p8 workaround', () => {
  it('rejects an incompatible future consumer even when the override controls resolution', () => {
    const contract = nanoidLockfileContract(`{
      "workspaces": { "packages/new-consumer": { "dependencies": { "nanoid": "^5.0.0" } } },
      "packages": { "nanoid": ["nanoid@3.3.18", "", {}] }
    }`);

    expect(contract.resolvedVersions).toEqual(['3.3.18']);
    expect(contract.consumerRanges).toEqual(['^5.0.0']);
    expect(contract.consumerRanges.every(range => satisfies('3.3.18', range))).toBe(false);
  });

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
