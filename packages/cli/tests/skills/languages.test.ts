import { afterEach, describe, expect, it } from 'vitest';

import { pythonSkillManifest } from '../../src/packs/python/skills.js';
import { LANGUAGE_PACKS } from '../../src/packs/registry.js';
import { rustSkillManifest } from '../../src/packs/rust/skills.js';
import { typescriptSkillManifest } from '../../src/packs/typescript/skills.js';
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
    expect(LANGUAGE_SKILL_MANIFESTS.golang?.source).toContain('jeffallan/claude-skills');
    expect(LANGUAGE_SKILL_MANIFESTS.python?.source).toBe(pythonSkillManifest.source);
    expect(LANGUAGE_SKILL_MANIFESTS.typescript?.source).toBe(typescriptSkillManifest.source);
    expect(LANGUAGE_SKILL_MANIFESTS.rust?.source).toBe(rustSkillManifest.source);
  });

  it('uses a named one-skill selection for the multi-domain jeffallan source, all for the dedicated Rust repo', () => {
    expect(LANGUAGE_SKILL_MANIFESTS.golang?.selection).toEqual(['golang-pro']);
    expect(LANGUAGE_SKILL_MANIFESTS.python?.selection).toEqual(['python-pro']);
    expect(LANGUAGE_SKILL_MANIFESTS.typescript?.selection).toEqual(['typescript-pro']);
    expect(LANGUAGE_SKILL_MANIFESTS.rust?.selection).toBe(rustSkillManifest.selection);
  });
});

describe('registry derivation (pack is the source of truth)', () => {
  it('registers exactly the packs that declare a skill manifest', () => {
    const packsWithSkills = Object.values(LANGUAGE_PACKS)
      .filter(pack => pack.skills)
      .map(pack => pack.id);
    expect(Object.keys(LANGUAGE_SKILL_MANIFESTS).toSorted((a, b) => a.localeCompare(b))).toEqual(
      packsWithSkills.toSorted((a, b) => a.localeCompare(b)),
    );
  });

  it('omits a pack that ships no skills, rather than registering an empty row', () => {
    // SQL is the live example: a real pack with lint config but no coding skills.
    expect(LANGUAGE_PACKS.sql?.skills).toBeUndefined();
    expect(LANGUAGE_SKILL_MANIFESTS.sql).toBeUndefined();
  });

  it('takes langId and label from the pack itself, never re-stating them', () => {
    for (const [langId, manifest] of Object.entries(LANGUAGE_SKILL_MANIFESTS)) {
      const pack = LANGUAGE_PACKS[langId];
      expect(manifest.langId).toBe(pack?.id);
      expect(manifest.label).toBe(pack?.name);
    }
  });

  it('carries the pack manifest through verbatim (no harness-side rewriting)', () => {
    for (const [langId, manifest] of Object.entries(LANGUAGE_SKILL_MANIFESTS)) {
      const packSkills = LANGUAGE_PACKS[langId]?.skills;
      expect(manifest.source).toBe(packSkills?.source);
      expect(manifest.selection).toBe(packSkills?.selection);
      expect(manifest.dirPattern).toBe(packSkills?.dirPattern);
    }
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
