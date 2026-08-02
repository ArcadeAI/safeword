import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateCodexPluginAssets } from '../src/codex-plugin/catalogue.js';
import { CURSOR_COMMAND_WRAPPERS } from '../src/cursor-wrappers.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const canonicalSkillPath = nodePath.join(
  repoRoot,
  'packages/cli/templates/skills/closeout/SKILL.md',
);

function canonicalSkill(): string {
  expect(existsSync(canonicalSkillPath), 'canonical closeout skill must be shipped').toBe(true);
  return existsSync(canonicalSkillPath) ? readFileSync(canonicalSkillPath, 'utf8') : '';
}

describe('closeout delivery evidence (93C14D NTB1.R1)', () => {
  it('requires current local and hosted evidence before merge or cleanup', () => {
    const skill = canonicalSkill();

    expect(skill).toContain('current pull request head');
    expect(skill).toContain('required checks');
    expect(skill).toContain('review requirements');
    expect(skill).toContain('draft');
    expect(skill).toMatch(/no merge or cleanup/i);
    expect(skill).not.toMatch(/merge command.*proves.*merged/i);
  });
});

describe('closeout merge authority (93C14D TBU1.R1)', () => {
  it('defaults to no authority and never infers or escalates administrative authority', () => {
    const skill = canonicalSkill();

    expect(skill).toContain('Invocation alone grants no merge authority');
    expect(skill).toMatch(/current\s+user request/);
    expect(skill).toContain('normal merge');
    expect(skill).toContain('administrative merge');
    expect(skill).toMatch(/never escalate/i);
    expect(skill).toContain('consumed');
    expect(skill).toContain('historical');
  });
});

describe('closeout observed resumption (93C14D NTB1.R3)', () => {
  it('re-observes merge truth and continues only the unfinished suffix', () => {
    const skill = canonicalSkill();

    expect(skill).toContain('state,mergedAt,mergeCommit,headRefName,headRefOid');
    expect(skill).toContain('state` is exactly `MERGED`');
    expect(skill).toMatch(/success or error[\s\S]*re-observe/i);
    expect(skill).toContain('remote merge succeeded');
    expect(skill).toContain('unknown');
    expect(skill).toContain('unfinished suffix');
    expect(skill).toContain('already closed');
  });
});

describe('closeout host entry points (93C14D TBU1.R4)', () => {
  it('derives Claude, Cursor, and Codex entry points from production catalogues', () => {
    const cursor = CURSOR_COMMAND_WRAPPERS.find(wrapper => wrapper.name === 'closeout');
    expect(cursor?.skillPath).toBe('closeout/SKILL.md');
    expect(SAFEWORD_SCHEMA.ownedFiles['.claude/skills/closeout/SKILL.md']).toBeDefined();
    expect(SAFEWORD_SCHEMA.ownedFiles['.cursor/commands/closeout.md']).toBeDefined();

    const generatedCodex = generateCodexPluginAssets(
      nodePath.join(repoRoot, 'packages/cli/templates/skills'),
    ).find(asset => asset.relativePath === 'skills/closeout/SKILL.md');
    expect(generatedCodex?.content).toContain('name: closeout');
    expect(generatedCodex?.content).toContain('no merge or cleanup');
  });
});
