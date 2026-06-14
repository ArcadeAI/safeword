import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = nodePath.resolve(import.meta.dirname, '../../../..');

const AUDIT_SURFACES = [
  'packages/cli/templates/skills/audit/SKILL.md',
  'packages/cli/templates/commands/audit.md',
  '.agents/skills/audit/SKILL.md',
  '.claude/skills/audit/SKILL.md',
  '.cursor/commands/audit.md',
];

describe('audit documentation source guidance', () => {
  it.each(AUDIT_SURFACES)('%s prompts only when docs.sources is absent', relativePath => {
    const content = readFileSync(nodePath.join(ROOT, relativePath), 'utf8');

    expect(content).toContain('If `docs.sources` is absent, prompt the user');
    expect(content).toContain('set `docs.sources: []`');
    expect(content).toContain('If `docs.sources: []` is configured, do not prompt');
    expect(content).toContain('Always report docs coverage');
  });
});
