import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { writeClaudePluginCatalogue } from '../../src/claude-plugin/catalogue.js';
import { writePortableCoreCatalogue } from '../../src/host-contract/portable-core.js';
import { reconcile } from '../../src/reconcile.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { detectProjectType } from '../../src/utils/project-detector.js';
import { VERSION } from '../../src/version.js';
import { runWorkflowGenerator } from '../helpers/codex-workflow-runtime.js';
import { createContractRepoFixture } from '../helpers/contract-repo-fixture.js';

const fixture = { source: '', assets: [] as { file: string; project?: string; plugin?: string }[] };

beforeAll(async () => {
  fixture.source = realpathSync(createContractRepoFixture());
  const source = fixture.source;
  const generated = runWorkflowGenerator(source, path.join(source, 'unused-profile'), false);
  expect(generated.status, generated.output).toBe(0);
  fixture.assets.push(
    { file: path.join(source, 'packages/cli/templates/skills/testing/SKILL.md'), project: source },
    { file: path.join(source, 'packages/cli/codex-plugin/internal/testing/SKILL.md') },
  );
  const templatesRoot = path.join(source, 'packages/cli/templates');
  for (const host of ['claude', 'portable'] as const) {
    const bundle = path.join(source, `navigation-${host}`);
    if (host === 'claude')
      writeClaudePluginCatalogue(
        {
          templatesRoot,
          sourceRoot: path.join(source, 'packages/cli/src'),
          version: VERSION,
          cliBundle: '/* unused */',
        },
        bundle,
      );
    else writePortableCoreCatalogue(templatesRoot, bundle, VERSION);
    fixture.assets.push({ file: path.join(bundle, 'skills/testing/SKILL.md'), plugin: bundle });
  }
  const cwd = path.join(source, 'navigation-project');
  mkdirSync(cwd);
  const manifest = { name: 'navigation-control', private: true, type: 'module' };
  writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(manifest));
  await reconcile(SAFEWORD_SCHEMA, 'install', {
    cwd,
    projectType: detectProjectType(manifest, cwd),
    developmentDeps: {},
    productionDeps: {},
    isGitRepo: false,
    languages: { javascript: true, python: false, golang: false, rust: false, sql: false },
  });
  for (const relative of ['.claude/skills/testing/SKILL.md', '.safeword/skills/testing/SKILL.md'])
    fixture.assets.push({ file: path.join(cwd, relative), project: cwd });
}, 90_000);

afterAll(() => {
  if (fixture.source) rmSync(path.dirname(fixture.source), { recursive: true, force: true });
});

function resolveRules(file: string, reference: string): string {
  const rulesPath = reference.split('#', 1)[0] ?? '';
  return path.resolve(path.dirname(file), rulesPath || path.basename(file));
}

function checkNavigation({
  file,
  project,
  plugin,
}: {
  file: string;
  project?: string;
  plugin?: string;
}): void {
  const text = readFileSync(file, 'utf8');
  const afterHeading =
    text.split('### Wiring Tests — Mock Only the Process Boundary\n', 2)[1] ?? '';
  const section = afterHeading.split(/^#{1,3} /mu, 1)[0] ?? '';
  expect(
    section.replaceAll(/^---\s*$/gmu, '').trim(),
    `WIRING_TESTS_NAVIGATION_MISSING: ${file}`,
  ).not.toBe('');
  const rulesReference = /\]\(([^)]*#essential-testing-rules)\)/u.exec(section)?.[1] ?? '';
  expect(rulesReference, `WIRING_TESTS_RULES_MISSING: ${file}`).not.toBe('');
  const resolvedRules = resolveRules(file, rulesReference);
  expect(realpathSync(resolvedRules), `WIRING_TESTS_RULES_UNREACHABLE: ${file}`).toBe(
    realpathSync(file),
  );
  expect(text).toMatch(/^## Essential testing rules\s*$/imu);
  const reference = /`([^`]*testing-guide\.md)`/u.exec(section)?.[1] ?? '';
  expect(reference, `WIRING_TESTS_GUIDE_MISSING: ${file}`).not.toBe('');
  const root = Object.hasOwn(SAFEWORD_SCHEMA.ownedFiles, reference) ? project : path.dirname(file);
  const guide = path.resolve(
    root ?? path.dirname(file),
    reference.replace('"${CLAUDE_PLUGIN_ROOT}"', () => plugin ?? ''),
  );
  expect(existsSync(guide), `WIRING_TESTS_GUIDE_UNREACHABLE: ${guide}`).toBe(true);
  const examples = readFileSync(guide, 'utf8');
  expect(examples).toContain('## Optional worked examples');
  expect(examples).toContain('### Wiring Tests — Mock Only the Process Boundary');
  expect(section).toContain('Optional worked examples');
  expect(section).toContain('Wiring Tests — Mock Only the Process Boundary');
}

it('makes the wiring section navigate to the unchanged rules and installed optional examples', () => {
  expect(fixture.assets).toHaveLength(6);
  for (const asset of fixture.assets) checkNavigation(asset);
});
