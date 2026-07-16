import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertCodexPluginCatalogue,
  assertCodexSkillMetadataBudget,
  CODEX_SKILL_METADATA_LIMIT,
  generateCodexPluginAssets,
} from '../src/codex-plugin/catalogue.js';

const CLI_ROOT = nodePath.resolve(import.meta.dirname, '..');
const CANONICAL_SKILLS = nodePath.join(CLI_ROOT, 'templates/skills');
const PLUGIN_SKILLS = nodePath.join(CLI_ROOT, 'codex-plugin/skills');

function markdownFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const relativePath = nodePath.join(prefix, entry.name);
      const absolutePath = nodePath.join(directory, entry.name);
      if (entry.isDirectory()) return markdownFiles(absolutePath, relativePath);
      return entry.isFile() && entry.name.endsWith('.md') ? [relativePath] : [];
    })
    .toSorted((left, right) => left.localeCompare(right));
}

function expectedPluginAssets(): string[] {
  return markdownFiles(CANONICAL_SKILLS)
    .map(relativePath => {
      const [skill, filename, ...rest] = relativePath.split(nodePath.sep);
      if (skill === undefined || filename === undefined) {
        throw new Error(`unexpected canonical skill path: ${relativePath}`);
      }
      if (filename === 'SKILL.md') return nodePath.join(skill, filename, ...rest);
      return nodePath.join(skill, 'references', filename, ...rest);
    })
    .toSorted((left, right) => left.localeCompare(right));
}

describe('generated Codex plugin catalogue', () => {
  it('ships every canonical workflow and its supporting phase material', () => {
    const expectedAssets = expectedPluginAssets();
    const actualAssets = markdownFiles(PLUGIN_SKILLS);

    expect(actualAssets).toEqual(expectedAssets);

    const bddSkill = readFileSync(nodePath.join(PLUGIN_SKILLS, 'bdd/SKILL.md'), 'utf8');
    expect(bddSkill).toContain('references/DISCOVERY.md');
    expect(existsSync(nodePath.join(PLUGIN_SKILLS, 'bdd/references/DISCOVERY.md'))).toBe(true);
  });

  it('rejects missing phase material and unexpected generated workflow drift', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-catalogue-'));
    const pluginDirectory = nodePath.join(fixture, 'codex-plugin');
    try {
      cpSync(nodePath.dirname(PLUGIN_SKILLS), pluginDirectory, { recursive: true });
      assertCodexPluginCatalogue(CANONICAL_SKILLS, pluginDirectory);

      rmSync(nodePath.join(pluginDirectory, 'skills/bdd/references/DISCOVERY.md'));
      expect(() => {
        assertCodexPluginCatalogue(CANONICAL_SKILLS, pluginDirectory);
      }).toThrow('missing expected asset');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('enforces Codex metadata discovery budget from generated skill frontmatter', () => {
    const assets = generateCodexPluginAssets(CANONICAL_SKILLS);
    expect(() => {
      assertCodexSkillMetadataBudget(assets);
    }).not.toThrow();

    const oversized = [
      ...assets,
      {
        relativePath: 'skills/oversized/SKILL.md',
        content: `---\nname: oversized\ndescription: ${'x'.repeat(CODEX_SKILL_METADATA_LIMIT)}\n---\n`,
      },
    ];
    expect(() => {
      assertCodexSkillMetadataBudget(oversized);
    }).toThrow('8000');
  });
});
