import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { reconcile } from '../../src/reconcile.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const RESOLVER_COMMAND = '.safeword/hooks/resolve-project-knowledge.ts';

const PROJECT_TYPE = {
  typescript: false,
  react: false,
  nextjs: false,
  astro: false,
  vitest: false,
  playwright: false,
  tailwind: false,
  tanstackQuery: false,
  publishableLibrary: false,
  shell: false,
  hasJsSource: false,
  existingLinter: false,
  existingFormatter: false,
  existingPrettierConfig: false,
  existingEslintConfig: undefined,
  legacyEslint: false,
  existingRuffConfig: undefined,
  existingMypyConfig: false,
  existingImportLinterConfig: false,
  existingGolangciConfig: undefined,
  existingClippyConfig: undefined,
  existingRustfmtConfig: undefined,
  existingSqlfluffConfig: undefined,
  existingCucumberHarness: undefined,
  scaffoldBddLane: true,
};

const STAGES = [
  {
    stage: 'self-review',
    claude: '.claude/skills/self-review/SKILL.md',
    cursor: '.cursor/commands/self-review.md',
    codex: 'packages/cli/codex-plugin/skills/self-review/SKILL.md',
  },
  {
    stage: 'scenario review',
    claude: '.claude/skills/review-spec/SKILL.md',
    cursor: '.cursor/commands/review-spec.md',
    codex: 'packages/cli/codex-plugin/skills/review-spec/SKILL.md',
  },
  {
    stage: 'implementation-plan review',
    claude: '.claude/skills/bdd/PLAN_IMPLEMENTATION.md',
    cursor: '.cursor/rules/bdd-plan-implementation.mdc',
    codex: 'packages/cli/codex-plugin/skills/bdd/references/PLAN_IMPLEMENTATION.md',
  },
  {
    stage: 'quality review',
    claude: '.claude/skills/quality-review/SKILL.md',
    cursor: '.cursor/commands/quality-review.md',
    codex: 'packages/cli/codex-plugin/skills/quality-review/SKILL.md',
  },
] as const;

const REVIEW_ENTRYPOINTS = STAGES.flatMap(({ stage, ...hosts }) =>
  (Object.entries(hosts) as [keyof typeof hosts, string][]).map(([host, path]) => ({
    stage,
    host,
    path,
  })),
);

function readEntrypoint(projectDirectory: string, host: string, path: string): string {
  const absolutePath = nodePath.join(host === 'codex' ? REPO_ROOT : projectDirectory, path);
  const entrypoint = readFileSync(absolutePath, 'utf8');
  if (entrypoint.includes(RESOLVER_COMMAND)) return entrypoint;

  const reference = /@?(\.claude\/skills\/[\w./-]+)/u.exec(entrypoint)?.[1];
  expect(
    reference,
    `${host} entry point ${path} must reference its installed procedure`,
  ).toBeDefined();
  return readFileSync(nodePath.join(projectDirectory, reference ?? ''), 'utf8');
}

describe('installed review entry points resolve current project knowledge', () => {
  let projectDirectory: string;

  beforeAll(async () => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-entrypoints-'));
    mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
    mkdirSync(nodePath.join(projectDirectory, 'knowledge'), { recursive: true });
    writeFileSync(
      nodePath.join(projectDirectory, 'package.json'),
      JSON.stringify({ name: 'review-entrypoints-fixture', version: '1.0.0' }),
    );
    writeFileSync(
      nodePath.join(projectDirectory, '.safeword', 'config.json'),
      JSON.stringify({
        installedPacks: [],
        paths: {
          principles: 'knowledge/principles.md',
          personas: 'knowledge/personas.md',
          surfaces: 'knowledge/surfaces.md',
        },
      }),
    );

    await reconcile(SAFEWORD_SCHEMA, 'install', {
      cwd: projectDirectory,
      projectType: PROJECT_TYPE,
      developmentDeps: {},
      productionDeps: {},
      isGitRepo: true,
      languages: { javascript: true, python: false, golang: false, rust: false, sql: false },
    });
  });

  afterAll(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('covers every host and review stage', () => {
    expect(REVIEW_ENTRYPOINTS).toHaveLength(12);
    expect(new Set(REVIEW_ENTRYPOINTS.map(row => row.host))).toEqual(
      new Set(['claude', 'cursor', 'codex']),
    );
  });

  it.each(REVIEW_ENTRYPOINTS)(
    '$host $stage entry point captures configured sources at review time',
    ({ host, stage, path }) => {
      const instructions = readEntrypoint(projectDirectory, host, path);
      expect(instructions).toContain(RESOLVER_COMMAND);

      for (const key of ['principles', 'personas', 'surfaces'] as const) {
        writeFileSync(
          nodePath.join(projectDirectory, 'knowledge', `${key}.md`),
          `# ${key}: ${host}/${stage}\n`,
        );
      }

      const result = spawnSync(
        'bun',
        [nodePath.join(projectDirectory, RESOLVER_COMMAND), projectDirectory],
        { encoding: 'utf8' },
      );
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual(
        ['principles', 'personas', 'surfaces'].map(key =>
          expect.objectContaining({
            key,
            configured: true,
            content: `# ${key}: ${host}/${stage}\n`,
          }),
        ),
      );
    },
  );
});
