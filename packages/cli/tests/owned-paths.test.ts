/**
 * Test Suite: Owned-paths generator
 *
 * The `session-auto-upgrade.ts` hook needs to stage every safeword-managed
 * file the upgrade may have touched. Hardcoding a prefix list drifts when a
 * new pack adds a top-level directory. These tests pin the generator that
 * derives the list from SAFEWORD_SCHEMA so drift is impossible.
 */

import { describe, expect, it } from 'vitest';

import {
  computeSafewordPathPrefixes,
  generateOwnedPathsModule,
  matchesSafewordPath,
} from '../src/owned-paths.js';
import type { SafewordSchema } from '../src/schema.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';

describe('computeSafewordPathPrefixes', () => {
  it('returns first-segment-with-slash for nested paths', () => {
    const schema = stubSchema({
      ownedFiles: ['.safeword/hooks/foo.ts', '.claude/skills/bar.md'],
    });
    const prefixes = computeSafewordPathPrefixes(schema);
    expect(prefixes).toEqual(['.claude/', '.safeword/']);
  });

  it('returns the whole path for root-level files', () => {
    const schema = stubSchema({
      ownedFiles: ['AGENTS.md', '.gitignore'],
    });
    const prefixes = computeSafewordPathPrefixes(schema);
    expect(prefixes).toEqual(['.gitignore', 'AGENTS.md']);
  });

  it('unions ownedFiles, managedFiles, jsonMerges, textPatches', () => {
    const schema = stubSchema({
      ownedFiles: ['.safeword/x.ts'],
      managedFiles: ['.cursor/rules/y.md'],
      jsonMerges: ['.mcp.json'],
      textPatches: ['CLAUDE.md'],
    });
    const prefixes = computeSafewordPathPrefixes(schema);
    expect(prefixes).toEqual(['.cursor/', '.mcp.json', '.safeword/', 'CLAUDE.md']);
  });

  it('dedupes prefixes shared across buckets', () => {
    const schema = stubSchema({
      ownedFiles: ['.safeword/a.ts', '.safeword/b.ts'],
      managedFiles: ['.safeword/c.ts'],
    });
    const prefixes = computeSafewordPathPrefixes(schema);
    expect(prefixes).toEqual(['.safeword/']);
  });

  it('returns prefixes in deterministic sorted order', () => {
    const schema = stubSchema({
      ownedFiles: ['.zed/x', '.cursor/y', '.aaa/z'],
    });
    const prefixes = computeSafewordPathPrefixes(schema);
    expect(prefixes).toEqual(['.aaa/', '.cursor/', '.zed/']);
  });
});

describe('SAFEWORD_SCHEMA prefix coverage (drift catcher)', () => {
  // The hardcoded list `session-auto-upgrade.ts` shipped with v0.31.0.
  // Regression floor: every entry must still resolve from the live schema.
  // If this fails, either the schema is missing an owned path or the
  // generator's prefix extraction is wrong.
  const HISTORICAL_PREFIXES = [
    '.safeword/',
    '.claude/',
    '.cursor/',
    '.mcp.json',
    '.gitignore',
    'AGENTS.md',
    'CLAUDE.md',
  ];

  it('includes every prefix from the v0.31.0 hardcoded list', () => {
    const prefixes = computeSafewordPathPrefixes(SAFEWORD_SCHEMA);
    for (const expected of HISTORICAL_PREFIXES) {
      expect(prefixes).toContain(expected);
    }
  });
});

describe('generateOwnedPathsModule', () => {
  it('emits a TypeScript module exporting SAFEWORD_PATHS as a readonly string array', () => {
    const schema = stubSchema({
      ownedFiles: ['.safeword/x.ts', 'AGENTS.md'],
    });
    const source = generateOwnedPathsModule(schema);

    expect(source).toContain('export const SAFEWORD_PATHS: readonly string[]');
    expect(source).toContain("'.safeword/'");
    expect(source).toContain("'AGENTS.md'");
  });

  it('marks the file as auto-generated so humans do not edit it', () => {
    const source = generateOwnedPathsModule(stubSchema({}));
    expect(source.toLowerCase()).toMatch(/auto-?generated|do not edit/);
  });

  it('produces output that, round-tripped through the prefix computer, matches', () => {
    const source = generateOwnedPathsModule(SAFEWORD_SCHEMA);
    const match = /SAFEWORD_PATHS:\s*readonly\s+string\[\]\s*=\s*\[([\s\S]*?)\]/.exec(source);
    expect(match).not.toBeNull();
    if (match === null) return; // narrow for TS; toEqual above would have failed first
    const arrayBody = match[1] ?? '';
    const emitted = [...arrayBody.matchAll(/'([^']+)'/g)]
      .map(m => m[1] ?? '')
      .toSorted((a, b) => a.localeCompare(b));
    const expected = [...computeSafewordPathPrefixes(SAFEWORD_SCHEMA)];
    expect(emitted).toEqual(expected);
  });

  it('emits an isSafewordPath function declaration alongside the constant', () => {
    const source = generateOwnedPathsModule(stubSchema({ ownedFiles: ['.safeword/x.ts'] }));
    expect(source).toContain('export function isSafewordPath');
  });
});

describe('matchesSafewordPath (reference impl mirrored in generated module)', () => {
  const prefixes = ['.safeword/', '.claude/', 'package.json', 'AGENTS.md'];

  it('matches files inside a dir prefix', () => {
    expect(matchesSafewordPath('.safeword/hooks/x.ts', prefixes)).toBe(true);
    expect(matchesSafewordPath('.claude/skills/y.md', prefixes)).toBe(true);
  });

  it('matches bare files by exact equality', () => {
    expect(matchesSafewordPath('package.json', prefixes)).toBe(true);
    expect(matchesSafewordPath('AGENTS.md', prefixes)).toBe(true);
  });

  // The regression this defends against: bare-file prefixes must NOT match
  // longer paths that share the prefix. Old hook code used startsWith for all
  // entries, so e.g. `package.json.bak` falsely matched `package.json`.
  it('does not falsely match bare-file siblings via prefix', () => {
    expect(matchesSafewordPath('package.json.bak', prefixes)).toBe(false);
    expect(matchesSafewordPath('AGENTS.md.backup', prefixes)).toBe(false);
  });

  it('rejects unrelated paths', () => {
    expect(matchesSafewordPath('src/foo.ts', prefixes)).toBe(false);
    expect(matchesSafewordPath('other.json', prefixes)).toBe(false);
  });
});

// ---- helpers ----------------------------------------------------------------

const toBag = (paths: string[] | undefined): Record<string, unknown> =>
  Object.fromEntries((paths ?? []).map(p => [p, true]));

function stubSchema(buckets: {
  ownedFiles?: string[];
  managedFiles?: string[];
  jsonMerges?: string[];
  textPatches?: string[];
}): SafewordSchema {
  return {
    version: '0.0.0',
    ownedDirs: [],
    sharedDirs: [],
    preservedDirs: [],
    deprecatedFiles: [],
    deprecatedPackages: [],
    deprecatedDirs: [],
    ownedFiles: toBag(buckets.ownedFiles) as unknown as SafewordSchema['ownedFiles'],
    managedFiles: toBag(buckets.managedFiles) as unknown as SafewordSchema['managedFiles'],
    jsonMerges: toBag(buckets.jsonMerges) as unknown as SafewordSchema['jsonMerges'],
    textPatches: toBag(buckets.textPatches) as unknown as SafewordSchema['textPatches'],
    contracts: {},
    packages: { base: [], conditional: {} },
  };
}
