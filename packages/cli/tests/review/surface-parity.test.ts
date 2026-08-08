import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const templates = nodePath.resolve(import.meta.dirname, '../../templates');

function readTemplate(relativePath: string): string {
  return readFileSync(nodePath.join(templates, relativePath), 'utf8');
}

function markdownFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = nodePath.join(prefix, entry.name);
    const absolutePath = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(absolutePath, relativePath);
    return entry.isFile() && entry.name.endsWith('.md') ? [relativePath] : [];
  });
}

describe('class-1 review surface parity', () => {
  it.each([
    ['skills/quality-review/SKILL.md', 'quality-review'],
    ['skills/review-spec/SKILL.md', 'scenario-gate'],
    ['skills/bdd/SKILL.md', 'scenario-gate'],
    ['skills/bdd/PLAN_IMPLEMENTATION.md', 'plan-implementation'],
    ['skills/bdd/TDD.md', 'plan-implementation'],
  ])('%s enters the shared %s coordinator', (relativePath, kind) => {
    expect(readTemplate(relativePath), relativePath).toContain(`safeword review run ${kind}`);
  });

  it.each([
    'skills/audit/SKILL.md',
    'skills/verify/SKILL.md',
    'skills/tdd-review/SKILL.md',
    'skills/refactor/SKILL.md',
  ])('%s stays outside the class-1 coordinator', relativePath => {
    expect(readTemplate(relativePath), relativePath).not.toContain('safeword review run');
  });

  it('wires every canonical coordinator caller to the same typed-exhaustion continuation', () => {
    const skills = nodePath.join(templates, 'skills');
    const callers = markdownFiles(skills).filter(relativePath =>
      readFileSync(nodePath.join(skills, relativePath), 'utf8').includes('safeword review run'),
    );

    expect(callers.length).toBeGreaterThan(0);
    for (const relativePath of callers) {
      const content = readFileSync(nodePath.join(skills, relativePath), 'utf8');
      const normalized = content.replaceAll(/\s+/gu, ' ');
      expect(content, relativePath).toContain('--agent-handoff --json');
      expect(content, relativePath).toContain('REVIEW_ROUTES_EXHAUSTED');
      expect(content, relativePath).toContain('/finish-review');
      expect(normalized, relativePath).toMatch(/Only when[^.]{0,240}REVIEW_ROUTES_EXHAUSTED/u);
    }
  });
});
