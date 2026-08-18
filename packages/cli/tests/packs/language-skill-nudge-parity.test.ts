import { describe, expect, it } from 'vitest';

import { golangPack } from '../../src/packs/golang/index.js';
import { pythonPack } from '../../src/packs/python/index.js';
import { rustPack } from '../../src/packs/rust/index.js';
import type { LanguagePack } from '../../src/packs/types.js';
import { typescriptPack } from '../../src/packs/typescript/index.js';
// Differential parity (drift vector V1) for the single-skill language packs — all
// four now follow the same shape (one named skill, no dispatcher). The standalone
// hook lib re-encodes each pack's extension + skill-dir prefix; this pins those
// copies to the langpack source of truth so a one-sided rename fails loudly
// instead of the nudge silently never firing (or the entry skill never resolving).
//
// The dir pattern is read off `pack.skills` rather than imported separately: the
// pack IS the source of truth for its own skill manifest.
import { SKILL_LANGUAGES } from '../../templates/hooks/lib/skill-nudge.js';

interface Case {
  label: string;
  extensions: string[];
  prefix: string;
  pack: LanguagePack;
  /** The real installed skill dir (probe-verified), e.g. `python-pro`. */
  installedDir: string;
}

const CASES: Case[] = [
  {
    label: 'Go',
    extensions: ['.go'],
    prefix: 'golang',
    pack: golangPack,
    installedDir: 'golang-pro',
  },
  {
    label: 'Python',
    extensions: ['.py'],
    prefix: 'python',
    pack: pythonPack,
    installedDir: 'python-pro',
  },
  {
    label: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    prefix: 'typescript',
    pack: typescriptPack,
    installedDir: 'typescript-pro',
  },
  {
    label: 'Rust',
    extensions: ['.rs'],
    prefix: 'rust',
    pack: rustPack,
    installedDir: 'rust-skills',
  },
];

describe.each(CASES)('$label skill-nudge ↔ langpack parity', testCase => {
  const { extensions, prefix, pack, installedDir } = testCase;

  it.each(extensions)('the hook registers a %s entry with the right prefix', extension => {
    const entry = SKILL_LANGUAGES[extension];
    expect(entry).toBeDefined();
    expect(entry?.prefix).toBe(prefix);
  });

  it.each(extensions)('the hook %s extension is one the langpack detects', extension => {
    expect(pack.extensions).toContain(extension);
  });

  it('the pack declares a skill manifest', () => {
    expect(pack.skills).toBeDefined();
  });

  it('the real installed dir matches the langpack dir pattern', () => {
    expect(pack.skills?.dirPattern.test(installedDir)).toBe(true);
  });

  it("the installed dir's first segment equals the row prefix (entry-discovery coupling)", () => {
    // The nudge derives the language prefix as installedDir.split('-')[0] and the
    // entry skill as the sole dir for that prefix. If these diverge, the nudge
    // never matches the install. This is the load-bearing invariant.
    expect(installedDir.split('-', 1)[0]).toBe(prefix);
  });

  it('has teeth: a wrong dir name would NOT match the langpack pattern', () => {
    expect(pack.skills?.dirPattern.test(`not-${installedDir}`)).toBe(false);
  });
});
