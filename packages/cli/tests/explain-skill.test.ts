import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('explain skill', () => {
  it('provides the requested concise explanation instructions', () => {
    const skill = readFileSync(
      path.resolve(import.meta.dirname, '../templates/skills/explain/SKILL.md'),
      'utf8',
    );
    const body = skill.split('---', 3)[2]?.trim();
    expect(body).toBe(
      `# Explain\n\nExplain plainly and concretely in under 200 words. Read any relevant tickets, artifacts, or current state before answering.\nShorter is better.\nCover what matters to the user and the next action, if there is one.\nAvoid Safeword jargon; define any terms you need to use.`,
    );
  });
});
