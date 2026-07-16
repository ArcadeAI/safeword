import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

      writeFileSync(
        nodePath.join(pluginDirectory, 'skills/bdd/references/DISCOVERY.md'),
        '# restored\n',
      );
      mkdirSync(nodePath.join(pluginDirectory, 'skills/unexpected'), { recursive: true });
      writeFileSync(nodePath.join(pluginDirectory, 'skills/unexpected/SKILL.md'), '# unexpected\n');
      expect(() => {
        assertCodexPluginCatalogue(CANONICAL_SKILLS, pluginDirectory);
      }).toThrow('unexpected asset');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('allows only the documented source-to-Codex skill transformations', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-codex-plugin-transform-'));
    const canonicalSkillsDirectory = nodePath.join(fixture, 'skills');
    try {
      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'alpha'), { recursive: true });
      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'beta'), { recursive: true });
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'alpha/SKILL.md'),
        [
          '---',
          'name: alpha',
          'description: Example transformation',
          'allowed-tools: Bash',
          '---',
          '',
          'Run /beta, preserve /outside, and consult TDD.md.',
          '',
        ].join('\n'),
      );
      writeFileSync(nodePath.join(canonicalSkillsDirectory, 'alpha/TDD.md'), '# TDD detail\n');
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'beta/SKILL.md'),
        ['---', 'name: beta', 'description: Referenced skill', '---', '', '# Beta', ''].join('\n'),
      );

      expect(generateCodexPluginAssets(canonicalSkillsDirectory)).toEqual([
        {
          relativePath: nodePath.join('skills', 'alpha', 'SKILL.md'),
          content:
            '---\nname: alpha\ndescription: Example transformation\n---\n\nRun $safeword:beta, preserve /outside, and consult references/TDD.md.\n',
        },
        {
          relativePath: nodePath.join('skills', 'alpha', 'references', 'TDD.md'),
          content: '# TDD detail\n',
        },
        {
          relativePath: nodePath.join('skills', 'beta', 'SKILL.md'),
          content: '---\nname: beta\ndescription: Referenced skill\n---\n\n# Beta\n',
        },
      ]);

      mkdirSync(nodePath.join(canonicalSkillsDirectory, 'unsupported'));
      writeFileSync(
        nodePath.join(canonicalSkillsDirectory, 'unsupported/SKILL.md'),
        [
          '---',
          'name: unsupported',
          'description: Unsupported metadata',
          'not-supported: true',
          '---',
          '',
          '# Unsupported',
          '',
        ].join('\n'),
      );
      expect(() => generateCodexPluginAssets(canonicalSkillsDirectory)).toThrow(
        'unsupported metadata',
      );
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
