import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('explain skill', () => {
  it('provides the requested concise explanation instructions', () => {
    const expected = `# Explain\n\nExplain plainly and concretely in under 200 words. Read any relevant tickets, artifacts, or current state before answering.\nShorter is better.\nCover what matters to the user and the next action, if there is one.\nAvoid Safeword jargon; define any terms you need to use.`;
    for (const file of ['skills/explain/SKILL.md', 'commands/explain.md']) {
      const content = readFileSync(path.resolve(import.meta.dirname, '../templates', file), 'utf8');
      const frontmatterEnd = content.indexOf('\n---\n', 4);
      expect(frontmatterEnd).toBeGreaterThan(0);
      expect(content.slice(frontmatterEnd + 5).trim()).toBe(expected);
    }
  });
});
