/**
 * Content pins for the prose surfaces of narrative resolution (ticket BY7RNR,
 * GitHub #848, TB1.AC4): the installed architecture-review prompt and the audit
 * skill's structural-drift check must direct the agent to the `paths.architecture`
 * narrative (root `ARCHITECTURE.md` fallback) instead of hardcoding the root
 * filename — the incident host's narrative lives at a configured non-root path.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const TEMPLATES = nodePath.resolve(import.meta.dirname, '..', '..', 'templates');

function read(relativePath: string): string {
  return readFileSync(nodePath.join(TEMPLATES, relativePath), 'utf8');
}

describe('architecture prompt (TB1.AC4)', () => {
  it('directs the agent to the paths.architecture narrative with root fallback', () => {
    const prompt = read(nodePath.join('prompts', 'architecture.md'));
    expect(prompt).toContain('paths.architecture');
    expect(prompt).toContain('ARCHITECTURE.md');
  });
});

describe('audit skill structural-drift check (TB1.AC4)', () => {
  it('resolves the narrative via paths.architecture in the ARCHITECTURE.md checks', () => {
    const skill = read(nodePath.join('skills', 'audit', 'SKILL.md'));
    expect(skill).toContain('paths.architecture');
  });
});
