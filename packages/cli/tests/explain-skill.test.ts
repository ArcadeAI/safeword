import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { setupReconcileTest } from './helpers.js';

function body(file: string): string {
  const content = readFileSync(file, 'utf8');
  const frontmatterEnd = content.indexOf('\n---\n', 4);
  expect(frontmatterEnd).toBeGreaterThan(0);
  return content.slice(frontmatterEnd + 5).trim();
}

describe('explain skill', () => {
  it('provides the requested concise explanation instructions', async () => {
    const expected = `# Explain\n\nExplain plainly and concretely in under 200 words. Read any relevant tickets, artifacts, or current state before answering.\nShorter is better.\nCover what matters to the user and the next action, if there is one.\nAvoid Safeword jargon; define any terms you need to use.`;
    const project = mkdtempSync(path.join(tmpdir(), 'explain-compatibility-'));
    try {
      await setupReconcileTest(project);
      const skill = '.safeword/skills/explain/SKILL.md';
      expect(body(path.join(project, '.cursor/commands/explain.md'))).toBe(
        `Read and follow the instructions in ${skill}`,
      );
      expect(body(path.join(project, skill))).toBe(expected);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
