import { describe, expect, it } from 'vitest';

import {
  activeScenarioKey,
  decideSkillNudge,
  languageForFile,
  skillNudgeLine,
} from '../../templates/hooks/lib/skill-nudge.js';

describe('languageForFile', () => {
  it('maps a .go file to Go', () => {
    expect(languageForFile('pkg/server/handler.go')?.prefix).toBe('golang');
  });

  it('matches Go test files too (first .go edit is often the test)', () => {
    expect(languageForFile('pkg/server/handler_test.go')?.prefix).toBe('golang');
  });

  it('is case-insensitive on the extension', () => {
    expect(languageForFile('MAIN.GO')?.prefix).toBe('golang');
  });

  it('returns null for non-skill-backed languages', () => {
    expect(languageForFile('src/app.py')).toBeNull();
    expect(languageForFile('src/app.ts')).toBeNull();
    expect(languageForFile('README.md')).toBeNull();
    expect(languageForFile('Makefile')).toBeNull();
  });
});

describe('skillNudgeLine', () => {
  it('points at the prefixed skill set with illustrative concerns (no skill names)', () => {
    const go = languageForFile('main.go');
    if (!go) throw new Error('Go must be a registered skill language');
    const line = skillNudgeLine(go);
    expect(line).toContain('golang-*');
    expect(line).toContain('concurrency?');
    expect(line).toContain('Revise the current file if it applies.');
    // Drift guard: the line must not enumerate actual skill names.
    expect(line).not.toContain('golang-context');
  });
});

describe('activeScenarioKey', () => {
  const complete = ['- [x] RED a', '- [x] GREEN a', '- [x] REFACTOR a'].join('\n');
  const inProgress = ['- [x] RED a', '- [ ] GREEN a', '- [ ] REFACTOR a'].join('\n');

  it('returns the heading of the in-progress scenario', () => {
    const content = `### Scenario: alpha\n${inProgress}`;
    expect(activeScenarioKey(content)).toBe('Scenario: alpha');
  });

  it('advances to the first unfinished scenario (skips completed ones)', () => {
    const content = `### Scenario: alpha\n${complete}\n### Scenario: beta\n${inProgress}`;
    expect(activeScenarioKey(content)).toBe('Scenario: beta');
  });

  it('returns undefined when every scenario is complete', () => {
    const content = `### Scenario: alpha\n${complete}`;
    expect(activeScenarioKey(content)).toBeUndefined();
  });

  it('returns undefined when there are no scenarios', () => {
    expect(activeScenarioKey('# Notes\n\njust prose')).toBeUndefined();
  });
});

describe('decideSkillNudge', () => {
  const installed = new Set(['golang']);

  it('fires for a Go edit when golang skills are installed', () => {
    const nudge = decideSkillNudge('a/b/main.go', installed, 'pkg.DEV1.AC1.x');
    expect(nudge?.line).toContain('golang-*');
    expect(nudge?.dedupKey).toBe('golang:pkg.DEV1.AC1.x');
  });

  it('does not fire when golang skills are not installed', () => {
    expect(decideSkillNudge('a/b/main.go', new Set(), 'scn')).toBeNull();
  });

  it('does not fire for a non-Go file', () => {
    expect(decideSkillNudge('a/b/app.py', installed, 'scn')).toBeNull();
  });

  it('falls back to a session-scoped dedup key when no active scenario', () => {
    expect(decideSkillNudge('main.go', installed, undefined)?.dedupKey).toBe('golang:session');
  });

  it('keys dedup per scenario so a new scenario re-fires', () => {
    const a = decideSkillNudge('main.go', installed, 'scn-a')?.dedupKey;
    const b = decideSkillNudge('main.go', installed, 'scn-b')?.dedupKey;
    expect(a).not.toBe(b);
  });
});
