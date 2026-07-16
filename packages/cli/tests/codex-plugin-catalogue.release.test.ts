import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

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
  return markdownFiles(CANONICAL_SKILLS).map(relativePath => {
    const [skill, filename, ...rest] = relativePath.split(nodePath.sep);
    if (skill === undefined || filename === undefined) {
      throw new Error(`unexpected canonical skill path: ${relativePath}`);
    }
    if (filename === 'SKILL.md') return nodePath.join(skill, filename, ...rest);
    return nodePath.join(skill, 'references', filename, ...rest);
  });
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
});
