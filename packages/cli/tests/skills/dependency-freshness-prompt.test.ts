import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const readRepoFile = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

const expectNoHardcodedStableYear = (content: string): void => {
  expect(content).not.toContain('latest stable version 2025');
};

const expectPromptTimestampSearch = (content: string): void => {
  expect(content).toContain('Current time:');
  expect(content).toContain('current prompt timestamp');
  expectNoHardcodedStableYear(content);
};

describe('dependency freshness instructions', () => {
  it.each([
    ['canonical SAFEWORD template', 'packages/cli/templates/SAFEWORD.md'],
    ['dogfood SAFEWORD copy', '.safeword/SAFEWORD.md'],
  ])('%s uses the prompt timestamp when available with a current-date fallback', (_label, path) => {
    const content = readRepoFile(path);

    expect(content).toContain('Adding a dependency');
    expect(content).toContain('Current time:');
    expect(content).toContain('prompt-timestamp.ts');
    expect(content).toContain('when the host provides one');
    expect(content).toContain('current system date');
    expect(content).toContain('verify the current version for that date');
    expect(content).toContain('Pin what the registry reports today');
  });

  it.each([
    ['canonical quality-review skill', 'packages/cli/templates/skills/quality-review/SKILL.md'],
    ['dogfood Claude quality-review skill', '.claude/skills/quality-review/SKILL.md'],
    ['dogfood Codex quality-review skill', '.agents/skills/quality-review/SKILL.md'],
  ])('%s uses the prompt timestamp instead of a hardcoded year', (_label, path) => {
    const content = readRepoFile(path);

    expectPromptTimestampSearch(content);
  });

  it.each([
    [
      'canonical Cursor quality-review rule',
      'packages/cli/templates/cursor/rules/safeword-quality-reviewing.mdc',
    ],
    ['dogfood Cursor quality-review rule', '.cursor/rules/safeword-quality-reviewing.mdc'],
  ])('%s is a thin @reference, inheriting the skill freshness instruction', (_label, path) => {
    const content = readRepoFile(path);

    // Migrated to the @reference pattern (ticket 151): the rule is a thin pointer,
    // so the prompt-timestamp instruction lives in the quality-review skill it
    // references (asserted above), not duplicated in the rule.
    expect(content).toContain('@.claude/skills/quality-review/SKILL.md');
  });

  it.each([
    ['canonical Codex config', 'packages/cli/templates/codex/config.toml'],
    ['dogfood Codex config', '.codex/config.toml'],
  ])('%s wires packaged UserPromptSubmit context', (_label, path) => {
    const content = readRepoFile(path);

    expect(content).toContain('[[hooks.UserPromptSubmit]]');
    expect(content).toContain('npx --yes safeword codex-hook user-prompt-submit');
    expect(content).not.toContain('.safeword/hooks/prompt-timestamp.ts');
  });
});
