import { describe, expect, it } from 'vitest';

import { golangPack } from '../../src/packs/golang/index.js';
import { GOLANG_SKILL_DIR_PATTERN } from '../../src/packs/golang/skills.js';
import { pythonPack } from '../../src/packs/python/index.js';
import { PYTHON_SKILL_DIR_PATTERN } from '../../src/packs/python/skills.js';
import { rustPack } from '../../src/packs/rust/index.js';
import { RUST_SKILL_DIR_PATTERN } from '../../src/packs/rust/skills.js';
import type { LanguagePack } from '../../src/packs/types.js';
import { typescriptPack } from '../../src/packs/typescript/index.js';
import { TYPESCRIPT_SKILL_DIR_PATTERN } from '../../src/packs/typescript/skills.js';
// Differential parity (drift vector V1) for the single-skill language packs — all
// four now follow the same shape (one named skill, no dispatcher). The standalone
// hook lib re-encodes each pack's extension + skill-dir prefix; this pins those
// copies to the langpack source of truth so a one-sided rename fails loudly
// instead of the nudge silently never firing (or the entry skill never resolving).
import { SKILL_LANGUAGES } from '../../templates/hooks/lib/skill-nudge.js';

interface Case {
  label: string;
  extensions: string[];
  prefix: string;
  pack: LanguagePack;
  dirPattern: RegExp;
  /** The real installed skill dir (probe-verified), e.g. `python-pro`. */
  installedDir: string;
}

const CASES: Case[] = [
  {
    label: 'Go',
    extensions: ['.go'],
    prefix: 'golang',
    pack: golangPack,
    dirPattern: GOLANG_SKILL_DIR_PATTERN,
    installedDir: 'golang-pro',
  },
  {
    label: 'Python',
    extensions: ['.py'],
    prefix: 'python',
    pack: pythonPack,
    dirPattern: PYTHON_SKILL_DIR_PATTERN,
    installedDir: 'python-pro',
  },
  {
    label: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    prefix: 'typescript',
    pack: typescriptPack,
    dirPattern: TYPESCRIPT_SKILL_DIR_PATTERN,
    installedDir: 'typescript-pro',
  },
  {
    label: 'Rust',
    extensions: ['.rs'],
    prefix: 'rust',
    pack: rustPack,
    dirPattern: RUST_SKILL_DIR_PATTERN,
    installedDir: 'rust-skills',
  },
];

describe.each(CASES)('$label skill-nudge ↔ langpack parity', testCase => {
  const { extensions, prefix, pack, dirPattern, installedDir } = testCase;

  it.each(extensions)('the hook registers a %s entry with the right prefix', extension => {
    const entry = SKILL_LANGUAGES[extension];
    expect(entry).toBeDefined();
    expect(entry?.prefix).toBe(prefix);
  });

  it.each(extensions)('the hook %s extension is one the langpack detects', extension => {
    expect(pack.extensions).toContain(extension);
  });

  it('the real installed dir matches the langpack dir pattern', () => {
    expect(dirPattern.test(installedDir)).toBe(true);
  });

  it("the installed dir's first segment equals the row prefix (entry-discovery coupling)", () => {
    // The nudge derives the language prefix as installedDir.split('-')[0] and the
    // entry skill as the sole dir for that prefix. If these diverge, the nudge
    // never matches the install. This is the load-bearing invariant.
    expect(installedDir.split('-', 1)[0]).toBe(prefix);
  });

  it('has teeth: a wrong dir name would NOT match the langpack pattern', () => {
    expect(dirPattern.test(`not-${installedDir}`)).toBe(false);
  });
});
