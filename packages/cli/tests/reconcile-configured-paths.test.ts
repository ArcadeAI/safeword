/**
 * Reconcile tests for configurable-paths suppression (ticket K7N2QM).
 *
 * Covers Rule 3 scenarios: when `paths.personas` is set in
 * `.safeword/config.json`, reconcile must skip the
 * `.safeword-project/personas.md` managedFiles entry uniformly across
 * install and uninstall-full modes. The mechanism is an optional
 * `configKey` field on `ManagedFileDefinition`.
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

const PERSONAS_DEFAULT_PATH = '.safeword-project/personas.md';

describe('Reconcile — configured-paths suppression (K7N2QM)', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(nodePath.join(tmpdir(), 'safeword-reconcile-k7n2qm-'));
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

  function writeOverrideConfig(personasPath: string): void {
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ installedPacks: [], paths: { personas: personasPath } }, undefined, 2),
    );
  }

  it('R3.2: skips default scaffold when paths.personas is configured', async () => {
    const { reconcile } = await import('../src/reconcile.js');
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

    writeOverrideConfig('docs/personas.md');

    await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

    expect(existsSync(nodePath.join(cwd, PERSONAS_DEFAULT_PATH))).toBe(false);
  });

  it('R3.3: leaves pre-existing default file untouched when override is set', async () => {
    const { reconcile } = await import('../src/reconcile.js');
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

    // Legacy default-location file with user-authored content.
    const userContent = '## My Persona (MP)\n**Role:** Owns the world.\n';
    mkdirSync(nodePath.join(cwd, '.safeword-project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, PERSONAS_DEFAULT_PATH), userContent);
    writeOverrideConfig('docs/personas.md');

    await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

    const after = readFileSync(nodePath.join(cwd, PERSONAS_DEFAULT_PATH), 'utf8');
    expect(after).toBe(userContent);
  });

  it('R3.4: `reset` with override set does not touch the configured-path file', async () => {
    const { reconcile } = await import('../src/reconcile.js');
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

    const userContent = '## My Persona (MP)\n**Role:** Owns the world.\n';
    mkdirSync(nodePath.join(cwd, 'docs'), { recursive: true });
    writeFileSync(nodePath.join(cwd, 'docs/personas.md'), userContent);
    writeOverrideConfig('docs/personas.md');

    await reconcile(SAFEWORD_SCHEMA, 'uninstall', makeContext());

    const after = readFileSync(nodePath.join(cwd, 'docs/personas.md'), 'utf8');
    expect(after).toBe(userContent);
  });

  it('R3.5: `reset --full` with override set does not remove default-location file', async () => {
    const { reconcile } = await import('../src/reconcile.js');
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

    const userContent = '## Legacy Persona (LP)\n**Role:** Predates the override.\n';
    mkdirSync(nodePath.join(cwd, '.safeword-project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, PERSONAS_DEFAULT_PATH), userContent);
    writeOverrideConfig('docs/personas.md');

    await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', makeContext());

    // configKey gate must apply to uninstall-full too — file survives.
    expect(existsSync(nodePath.join(cwd, PERSONAS_DEFAULT_PATH))).toBe(true);
    const after = readFileSync(nodePath.join(cwd, PERSONAS_DEFAULT_PATH), 'utf8');
    expect(after).toBe(userContent);
  });
});
