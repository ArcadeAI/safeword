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
  });

  it('keeps all seven non-negotiables as Ready-for-Review blockers', () => {
    const skill = readRepoFile(canonicalPath);
    for (const requirement of [
      'ticket linkage',
      'understand every change',
      'end-user path',
      'local checks and CI',
      'AI review',
      'top-to-bottom self-review',
      'immediately mergeable after approval',
    ]) {
      expect(skill).toContain(requirement);
    }
    expect(skill).toContain('remain Draft');
    expect(skill).toContain('hard blocker');
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
    ['SAFEWORD', 'packages/cli/templates/SAFEWORD.md'],
    ['quality review', 'packages/cli/templates/skills/quality-review/SKILL.md'],
    ['finish review', 'packages/cli/templates/skills/finish-review/SKILL.md'],
    ['closeout', 'packages/cli/templates/skills/closeout/SKILL.md'],
  ])('%s routes its PR boundary through the readiness workflow', (_label, path) => {
    expect(readRepoFile(path)).toContain('pr-readiness');
  });
});
