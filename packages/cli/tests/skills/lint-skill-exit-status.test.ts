import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPOSITORY_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');

const LINT_SURFACES = [
  'packages/cli/templates/skills/lint/SKILL.md',
  '.safeword/skills/lint/SKILL.md',
  '.claude/skills/lint/SKILL.md',
  'packages/cli/codex-plugin/skills/lint/SKILL.md',
] as const;

const LINT_COMMAND_SURFACES = [
  'packages/cli/templates/commands/lint.md',
  '.cursor/commands/lint.md',
] as const;

function lintInstructions(relativePath: string): string {
  return readFileSync(nodePath.join(REPOSITORY_ROOT, relativePath), 'utf8');
}

describe('bounded lint instruction behavior (#3515)', () => {
  it.each(LINT_SURFACES)('%s defaults to changed files', relativePath => {
    const content = lintInstructions(relativePath);

    expect(content).toContain('git diff --name-only');
    expect(content).toContain('git ls-files --others --exclude-standard');
    expect(content).toContain('pass only those changed files');
    expect(content).toContain('explicitly asks for a **full** lint');
  });

  it.each(LINT_SURFACES)('%s does not prescribe a silent full-root fallback', relativePath => {
    const content = lintInstructions(relativePath);

    expect(content).not.toContain('ruff check --fix .');
    expect(content).not.toContain('ruff format .');
    expect(content).not.toContain('golangci-lint run --fix ./...');
    expect(content).not.toContain('2>&1 || true');
  });

  it.each(LINT_SURFACES)('%s keeps polyglot changed-scope examples', relativePath => {
    const content = lintInstructions(relativePath);

    expect(content).toContain('ruff check --fix <changed-python-files...>');
    expect(content).toContain('bunx eslint --fix -- <changed-js-ts-files...>');
    expect(content).toContain('golangci-lint run --fix <changed-go-package-patterns...>');
  });

  it.each(LINT_COMMAND_SURFACES)('%s delegates to the canonical installed skill', relativePath => {
    expect(lintInstructions(relativePath)).toContain('.safeword/skills/lint/SKILL.md');
  });
});
