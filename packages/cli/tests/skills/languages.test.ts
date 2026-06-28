import { afterEach, describe, expect, it } from 'vitest';

import { PYTHON_SKILL_SOURCE } from '../../src/packs/python/skills.js';
import { RUST_SKILL_SELECTION, RUST_SKILL_SOURCE } from '../../src/packs/rust/skills.js';
import { TYPESCRIPT_SKILL_SOURCE } from '../../src/packs/typescript/skills.js';
import {
  ensureLanguageSkills,
  installLanguageSkills,
  LANGUAGE_SKILL_MANIFESTS,
} from '../../src/skills/languages.js';

describe('language skill registry', () => {
  it('registers Go, Python, TypeScript, and Rust', () => {
    expect(Object.keys(LANGUAGE_SKILL_MANIFESTS).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'golang',
      'python',
      'rust',
      'typescript',
    ]);
  });

  it('wires each language to its pack manifest source', () => {
    expect(LANGUAGE_SKILL_MANIFESTS.golang?.source).toContain('samber/cc-skills-golang');
    expect(LANGUAGE_SKILL_MANIFESTS.python?.source).toBe(PYTHON_SKILL_SOURCE);
    expect(LANGUAGE_SKILL_MANIFESTS.typescript?.source).toBe(TYPESCRIPT_SKILL_SOURCE);
    expect(LANGUAGE_SKILL_MANIFESTS.rust?.source).toBe(RUST_SKILL_SOURCE);
  });

  it('uses a named selection for the multi-domain jeffallan source, all for dedicated repos', () => {
    expect(LANGUAGE_SKILL_MANIFESTS.python?.selection).toEqual(['python-pro']);
    expect(LANGUAGE_SKILL_MANIFESTS.typescript?.selection).toEqual(['typescript-pro']);
    expect(LANGUAGE_SKILL_MANIFESTS.rust?.selection).toBe(RUST_SKILL_SELECTION);
    expect(LANGUAGE_SKILL_MANIFESTS.golang?.selection).toBe('all');
  });
});

describe('installLanguageSkills (generic, degrade-not-fail)', () => {
  const original = process.env.SAFEWORD_SKIP_SKILLS;
  afterEach(() => {
    if (original === undefined) delete process.env.SAFEWORD_SKIP_SKILLS;
    else process.env.SAFEWORD_SKIP_SKILLS = original;
  });

  it('returns undefined for a language with no skill manifest', () => {
    expect(installLanguageSkills('sql', process.cwd())).toBeUndefined();
  });

  it('skips (no network) for a known language when SAFEWORD_SKIP_SKILLS is set', () => {
    process.env.SAFEWORD_SKIP_SKILLS = '1';
    for (const langId of ['golang', 'python', 'typescript', 'rust']) {
      expect(installLanguageSkills(langId, process.cwd())?.status).toBe('skipped');
    }
  });

  it('ensureLanguageSkills never throws on a project with no detected languages', () => {
    process.env.SAFEWORD_SKIP_SKILLS = '1';
    expect(() => {
      ensureLanguageSkills(process.cwd());
    }).not.toThrow();
  });
});
