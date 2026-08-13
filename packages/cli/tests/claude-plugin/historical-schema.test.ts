import { describe, expect, it } from 'vitest';

import { claudeTemplatePathsFromSchema } from '../../scripts/lib/claude-historical-schema.js';

describe('historical Claude schema extraction', () => {
  it('finds a template after nested definition objects', () => {
    const schema = `export const SAFEWORD_SCHEMA = {
      ownedFiles: {
        '.claude/skills/example/SKILL.md': {
          metadata: { nested: true },
          template: 'skills/example/SKILL.md',
        },
      },
    }`;
    expect(claudeTemplatePathsFromSchema(schema, 'nested fixture')).toEqual({
      '.claude/skills/example/SKILL.md': 'skills/example/SKILL.md',
    });
  });

  it('rejects a computed owned-file path instead of silently omitting it', () => {
    const schema = `const path = '.claude/skills/example/SKILL.md';
      export const SAFEWORD_SCHEMA = { ownedFiles: { [path]: { template: 'example.md' } } }`;
    expect(() => claudeTemplatePathsFromSchema(schema, 'computed fixture')).toThrow(
      'computed schema property',
    );
  });

  it('rejects an unproven spread that could hide a Claude entry', () => {
    const schema = `const hidden = { '.claude/skills/example/SKILL.md': { template: 'x.md' } };
      export const SAFEWORD_SCHEMA = { ownedFiles: { ...hidden } }`;
    expect(() => claudeTemplatePathsFromSchema(schema, 'spread fixture', [])).toThrow(
      'unproven ownedFiles spread',
    );
  });
});
