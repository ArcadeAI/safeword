import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  assertCodexPluginCatalogue,
  generateCodexPluginAssets,
} from '../src/codex-plugin/catalogue.js';
import { CURSOR_COMMAND_WRAPPERS } from '../src/cursor-wrappers.js';
import { runParity } from '../src/parity.js';
import { SAFEWORD_SCHEMA } from '../src/schema.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const canonicalSkillsDirectory = nodePath.join(repoRoot, 'packages/cli/templates/skills');
const canonicalSkillPath = nodePath.join(canonicalSkillsDirectory, 'closeout/SKILL.md');

function canonicalSkill(): string {
  expect(existsSync(canonicalSkillPath), 'canonical closeout skill must be shipped').toBe(true);
  return readFileSync(canonicalSkillPath, 'utf8');
}

function normalizedParagraphContaining(content: string, marker: string): string {
  const paragraph = content.split(/\n\s*\n/u).find(candidate => candidate.includes(marker)) ?? '';
  return paragraph.replaceAll(/\s+/gu, ' ').trim();
}

describe('closeout delivery evidence (93C14D NTB1.R1)', () => {
  it('accepts exact-head green CI and falls back to local verification', () => {
    const skill = canonicalSkill();

    expect(skill).toContain('current pull request head');
    expect(skill).toContain('required checks');
    expect(skill).toContain('green hosted CI or local verification');
    expect(normalizedParagraphContaining(skill, 'When CI is absent')).toContain('run `/verify`');
    expect(skill).toContain('review requirements');
    expect(skill).toContain('draft');
    expect(skill).toContain('no merge or cleanup');
    expect(normalizedParagraphContaining(skill, 'Collect and report every blocker')).toContain(
      "A merge command's exit status never proves that the pull request is merged.",
    );
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
    expect(
      normalizedParagraphContaining(skill, 'Invocation alone grants no merge authority'),
    ).toContain('historical, implied, or previously consumed authority is not available');
  });

  it.each([
    { authority: 'no merge authority', contract: 'Invocation alone grants no merge authority' },
    { authority: 'normal merge authority', contract: 'normal merge' },
    { authority: 'administrative merge authority', contract: 'administrative merge' },
  ])('documents the exact $authority boundary', ({ contract }) => {
    expect(canonicalSkill()).toContain(contract);
  });
});

describe('closeout observed resumption (93C14D NTB1.R3)', () => {
  it('re-observes merge truth and continues only the unfinished suffix', () => {
    const skill = canonicalSkill();

    expect(skill).toContain('state,mergedAt,mergeCommit,headRefName,headRefOid');
    expect(skill).toContain('state` is exactly `MERGED`');
    expect(skill).toMatch(/success or error[\s\S]*re-observe/i);
    expect(skill).toContain('remote merge succeeded');
    expect(normalizedParagraphContaining(skill, 'Queued, automatic')).toContain(
      'pending, unknown, or unobservable results are not merge proof',
    );
    expect(normalizedParagraphContaining(skill, 'On every invocation')).toContain(
      'continue only the unfinished suffix',
    );
    expect(normalizedParagraphContaining(skill, 'If the command reported an error')).toContain(
      'report that the session is already closed',
    );
    expect(normalizedParagraphContaining(skill, 'For 24 hours')).toContain(
      'wrong-head receipt blocks interrupted cleanup resumption',
    );
  });

  it('keeps dependency audit in delivery readiness without rerunning it after merge', () => {
    const skill = canonicalSkill();

    expect(skill).toMatch(/green hosted CI[\s\S]*or[\s\S]*local verification/i);
    expect(skill).toMatch(/dependency audit[\s\S]*delivery-time/i);
    expect(skill).toMatch(
      /post-merge[\s\S]*green hosted CI[\s\S]*verification, build, typecheck, and BDD/i,
    );
    expect(skill).toMatch(/does not rerun[\s\S]*dependency audit/i);
  });
});

