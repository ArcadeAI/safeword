import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateCodexPluginAssets } from '../../src/codex-plugin/catalogue.js';
import { reconcile } from '../../src/reconcile.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const TEMPLATES = nodePath.join(REPO_ROOT, 'packages/cli/templates');
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

function templateContent(template: string): string {
  return readFileSync(nodePath.join(TEMPLATES, template), 'utf8');
}

const CLAUDE_REVIEW_ENTRYPOINTS = Object.entries(SAFEWORD_SCHEMA.ownedFiles)
  .filter(([path, definition]) => {
    const template = definition.template;
    return (
      path.startsWith('.claude/skills/') &&
      template !== undefined &&
      templateContent(template).includes(RESOLVER_COMMAND)
    );
  })
  .flatMap(([path, definition]) =>
    definition.template === undefined
      ? []
      : [{ host: 'claude' as const, stage: definition.template, path }],
  );

const CURSOR_REVIEW_ENTRYPOINTS = CLAUDE_REVIEW_ENTRYPOINTS.map(claude => {
  const skill = claude.path.split('/', 3)[2];
  const commandPath = `.cursor/commands/${skill}.md`;
  if (
    claude.stage.endsWith('/SKILL.md') &&
    Object.hasOwn(SAFEWORD_SCHEMA.ownedFiles, commandPath)
  ) {
    return { host: 'cursor' as const, stage: claude.stage, path: commandPath };
  }
  const matches = Object.entries(SAFEWORD_SCHEMA.ownedFiles).filter(([path, definition]) => {
    const template = definition.template;
    if (!path.startsWith('.cursor/') || template === undefined) return false;
    const content = templateContent(template);
    return content.includes(claude.path);
  });
  expect(matches, `Cursor production catalogue row for ${claude.stage}`).toHaveLength(1);
  const match = matches[0];
  if (match === undefined) throw new Error(`missing Cursor row for ${claude.stage}`);
  return { host: 'cursor' as const, stage: claude.stage, path: match[0] };
});

const GENERATED_CODEX_ASSETS = generateCodexPluginAssets(nodePath.join(TEMPLATES, 'skills'));
const CODEX_REVIEW_ENTRYPOINTS = GENERATED_CODEX_ASSETS.filter(asset =>
  asset.content.includes(RESOLVER_COMMAND),
).map(asset => {
  const canonicalSuffix = asset.relativePath
    .replace(/^skills\//u, 'skills/')
    .replace('/references/', '/');
  const canonical = CLAUDE_REVIEW_ENTRYPOINTS.find(row => row.stage === canonicalSuffix);
  expect(canonical, `canonical source for generated ${asset.relativePath}`).toBeDefined();
  if (canonical === undefined)
    throw new Error(`missing canonical source for ${asset.relativePath}`);
  return { host: 'codex' as const, stage: canonical.stage, path: asset.relativePath };
});

const REVIEW_ENTRYPOINTS = [
  ...CLAUDE_REVIEW_ENTRYPOINTS,
  ...CURSOR_REVIEW_ENTRYPOINTS,
  ...CODEX_REVIEW_ENTRYPOINTS,
];

function readEntrypoint(root: string, path: string): string {
  const absolutePath = nodePath.join(root, path);
  const entrypoint = readFileSync(absolutePath, 'utf8');
  if (entrypoint.includes(RESOLVER_COMMAND)) return entrypoint;

  const reference = /@?(\.claude\/skills\/[\w./-]+)/u.exec(entrypoint)?.[1];
  expect(reference, `entry point ${path} must reference its installed procedure`).toBeDefined();
  return readFileSync(nodePath.join(root, reference ?? ''), 'utf8');
}

function followResolverInstruction(projectDirectory: string, instructions: string) {
  const command = /bun\s+(\.safeword\/hooks\/resolve-project-knowledge\.ts)/u.exec(
    instructions,
  )?.[1];
  expect(command, 'review procedure must tell the host how to resolve current knowledge').toBe(
    RESOLVER_COMMAND,
  );
  return spawnSync('bun', [nodePath.join(projectDirectory, command ?? ''), projectDirectory], {
    encoding: 'utf8',
  });
}

describe('installed review entry points resolve current project knowledge', () => {
  let projectDirectory: string;
  let codexDistribution: string;

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

    codexDistribution = nodePath.join(projectDirectory, '.generated-codex-plugin');
    for (const asset of GENERATED_CODEX_ASSETS) {
      const path = nodePath.join(codexDistribution, asset.relativePath);
      mkdirSync(nodePath.dirname(path), { recursive: true });
      writeFileSync(path, asset.content);
    }
  });

  afterAll(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  it('covers every host and review stage', () => {
    expect(REVIEW_ENTRYPOINTS).toHaveLength(12);
    expect(Object.groupBy(REVIEW_ENTRYPOINTS, row => row.host)).toMatchObject({
      claude: expect.arrayContaining(CLAUDE_REVIEW_ENTRYPOINTS),
      cursor: expect.arrayContaining(CURSOR_REVIEW_ENTRYPOINTS),
      codex: expect.arrayContaining(CODEX_REVIEW_ENTRYPOINTS),
    });
    expect(new Set(REVIEW_ENTRYPOINTS.map(row => row.stage))).toHaveLength(4);
  });

  it.each(REVIEW_ENTRYPOINTS)(
    '$host $stage procedure resolves configured sources when its instruction is followed',
    ({ host, stage, path }) => {
      const artifactRoot = host === 'codex' ? codexDistribution : projectDirectory;
      const instructions = readEntrypoint(artifactRoot, path);
      expect(instructions).toContain(RESOLVER_COMMAND);

      for (const key of ['principles', 'personas', 'surfaces'] as const) {
        writeFileSync(
          nodePath.join(projectDirectory, 'knowledge', `${key}.md`),
          `# ${key}: ${host}/${stage}\n`,
        );
      }

      const result = followResolverInstruction(projectDirectory, instructions);
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
