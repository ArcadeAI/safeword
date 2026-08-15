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
const canonicalSkillPath = nodePath.join(
  repoRoot,
  'packages/cli/templates/skills/closeout/SKILL.md',
);

function canonicalSkill(): string {
  expect(existsSync(canonicalSkillPath), 'canonical closeout skill must be shipped').toBe(true);
  return existsSync(canonicalSkillPath) ? readFileSync(canonicalSkillPath, 'utf8') : '';
}

describe('closeout delivery evidence (93C14D NTB1.R1)', () => {
  it('accepts exact-head green CI and falls back to local verification', () => {
    const skill = canonicalSkill();

    expect(skill).toContain('current pull request head');
    expect(skill).toContain('required checks');
    expect(skill).toMatch(/green hosted CI or local verification/);
    expect(skill).toMatch(/When CI is absent[\s\S]*run `\/verify`/);
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
  it('keeps retrospective learning advisory while protecting endangered recovery data', () => {
    const skill = canonicalSkill();
    const guard = readFileSync(
      nodePath.join(repoRoot, 'packages/cli/templates/scripts/closeout-cleanup.ts'),
      'utf8',
    );

    expect(skill).toContain('safeword retro run --json');
    expect(guard).toMatch(/'retro',\s*'run',\s*'--json',\s*'--auto-extract'/u);
    expect(skill).toContain('agent_filing_needed');
    expect(skill).toContain('empty filing spool');
    expect(skill).toContain('authenticated preview');
    expect(skill).toContain('invoke the `safeword:retro-filer` skill');
    expect(skill).toMatch(/missing.*expired.*binding/i);
    expect(skill).toMatch(/authenticated\s+current\s+`CODEX_THREAD_ID`/i);
    expect(skill).toMatch(/no\s+newest-session\s+fallback/i);
    expect(skill).toMatch(/missing.*binding.*advisory/is);
    expect(skill).toMatch(/incomplete.*retrospective.*advisory/is);
    expect(skill).toMatch(/extraction.*failure.*advisory/is);
    expect(skill).toMatch(/filing.*failure.*pending drafts.*recovery blocker/is);
    expect(skill).toMatch(/repository cleanup.*does not depend.*retrospective/is);
  });

  it('wires the authenticated preview field to the shipped Codex filer skill', () => {
    const skill = canonicalSkill();
    const generatedFiler = generateCodexPluginAssets(
      nodePath.join(repoRoot, 'packages/cli/templates/skills'),
    ).find(asset => asset.relativePath === 'skills/retro-filer/SKILL.md');

    expect(skill).toContain('plan.retro.spoolPath');
    expect(skill).toContain('`safeword:retro-filer`');
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
    expect(skill).toMatch(/preview.*default/is);
    expect(skill).toMatch(/worktree.*remote branch.*local branch/is);
    expect(skill).toContain('--force-with-lease');
    expect(skill).toContain('git update-ref -d');
    expect(skill).toMatch(/never.*worktree.*--force/is);
    expect(skill).not.toContain('gh pr merge --delete-branch');
  });

  it('reports every durable final state and every unresolved recovery action', () => {
    const skill = canonicalSkill();
    for (const field of [
      'verification',
      'merge commit',
      'retrospective',
      'remote branch',
      'local branch',
      'worktree',
      'unresolved items',
    ]) {
      expect(skill).toContain(field);
    }
    expect(skill).toMatch(/every blocker.*recovery action/is);
    expect(skill).toMatch(/claim.*complete.*only/is);
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
    const canonicalSkills = nodePath.join(repoRoot, 'packages/cli/templates/skills');
    const pluginDirectory = nodePath.join(fixture, 'codex-plugin');
    try {
      cpSync(nodePath.join(repoRoot, 'packages/cli/codex-plugin'), pluginDirectory, {
        recursive: true,
      });
      assertCodexPluginCatalogue(canonicalSkills, pluginDirectory);
      writeFileSync(
        nodePath.join(pluginDirectory, 'skills/closeout/SKILL.md'),
        'drifted closeout contract\n',
      );
      expect(() => {
        assertCodexPluginCatalogue(canonicalSkills, pluginDirectory);
      }).toThrow();
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
});