describe('closeout retrospective boundary (93C14D NTB1.R2)', () => {
  it('keeps every retrospective outcome advisory for repository cleanup', () => {
    const skill = canonicalSkill();

    expect(skill).toContain('safeword retro run --json --auto-extract');
    expect(skill).toContain('agent_filing_needed');
    expect(skill).toContain('empty filing spool');
    expect(skill).toContain('authenticated preview');
    expect(skill).toContain('invoke the `/retro-filer` skill');
    expect(skill).toMatch(/missing.*expired.*binding/i);
    expect(skill).toMatch(/authenticated\s+current\s+`CODEX_THREAD_ID`/i);
    expect(skill).toMatch(/no\s+newest-session\s+fallback/i);
    const advisoryPolicy = normalizedParagraphContaining(
      skill,
      'Repository cleanup does not depend',
    );
    expect(advisoryPolicy).toContain(
      'Repository cleanup does not depend on a complete retrospective.',
    );
    expect(advisoryPolicy).toContain('A missing binding');
    expect(advisoryPolicy).toContain('incomplete retrospective');
    expect(advisoryPolicy).toContain('extraction failure');
    expect(advisoryPolicy).toContain('identity mismatch is advisory');

    const filingPolicy = normalizedParagraphContaining(skill, 'Filing failure or pending drafts');
    expect(filingPolicy).toContain('advisory for repository cleanup too');
    expect(filingPolicy).toContain('do not let retrospective state authorize or block cleanup');
  });

  it('wires the authenticated preview field to the shipped Codex filer skill', () => {
    const skill = canonicalSkill();
    const generatedFiler = generateCodexPluginAssets(canonicalSkillsDirectory).find(
      asset => asset.relativePath === 'skills/retro-filer/SKILL.md',
    );

    expect(skill).toContain('plan.retro.spoolPath');
    expect(skill).toContain('`/retro-filer`');
    expect(generatedFiler?.content).toContain('name: retro-filer');
    expect(generatedFiler?.content).toContain('`retro.spoolPath` field');
    expect(generatedFiler?.content).toMatch(/never accept\s+a caller-nominated path/u);
  });
});

describe('closeout cleanup and reporting (93C14D NTB1.R1/TBU1.R2/R3)', () => {
  it('uses the preview digest guard and exact ordered non-force cleanup', () => {
    const skill = canonicalSkill();

    expect(skill).toContain('bun .safeword/scripts/closeout-cleanup.ts --pr PR_NUMBER');
    expect(skill).toContain('--yes --plan PLAN_DIGEST');
    expect(skill).toContain('preview is the default');
    const cleanupOrder = normalizedParagraphContaining(skill, 'executes only this order');
    expect(cleanupOrder).toContain(
      'executes only this order: worktree, remote branch, local branch',
    );
    expect(skill).toContain('--force-with-lease');
    expect(skill).toContain('git update-ref -d');
    expect(cleanupOrder).toContain('It never passes `--force` to `git worktree remove`');
    expect(skill).not.toContain('gh pr merge --delete-branch');
    const cleanupAuthority = normalizedParagraphContaining(
      skill,
      'Invocation permits preview only',
    );
    expect(cleanupAuthority).toContain('grants no destructive cleanup authority');
    expect(cleanupAuthority).toContain('current user request explicitly authorizes cleanup');
    expect(cleanupAuthority).toContain('Cleanup authority is consumed when apply is attempted');
  });

  it('reports every durable final state and every unresolved recovery action', () => {
    const skill = canonicalSkill();
    expect(skill).toContain('- verification and the exact verified head;');
    expect(skill).toContain('- merged state and merge commit;');
    expect(skill).toContain('- retrospective completion and filing result;');
    expect(skill).toContain('- remote branch, local branch, and worktree state;');
    expect(skill).toContain('- unresolved items (explicitly `none` when empty).');
    expect(skill).toContain('report every blocker and its recovery action');
    expect(skill).toContain(
      'Claim the session complete only after fresh observation proves every state.',
    );
  });
});

