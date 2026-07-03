/**
 * Reconcile tests for configurable-paths suppression (ticket K7N2QM).
 *
 * Covers Rule 3 scenarios: when a project-knowledge `paths.*` override is set
 * in `.safeword/config.json`, reconcile must skip that managedFiles default
 * scaffold uniformly across install and uninstall-full modes. The mechanism is
 * an optional `configKey` field on `ManagedFileDefinition`.
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
  existingCucumberHarness: undefined,
  scaffoldBddLane: true,
};

const DEFAULT_LANGUAGES = {
  javascript: true,
  python: false,
  golang: false,
  rust: false,
  sql: false,
};

const PERSONAS_DEFAULT_PATH = '.safeword-project/personas.md';
const SURFACES_DEFAULT_PATH = '.project/surfaces.md';

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

  function writeSurfacesOverrideConfig(surfacesPath: string): void {
    mkdirSync(nodePath.join(cwd, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(cwd, '.safeword', 'config.json'),
      JSON.stringify({ installedPacks: [], paths: { surfaces: surfacesPath } }, undefined, 2),
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

  it('R4.2: skips default surfaces scaffold when paths.surfaces is configured', async () => {
    const { reconcile } = await import('../src/reconcile.js');
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

    writeSurfacesOverrideConfig('docs/surfaces.md');

    await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

    expect(existsSync(nodePath.join(cwd, SURFACES_DEFAULT_PATH))).toBe(false);
  });

  it('R4.3: leaves pre-existing default surfaces file untouched when override is set', async () => {
    const { reconcile } = await import('../src/reconcile.js');
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

    const userContent = '# Surfaces\n\n## Setup CLI\n\n**Kind:** CLI\n';
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, SURFACES_DEFAULT_PATH), userContent);
    writeSurfacesOverrideConfig('docs/surfaces.md');

    await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

    expect(readFileSync(nodePath.join(cwd, SURFACES_DEFAULT_PATH), 'utf8')).toBe(userContent);
  });

  it('R4.5: `reset --full` with surfaces override set does not remove default-location file', async () => {
    const { reconcile } = await import('../src/reconcile.js');
    const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

    const userContent =
      '# Surfaces\n\n## Generated customer install\n\n**Kind:** Generated config\n';
    mkdirSync(nodePath.join(cwd, '.project'), { recursive: true });
    writeFileSync(nodePath.join(cwd, SURFACES_DEFAULT_PATH), userContent);
    writeSurfacesOverrideConfig('docs/surfaces.md');

    await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', makeContext());

    expect(readFileSync(nodePath.join(cwd, SURFACES_DEFAULT_PATH), 'utf8')).toBe(userContent);
  });
});
