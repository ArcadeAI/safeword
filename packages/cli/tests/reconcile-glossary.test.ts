/**
 * Reconcile/scaffold tests for the project glossary (ticket YR6C49, Task 4).
 *
 * Mirrors reconcile-configured-paths.test.ts (K7N2QM). Covers Rule 5:
 * scaffold the default `.safeword-project/glossary.md` from the template
 * when absent, never overwrite existing content, and skip the default
 * scaffold uniformly when `paths.glossary` is configured (configKey gate).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const DEFAULT_PROJECT_TYPE = {
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
};

const DEFAULT_LANGUAGES = {
  javascript: true,
  python: false,
  golang: false,
  rust: false,
  sql: false,
};

const GLOSSARY_DEFAULT_PATH = '.safeword-project/glossary.md';

describe('Reconcile — glossary scaffold + ownership (YR6C49)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-reconcile-yr6c49-'));
    writeFileSync(
      nodePath.join(cwd, 'package.json'),
      JSON.stringify({ name: 'test-project', version: '1.0.0' }, undefined, 2),
    );
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  function makeContext(): {
    cwd: string;
    projectType: typeof DEFAULT_PROJECT_TYPE;
    developmentDeps: Record<string, string>;
    productionDeps: Record<string, string>;
    isGitRepo: boolean;
    languages: typeof DEFAULT_LANGUAGES;
  } {
    return {
      cwd,
      projectType: { ...DEFAULT_PROJECT_TYPE },
      developmentDeps: {},
      productionDeps: {},
      isGitRepo: true,
      languages: { ...DEFAULT_LANGUAGES },
    };
  }

  function writeOverrideConfig(glossaryPath: string): void {
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ installedPacks: [], paths: { glossary: glossaryPath } }, undefined, 2),
    );
  }

  it('R5.1: scaffolds the default glossary when absent', async () => {
    const { reconcile } = await import('../src/reconcile.js');
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

    await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

    // Fresh repo (no namespace dir) → resolved root is .project/ (N9S5XG).
    const freshDefaultPath = '.project/glossary.md';
    expect(existsSync(nodePath.join(cwd, freshDefaultPath))).toBe(true);
    const content = readFileSync(nodePath.join(cwd, freshDefaultPath), 'utf8');
    expect(content).toContain('Definition');
  });

  it('R5.2: does not overwrite an existing glossary', async () => {
    const { reconcile } = await import('../src/reconcile.js');
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

    const userContent = '## Tool\n**Definition:** My own words.\n';
    mkdirSync(nodePath.join(cwd, '.safeword-project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, GLOSSARY_DEFAULT_PATH), userContent);

    await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

    const after = readFileSync(nodePath.join(cwd, GLOSSARY_DEFAULT_PATH), 'utf8');
    expect(after).toBe(userContent);
  });

  it('R5.3: skips default scaffold when paths.glossary is configured', async () => {
    const { reconcile } = await import('../src/reconcile.js');
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

    writeOverrideConfig('docs/glossary.md');

    await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

    expect(existsSync(nodePath.join(cwd, GLOSSARY_DEFAULT_PATH))).toBe(false);
  });
});
