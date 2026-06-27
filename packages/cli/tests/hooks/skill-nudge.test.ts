import { describe, expect, it } from 'vitest';

import {
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