describe('closeout host entry points (93C14D TBU1.R4)', () => {
  it('derives Claude, Cursor, and Codex entry points from production catalogues', () => {
    const cursor = CURSOR_COMMAND_WRAPPERS.find(wrapper => wrapper.name === 'closeout');
    expect(cursor?.skillPath).toBe('closeout/SKILL.md');
    expect(SAFEWORD_SCHEMA.ownedFiles['.claude/skills/closeout/SKILL.md']).toBeDefined();
    expect(SAFEWORD_SCHEMA.ownedFiles['.cursor/commands/closeout.md']?.template).toBe(
      'commands/closeout.md',
    );
    expect(
      readFileSync(nodePath.join(repoRoot, 'packages/cli/templates/commands/closeout.md'), 'utf8'),
    ).toContain('Read and follow the instructions in .safeword/skills/closeout/SKILL.md');

    const generatedCodex = generateCodexPluginAssets(canonicalSkillsDirectory).find(
      asset => asset.relativePath === 'skills/closeout/SKILL.md',
    );
    expect(generatedCodex?.content).toContain('name: closeout');
    expect(generatedCodex?.content).toContain('no merge or cleanup');
  });

  it('keeps every shipped closeout surface aligned with the canonical policy', () => {
    const canonical = canonicalSkill();
    const shippedPaths = ['.safeword/skills/closeout/SKILL.md', '.claude/skills/closeout/SKILL.md'];

    for (const shippedPath of shippedPaths) {
      expect(SAFEWORD_SCHEMA.ownedFiles[shippedPath]?.template).toBe('skills/closeout/SKILL.md');
      expect(readFileSync(nodePath.join(repoRoot, shippedPath), 'utf8')).toBe(canonical);
    }

    const pluginSkill = readFileSync(
      nodePath.join(repoRoot, 'plugin/skills/closeout/SKILL.md'),
      'utf8',
    );
    for (const marker of [
      'Repository cleanup does not depend on a complete retrospective.',
      'Filing failure or pending drafts are advisory for repository cleanup too',
    ]) {
      expect(pluginSkill).toContain(marker);
    }
    expect(pluginSkill).toContain(
      'bun "${CLAUDE_PLUGIN_ROOT}"/resources/scripts/closeout-cleanup.ts --pr PR_NUMBER',
    );
    expect(pluginSkill).toContain('run `/safeword:verify`');
    expect(pluginSkill).toContain('invoke the `/safeword:retro-filer` skill');
  });

  it('seals the Claude plugin closeout skill through inventory and identity digests', () => {
    const pluginSkill = readFileSync(
      nodePath.join(repoRoot, 'plugin/skills/closeout/SKILL.md'),
      'utf8',
    );
    const inventoryBytes = readFileSync(nodePath.join(repoRoot, 'plugin/inventory.json'));
    const inventory = JSON.parse(inventoryBytes.toString('utf8')) as {
      assets: { path: string; sha256: string }[];
    };
    const closeoutAsset = inventory.assets.find(asset => asset.path === 'skills/closeout/SKILL.md');
    expect(closeoutAsset?.sha256).toBe(createHash('sha256').update(pluginSkill).digest('hex'));
    const identity = JSON.parse(
      readFileSync(nodePath.join(repoRoot, 'plugin/identity.json'), 'utf8'),
    ) as { inventory_sha256: string };
    expect(identity.inventory_sha256).toBe(
      createHash('sha256').update(inventoryBytes).digest('hex'),
    );
  });

  it.each([
    {
      surface: 'canonical template',
      managedPath: '.claude/skills/closeout/SKILL.md',
      templatePath: 'skills/closeout/SKILL.md',
      mutate: 'template' as const,
    },
    {
      surface: 'dogfood Claude',
      managedPath: '.claude/skills/closeout/SKILL.md',
      templatePath: 'skills/closeout/SKILL.md',
      mutate: 'managed' as const,
    },
    {
      surface: 'generated Cursor',
      managedPath: '.cursor/commands/closeout.md',
      templatePath: 'commands/closeout.md',
      mutate: 'managed' as const,
    },
  ])('detects closeout drift at the $surface surface through production parity', row => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-parity-'));
    const templates = nodePath.join(fixture, 'templates');
    const managed = nodePath.join(fixture, row.managedPath);
    const template = nodePath.join(templates, row.templatePath);
    try {
      mkdirSync(nodePath.dirname(managed), { recursive: true });
      mkdirSync(nodePath.dirname(template), { recursive: true });
      writeFileSync(template, 'closeout contract\n');
      writeFileSync(managed, 'closeout contract\n');
      const schema = {
        ownedFiles: { [row.managedPath]: { template: row.templatePath } },
        contracts: {},
      };
      expect(
        runParity({ schema, mode: 'all', rootDirectory: fixture, templatesDirectory: templates })
          .failures,
      ).toEqual([]);

      writeFileSync(row.mutate === 'template' ? template : managed, 'drifted closeout contract\n');
      const failures = runParity({
        schema,
        mode: 'all',
        rootDirectory: fixture,
        templatesDirectory: templates,
      }).failures;
      expect(failures[0]).toMatchObject({ kind: 'pair' });
      expect(failures[0]?.message).toContain(row.managedPath);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('detects generated Codex closeout drift through the production catalogue', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-closeout-codex-parity-'));
    const pluginDirectory = nodePath.join(fixture, 'codex-plugin');
    try {
      cpSync(nodePath.join(repoRoot, 'packages/cli/codex-plugin'), pluginDirectory, {
        recursive: true,
      });
      assertCodexPluginCatalogue(canonicalSkillsDirectory, pluginDirectory);
      writeFileSync(
        nodePath.join(pluginDirectory, 'skills/closeout/SKILL.md'),
        'drifted closeout contract\n',
      );
      expect(() => {
        assertCodexPluginCatalogue(canonicalSkillsDirectory, pluginDirectory);
      }).toThrow();
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
