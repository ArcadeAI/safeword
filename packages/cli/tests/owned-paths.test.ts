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
  referenceFilterSafewordFiles,
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
  // Regression floor: every still-owned entry must resolve from the live
  // schema. AGENTS.md and CLAUDE.md were deliberately removed in P30CRP;
  // safeword now loads SAFEWORD.md through owned hook/config surfaces.
  const HISTORICAL_PREFIXES = ['.safeword/', '.claude/', '.cursor/', '.mcp.json', '.gitignore'];

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
    // The generator adds '.project/' alongside the schema's legacy namespace
    // prefix — installed projects run either root (AQJ95G).
    const expected = [
      ...new Set([...computeSafewordPathPrefixes(SAFEWORD_SCHEMA), '.project/']),
    ].toSorted((a, b) => a.localeCompare(b));
    expect(emitted).toEqual(expected);
  });

  it('emits an isSafewordPath function declaration alongside the constant', () => {
    const source = generateOwnedPathsModule(stubSchema({ ownedFiles: ['.safeword/x.ts'] }));
    expect(source).toContain('export function isSafewordPath');
  });

  it('emits a filterSafewordFiles helper for the auto-upgrade hook to consume', () => {
    const source = generateOwnedPathsModule(stubSchema({ ownedFiles: ['.safeword/x.ts'] }));
    expect(source).toContain('export function filterSafewordFiles');
  });
});

describe('filterSafewordFiles (auto-upgrade staging behavior)', () => {
  // These cases exercise the exact contract the hook depends on: given the
  // outputs of `git diff --name-only` and `git ls-files --others`, return
  // only the safeword-managed subset.
  const prefixes = ['.safeword/', '.claude/', 'package.json', 'AGENTS.md'];

  it('passes through changed files inside dir prefixes', () => {
    const staged = referenceFilterSafewordFiles(
      ['.safeword/hooks/x.ts', '.claude/skills/y.md'],
      [],
      prefixes,
    );
    expect(staged).toEqual(['.safeword/hooks/x.ts', '.claude/skills/y.md']);
  });

  it('passes through untracked files matching the safeword set', () => {
    const staged = referenceFilterSafewordFiles(
      [],
      ['.safeword/new-hook.ts', 'AGENTS.md'],
      prefixes,
    );
    expect(staged).toEqual(['.safeword/new-hook.ts', 'AGENTS.md']);
  });

  it('unions changed and untracked, preserving order', () => {
    const staged = referenceFilterSafewordFiles(['.safeword/a.ts'], ['package.json'], prefixes);
    expect(staged).toEqual(['.safeword/a.ts', 'package.json']);
  });

  it('filters out files outside the safeword set', () => {
    const staged = referenceFilterSafewordFiles(
      ['.safeword/a.ts', 'src/customer-code.ts'],
      ['random/file.md'],
      prefixes,
    );
    expect(staged).toEqual(['.safeword/a.ts']);
  });

  // The regression this defends against: the auto-upgrade hook must not stage
  // customer files that happen to share a prefix with a safeword-managed file.
  it('does not stage bare-file siblings (package.json.bak ≠ package.json)', () => {
    const staged = referenceFilterSafewordFiles(
      [],
      ['package.json.bak', 'AGENTS.md.backup'],
      prefixes,
    );
    expect(staged).toEqual([]);
  });

  it('returns empty when nothing matches (no commit will be created)', () => {
    const staged = referenceFilterSafewordFiles(['src/foo.ts'], ['src/bar.ts'], prefixes);
    expect(staged).toEqual([]);
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
  legacyTextPatches?: string[];
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
    legacyTextPatches: toBag(
      buckets.legacyTextPatches,
    ) as unknown as SafewordSchema['legacyTextPatches'],
    contracts: {},
    packages: { base: [], conditional: {} },
  };
}
