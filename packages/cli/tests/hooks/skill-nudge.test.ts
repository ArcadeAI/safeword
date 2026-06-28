import { describe, expect, it } from 'vitest';

import {
  activeScenarioKey,
  decideSkillNudge,
  entrySkillFor,
  languageForFile,
  parseSkillDescription,
  SKILL_LANGUAGES,
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

  it('maps the other skill-backed languages by extension', () => {
    expect(languageForFile('src/app.py')?.prefix).toBe('python');
    expect(languageForFile('src/app.ts')?.prefix).toBe('typescript');
    expect(languageForFile('src/App.tsx')?.prefix).toBe('typescript');
    expect(languageForFile('src/main.rs')?.prefix).toBe('rust');
  });

  it('returns null for files with no skill-backed language', () => {
    expect(languageForFile('README.md')).toBeNull();
    expect(languageForFile('Makefile')).toBeNull();
    expect(languageForFile('styles.css')).toBeNull();
  });
});

describe('skillNudgeLine', () => {
  it('falls back to the prefixed skill set with illustrative concerns when no entry resolves', () => {
    const go = languageForFile('main.go');
    if (!go) throw new Error('Go must be a registered skill language');
    const line = skillNudgeLine(go);
    expect(line).toContain('golang-*');
    expect(line).toContain('concurrency?');
    expect(line).toContain('Revise the current file if it applies.');
    // Drift guard: the fallback must not enumerate actual skill names.
    expect(line).not.toContain('golang-context');
  });

  it('points directly at the entry skill and surfaces its description verbatim', () => {
    const go = languageForFile('main.go');
    if (!go) throw new Error('Go must be a registered skill language');
    const line = skillNudgeLine(go, {
      name: 'golang-how-to',
      description: 'Golang skills orchestrator — routes to the right skill.',
    });
    expect(line).toContain('`golang-how-to`');
    expect(line).toContain('Golang skills orchestrator — routes to the right skill.');
    expect(line).toContain('Revise the current file if it applies.');
    // With a real entry, the generic "skill that fits this work" prompt is gone.
    expect(line).not.toContain('that fits this work');
  });

  it('falls back when the entry has an empty description (degrade-not-fail)', () => {
    const go = languageForFile('main.go');
    if (!go) throw new Error('Go must be a registered skill language');
    const line = skillNudgeLine(go, { name: 'golang-how-to', description: ' '.repeat(3) });
    expect(line).toContain('golang-*');
    expect(line).toContain('concurrency?');
  });
});

describe('entrySkillFor', () => {
  const go = SKILL_LANGUAGES['.go'];
  if (!go) throw new Error('Go must be a registered skill language');

  it('picks the declared dispatcher when it is installed (multi-skill pack)', () => {
    expect(entrySkillFor(go, ['golang-how-to', 'golang-context', 'golang-testing'])).toBe(
      'golang-how-to',
    );
  });

  it('returns null when the declared dispatcher is absent — never guesses one of many', () => {
    expect(entrySkillFor(go, ['golang-context', 'golang-testing'])).toBeNull();
  });

  it('picks the sole installed dir for a single-skill pack (no dispatcher)', () => {
    const ts = { prefix: 'typescript', display: 'TypeScript', concerns: [] };
    expect(entrySkillFor(ts, ['typescript-pro'])).toBe('typescript-pro');
  });

  it('returns null when a no-dispatcher pack has more than one dir (ambiguous)', () => {
    const ts = { prefix: 'typescript', display: 'TypeScript', concerns: [] };
    expect(entrySkillFor(ts, ['typescript-pro', 'typescript-extra'])).toBeNull();
  });

  it('ignores dirs of other languages when counting', () => {
    const ts = { prefix: 'typescript', display: 'TypeScript', concerns: [] };
    expect(entrySkillFor(ts, ['typescript-pro', 'golang-context'])).toBe('typescript-pro');
  });
});

describe('parseSkillDescription', () => {
  it('reads an inline double-quoted description', () => {
    const md = '---\nname: golang-how-to\ndescription: "Orchestrator, routes skills."\n---\n# Body';
    expect(parseSkillDescription(md)).toBe('Orchestrator, routes skills.');
  });

  it('reads an inline plain (unquoted) description', () => {
    const md = '---\nname: typescript-pro\ndescription: Use when writing advanced types.\n---\n';
    expect(parseSkillDescription(md)).toBe('Use when writing advanced types.');
  });

  it('reads a folded block scalar (joins lines with spaces)', () => {
    const md = ['---', 'description: >', '  Line one', '  line two.', '---'].join('\n');
    expect(parseSkillDescription(md)).toBe('Line one line two.');
  });

  it('reads a literal block scalar (preserves newlines)', () => {
    const md = ['---', 'description: |', '  Line one', '  line two', '---'].join('\n');
    expect(parseSkillDescription(md)).toBe('Line one\nline two');
  });

  it('returns null when there is no frontmatter', () => {
    expect(parseSkillDescription('# Just a heading\n\nprose')).toBeNull();
  });

  it('returns null when frontmatter has no description', () => {
    expect(parseSkillDescription('---\nname: x\n---\nbody')).toBeNull();
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
