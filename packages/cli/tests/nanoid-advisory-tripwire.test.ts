/**
 * NP0D72: Delete this tripwire with the root nanoid override once every
 * transitive consumer requires a release outside the vulnerable <3.3.18 range.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parse as parseJsonc } from 'jsonc-parser';
import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

describe('GHSA-2v37-7h3g-55p8 workaround', () => {
  it('keeps the manifest override and frozen lockfile on the patched 3.x release', () => {
    const manifest = JSON.parse(readFileSync(nodePath.join(repoRoot, 'package.json'), 'utf8')) as {
      overrides?: Record<string, string>;
    };
    const lockfile = readFileSync(nodePath.join(repoRoot, 'bun.lock'), 'utf8');
    const parsedLockfile = parseJsonc(lockfile) as {
      packages?: Record<string, [string, string, { dependencies?: Record<string, string> }?]>;
    };
    const resolvedVersions = Array.from(lockfile.matchAll(/"nanoid@([^"]+)"/gu), match => match[1]);
    const consumerRanges = Object.values(parsedLockfile.packages ?? {}).flatMap(entry => {
      const range = entry[2]?.dependencies?.nanoid;
      return range === undefined ? [] : [range];
    });

    expect(manifest.overrides?.nanoid).toBe('3.3.18');
    expect(resolvedVersions).not.toHaveLength(0);
    expect(new Set(resolvedVersions)).toEqual(new Set(['3.3.18']));
    expect(consumerRanges).not.toHaveLength(0);
    expect(consumerRanges.every(range => /^[~^]?3\./u.test(range))).toBe(true);
  });
});
