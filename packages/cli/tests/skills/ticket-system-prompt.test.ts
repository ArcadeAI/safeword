/**
 * Regression tests for the ticket-system skill prompt (ticket 158, slice 6).
 *
 * Asserts that the find-max-and-increment guidance is gone and the new
 * local-first `safeword ticket new` resolver instruction is in place. Also walks every shipped
 * template under packages/cli/templates/ to guard against the same pattern
 * resurfacing elsewhere.
 *
 * Cheap content asserts — no spawning, no fs writes.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '..', '..', '..', '..');
const TICKET_SKILL_PATH = nodePath.join(
  REPO_ROOT,
  'packages',
  'cli',
  'templates',
  'skills',
  'ticket-system',
  'SKILL.md',
);
const TEMPLATES_ROOT = nodePath.join(REPO_ROOT, 'packages', 'cli', 'templates');

function readSkill(): string {
  return readFileSync(TICKET_SKILL_PATH, 'utf8');
}

function walkMarkdown(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = nodePath.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      found.push(...walkMarkdown(fullPath));
    } else if (entry.endsWith('.md')) {
      found.push(fullPath);
    }
  }
  return found;
}

describe('ticket-system SKILL.md (template)', () => {
  it('does not contain the substring "highest" (find-max-and-increment regression)', () => {
    expect(readSkill().toLowerCase()).not.toContain('highest');
  });

  it('does not contain the substring "increment" (find-max-and-increment regression)', () => {
    expect(readSkill().toLowerCase()).not.toContain('increment');
  });

  it('documents the local-first resolver for `safeword ticket new`', () => {
    const skill = readSkill();
    expect(skill).toContain('if [ -x node_modules/.bin/safeword ]; then');
    expect(skill).toContain('SW="node_modules/.bin/safeword"');
    expect(skill).toContain('elif [ -f packages/cli/src/cli.ts ]; then');
    expect(skill).toContain('SW="bun packages/cli/src/cli.ts"');
    expect(skill).toContain('else SW="bunx safeword"; fi');
    expect(skill).toContain('$SW ticket new <slug>');
    expect(skill).not.toContain('`safeword ticket new');
  });

  it('documents the current ticket folder shape created by the CLI', () => {
    const skill = readSkill();
    expect(skill).toContain('<namespace-root>/tickets/{ID}-{slug}/');
    expect(skill).toContain('7K9M3P-login-bug/');
  });

  it('does not describe ID-only folders as the new ticket format', () => {
    const skill = readSkill();
    expect(skill).not.toContain('folder name is the ID alone');
    expect(skill).not.toContain('New format: folder = Crockford ID');
  });
});

describe('all shipped templates (packages/cli/templates/**/*.md)', () => {
  it('do not contain the substring "find the highest" (broader regression net)', () => {
    const offenders: string[] = [];
    for (const file of walkMarkdown(TEMPLATES_ROOT)) {
      if (readFileSync(file, 'utf8').toLowerCase().includes('find the highest')) {
        offenders.push(nodePath.relative(REPO_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
