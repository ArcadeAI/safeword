import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { generateClaudePluginAssets } from '../../src/claude-plugin/catalogue.js';
import { generateCodexPluginAssets } from '../../src/codex-plugin/catalogue.js';
import { writePortableCoreCatalogue } from '../../src/host-contract/portable-core.js';
import { reconcile } from '../../src/reconcile.js';
import { qualityReviewRubric } from '../../src/review/review-rubric.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { TESTING_CORE_LAYOUT } from '../../src/schema-layouts.js';
import { testingCoreBlock } from '../../src/testing/shared-core.js';
import { detectProjectType } from '../../src/utils/project-detector.js';
import { VERSION } from '../../src/version.js';

const roots: string[] = [];
const repo = nodePath.resolve(import.meta.dirname, '../../../..');
function matchingContent(
  assets: readonly { relativePath: string; content: string }[],
  predicate: (path: string) => boolean,
): string {
  const asset = assets.find(candidate => predicate(candidate.relativePath));
  assert.ok(asset, 'Required real producer asset is absent');
  return asset.content;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// Integration: real schema -> raw templates -> installed bytes, then native renderer.
// A plugin-only implementation cannot satisfy the first assertion.
it('delivers the current essential block through raw project reconciliation and native projection', async () => {
  const cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-testing-core-'));
  roots.push(cwd);
  const manifest = { name: 'owned-core-fixture', private: true, type: 'module' };
  writeFileSync(nodePath.join(cwd, 'package.json'), JSON.stringify(manifest));
  writeFileSync(nodePath.join(cwd, 'clamp.js'), 'export const clamp = value => value;\n');
  await reconcile(SAFEWORD_SCHEMA, 'install', {
    cwd,
    projectType: detectProjectType(manifest, cwd),
    developmentDeps: {},
    productionDeps: {},
    isGitRepo: false,
    languages: { javascript: true, python: false, golang: false, rust: false, sql: false },
  });
  for (const relative of ['.claude/skills/testing/SKILL.md', '.safeword/skills/testing/SKILL.md']) {
    const content = readFileSync(nodePath.join(cwd, relative), 'utf8');
    expect(content, 'ESSENTIAL_CORE_MISSING').toContain(testingCoreBlock());
  }
  const assets = generateCodexPluginAssets(
    nodePath.join(repo, 'packages/cli/templates/skills'),
    VERSION,
  );
  const body = assets.find(asset => asset.relativePath === 'internal/testing/SKILL.md');
  assert.ok(body, 'Missing existing native testing resource');
  assert.ok(body.content.includes(testingCoreBlock()), 'ESSENTIAL_CORE_MISSING');
  const templatesRoot = nodePath.join(repo, 'packages/cli/templates');
  const claude = generateClaudePluginAssets({
    cliBundle: 'console.log("owned producer fixture");',
    sourceRoot: nodePath.join(repo, 'packages/cli/src'),
    templatesRoot,
    version: VERSION,
  });
  const portable = nodePath.join(cwd, 'portable');
  writePortableCoreCatalogue(templatesRoot, portable, VERSION);
  expect(TESTING_CORE_LAYOUT.templates).toEqual([
    'skills/testing/SKILL.md',
    'skills/quality-review/SKILL.md',
    'skills/tdd-review/SKILL.md',
    'skills/debug/SKILL.md',
    'skills/refactor/SKILL.md',
    'skills/bdd/TDD.md',
    'guides/testing-guide.md',
  ]);
  for (const template of TESTING_CORE_LAYOUT.templates) {
    const canonical = readFileSync(nodePath.join(templatesRoot, template), 'utf8');
    expect(canonical.split(testingCoreBlock())).toHaveLength(2);
    expect(readFileSync(nodePath.join(portable, 'templates', template), 'utf8')).toBe(canonical);
    const path = template.startsWith('guides/') ? `resources/${template}` : template;
    expect(matchingContent(claude, candidate => candidate === path)).toContain(testingCoreBlock());
    if (!template.startsWith('skills/')) continue;
    const [, name, filename] = template.split('/', 3);
    const suffix = filename === 'SKILL.md' ? filename : `references/${filename}`;
    expect(
      matchingContent(assets, candidate => candidate.endsWith(`/${name}/${suffix}`)),
    ).toContain(testingCoreBlock());
    expect(readFileSync(nodePath.join(portable, 'skills', name ?? '', suffix), 'utf8')).toContain(
      testingCoreBlock(),
    );
    const installed = Object.entries(SAFEWORD_SCHEMA.ownedFiles).filter(
      ([, definition]) => definition.template === template,
    );
    expect(installed.length).toBeGreaterThan(0);
    for (const [installedPath] of installed)
      expect(readFileSync(nodePath.join(cwd, installedPath), 'utf8')).toContain(testingCoreBlock());
  }
  expect(testingCoreBlock(), 'SHARED_PARTITION_RULE_MISSING').toContain(
    'Before writing or reviewing tests, identify the distinct behavior partitions and choose a representative for each, including validation failures for individual inputs or input combinations. For bounded inputs, include a value strictly inside the valid range when one exists, boundary values, and out-of-range values, whether accepted or rejected. Check that the resulting tests cover those choices before reporting completion.',
  );
  expect(testingCoreBlock()).not.toContain('Cover distinct behavior partitions.');
  expect(qualityReviewRubric()).toContain(testingCoreBlock());
});
