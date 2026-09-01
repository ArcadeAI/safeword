import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const readRepoFile = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

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
    expect(readRepoFile('packages/cli/codex-plugin/skills/pr-readiness/SKILL.md')).toContain(
      'name: pr-readiness',
    );
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
    expect(normalized).toContain('recommend draft');
    expect(normalized).toContain('hard blocker');
    expect(skill).toContain('GATES PASS — awaiting explicit Ready authorization');
    expect(skill).toContain('gh pr ready --undo');
    expect(skill).toContain('explicitly authorizes that exact state change');
    expect(skill).toContain('Never invent a');
    expect(skill).toContain('require unsatisfied');
    expect(skill).toContain('independence: none');
    expect(skill).toContain('resume this same readiness run');
  });

  it('writes for the reviewer without manufacturing evidence or stack scope', () => {
    const skill = readRepoFile(canonicalPath);
    for (const field of [
      'Job to be done',
      'Summary and approach',
      'Design decisions',
      'Scope and exclusions',
      'Stack context',
      'Verification',
      'Open questions and review focus',
      'Risk and blast radius',
      'Coverage status',
    ]) {
      expect(skill).toContain(field);
    }
    expect(skill).toContain('Never turn unknown or unchecked evidence into completed verification');
    expect(skill).toContain('direct dependency');
    expect(skill).toContain('cumulative stack changes');
  });

  it('preserves reviewer conversation and freshness', () => {
    const skill = readRepoFile(canonicalPath);
    expect(skill).toContain('Reply before resolving every review thread');
    expect(skill).toContain('Leave disagreements unresolved');
    expect(skill).toContain('Re-request review after every material push');
  });

  it.each([
    ['SAFEWORD', 'packages/cli/templates/SAFEWORD.md', 'seven current-head gates'],
    ['quality review', 'packages/cli/templates/skills/quality-review/SKILL.md', 'review gate only'],
    [
      'finish review',
      'packages/cli/templates/skills/finish-review/SKILL.md',
      'never authorizes Ready',
    ],
    [
      'closeout',
      'packages/cli/templates/skills/closeout/SKILL.md',
      'current-head `/pr-readiness` decision',
    ],
  ])('%s routes its PR boundary through the readiness workflow', (_label, path, binding) => {
    expect(readRepoFile(path)).toContain(binding);
  });
});
