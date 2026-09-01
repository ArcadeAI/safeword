import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const readRepoFile = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');
const workflowBody = (content: string): string => {
  const frontmatterEnd = content.indexOf('---', 3);
  return content
    .slice(frontmatterEnd + 3)
    .trim()
    .replaceAll('$safeword:', '/');
};

const canonicalPath = 'packages/cli/templates/skills/pr-readiness/SKILL.md';

describe('reviewer-as-customer PR readiness (#3579)', () => {
  it('ships one canonical readiness workflow to every agent host', () => {
    expect(existsSync(nodePath.join(repoRoot, canonicalPath))).toBe(true);
    expect(SAFEWORD_SCHEMA.ownedFiles['.claude/skills/pr-readiness/SKILL.md']).toEqual({
      template: 'skills/pr-readiness/SKILL.md',
    });
    expect(SAFEWORD_SCHEMA.ownedFiles['.safeword/skills/pr-readiness/SKILL.md']).toEqual({
      template: 'skills/pr-readiness/SKILL.md',
    });
    expect(readRepoFile('.claude/skills/pr-readiness/SKILL.md')).toBe(readRepoFile(canonicalPath));
    expect(readRepoFile('.safeword/skills/pr-readiness/SKILL.md')).toBe(
      readRepoFile(canonicalPath),
    );
    expect(readRepoFile('.cursor/rules/safeword-pr-readiness.mdc')).toContain(
      '@.safeword/skills/pr-readiness/SKILL.md',
    );
    expect(readRepoFile('.cursor/commands/pr-readiness.md')).toContain(
      'Read and follow the instructions in .safeword/skills/pr-readiness/SKILL.md',
    );
    expect(readRepoFile('packages/cli/templates/commands/pr-readiness.md')).toContain(
      '.safeword/skills/pr-readiness/SKILL.md',
    );
    expect(readRepoFile('packages/cli/templates/cursor/rules/safeword-pr-readiness.mdc')).toContain(
      '@.safeword/skills/pr-readiness/SKILL.md',
    );
    expect(SAFEWORD_SCHEMA.ownedFiles['.opencode/commands/pr-readiness.md']).toBeDefined();
    expect(
      workflowBody(readRepoFile('packages/cli/codex-plugin/skills/pr-readiness/SKILL.md')),
    ).toBe(workflowBody(readRepoFile(canonicalPath)));
  });

  it('keeps all seven non-negotiables as Ready-for-Review blockers', () => {
    const skill = readRepoFile(canonicalPath);
    const normalized = skill.toLowerCase();
    const gates =
      /## Seven hard Ready-for-Review gates(?<body>[\s\S]*?)## Write for the reviewer/.exec(skill)
        ?.groups?.body;
    expect(gates).toBeDefined();
    for (const requirement of [
      'ticket linkage',
      'understand every change',
      'end-user path',
      'local checks and CI',
      'AI review',
      'fresh self-review',
      'mergeable after approval',
    ]) {
      expect(gates?.toLowerCase()).toContain(requirement.toLowerCase());
    }
    expect(gates?.match(/^\d\. \*\*/gm)).toHaveLength(7);
    expect(normalized).toContain('top-to-bottom');
    expect(normalized).toMatch(/recommend\s+draft/);
    expect(normalized).toContain('hard blocker');
    expect(skill).toContain('GATES PASS — awaiting explicit Ready authorization');
    expect(skill).toContain('gh pr ready --undo');
    expect(skill).toContain('explicitly authorizes that exact state change');
    expect(skill).toContain('Never invent a');
    expect(skill).toContain('require unsatisfied');
    expect(skill).toContain('Disclose degraded or absent independence');
    expect(skill).toContain('resume this same readiness run');
  });

  it('writes for the reviewer without manufacturing evidence or stack scope', () => {
    const skill = readRepoFile(canonicalPath);
    for (const field of [
      '**Why:**',
      'What changed',
      'Verification',
      'Risks and review focus',
      'Readiness evidence',
    ]) {
      expect(skill).toContain(field);
    }
    expect(skill).toContain('Never manufacture verification');
    expect(skill).toContain('direct dependency');
    expect(skill).toContain('cumulative stack changes');
    expect(skill).toContain('Head: <full current head SHA>');
    expect(
      skill
        .split('\n')
        .filter(line => /^[1-7]\./.exec(line.trim()) && line.endsWith('— PASS: <evidence>')),
    ).toHaveLength(7);
  });

  it('preserves reviewer conversation and freshness', () => {
    const skill = readRepoFile(canonicalPath);
    expect(skill).toContain('Reply before resolving every thread');
    expect(skill).toContain('leave disagreements for the reviewer to resolve');
    expect(skill).toContain('re-request review after a');
  });

  it.each([
    ['SAFEWORD', 'packages/cli/templates/SAFEWORD.md', 'seven current-head gates'],
    ['quality review', 'packages/cli/templates/skills/quality-review/SKILL.md', 'review gate only'],
    [
      'finish review',
      'packages/cli/templates/skills/finish-review/SKILL.md',
      'never authorizes Ready',
    ],
    ['closeout', 'packages/cli/templates/skills/closeout/SKILL.md', 'require `Head:`'],
  ])('%s routes its PR boundary through the readiness workflow', (_label, path, binding) => {
    expect(readRepoFile(path)).toContain(binding);
  });
});
