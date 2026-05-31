/**
 * Integration: install / upgrade text-patch composition.
 *
 * Pins the seam between `templates/content.ts` (the static strings) and
 * `reconcile.ts` (planner + executor) for CLAUDE.md / AGENTS.md. Both pieces
 * are unit-tested in isolation; their composition is where bugs hide:
 *
 *   - PR #77 / commit d6dce6d — template strings now end with `---\n\n` so the
 *     prepended separator does not glue to a user's first heading line.
 *   - PR #79 / commit a304af8 — `executeTextPatch` heals legacy `\n\n---#`
 *     artifacts in place when the safeword marker is already present.
 *
 * Tests drive the real `reconcile()` entry point against a `mkdtempSync`
 * project directory, with both `'install'` and `'upgrade'` modes, and assert
 * the resulting file contents byte-for-byte where it matters.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reconcile } from '../../src/reconcile.js';
import { type ProjectContext, SAFEWORD_SCHEMA } from '../../src/schema.js';

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

describe('Integration: install / upgrade text-patch composition', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-install-upgrade-'));
    writeFileSync(
      nodePath.join(projectDirectory, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' }, undefined, 2),
    );
  });

  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  function makeContext(): ProjectContext {
    return {
      cwd: projectDirectory,
      projectType: DEFAULT_PROJECT_TYPE,
      developmentDeps: {},
      productionDeps: {},
      isGitRepo: true,
      languages: { javascript: true, python: false, golang: false, rust: false, sql: false },
    };
  }

  function read(file: string): string {
    return readFileSync(nodePath.join(projectDirectory, file), 'utf8');
  }

  function seed(file: string, content: string): void {
    writeFileSync(nodePath.join(projectDirectory, file), content);
  }

  describe('AGENTS.md', () => {
    it('install creates AGENTS.md with safeword preamble when absent', async () => {
      await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

      expect(existsSync(nodePath.join(projectDirectory, 'AGENTS.md'))).toBe(true);
      const content = read('AGENTS.md');
      expect(content).toContain('.safeword/SAFEWORD.md');
      expect(content).not.toMatch(/---#/);
    });

    it('install over a user heading preserves the `\\n---\\n\\n#` boundary', async () => {
      seed('AGENTS.md', '# AGENTS.md — my project\n\nSome existing notes.\n');

      await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

      const content = read('AGENTS.md');
      expect(content).not.toMatch(/---#/);
      expect(content).toMatch(/\n---\n\n# AGENTS\.md/);
      expect(content).toContain('Some existing notes.');
    });

    it('upgrade heals legacy `---#` artifact and is idempotent', async () => {
      seed(
        'AGENTS.md',
        '**⚠️ ALWAYS READ FIRST:** `.safeword/SAFEWORD.md`\n\n---# AGENTS.md — my project\n\nSome existing notes.\n',
      );

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', makeContext());

      const healed = read('AGENTS.md');
      expect(healed).not.toMatch(/---#/);
      expect(healed).toMatch(/\n---\n\n# AGENTS\.md/);

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', makeContext());
      expect(read('AGENTS.md')).toBe(healed);
    });
  });

  describe('CLAUDE.md', () => {
    it('install creates CLAUDE.md with safeword preamble when absent', async () => {
      await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

      expect(existsSync(nodePath.join(projectDirectory, 'CLAUDE.md'))).toBe(true);
      const content = read('CLAUDE.md');
      expect(content).toContain('@./.safeword/SAFEWORD.md');
      expect(content).not.toMatch(/---#/);
    });

    it('install over a user heading preserves the `\\n---\\n\\n#` boundary', async () => {
      seed('CLAUDE.md', '# CLAUDE.md — my project\n\nSome existing notes.\n');

      await reconcile(SAFEWORD_SCHEMA, 'install', makeContext());

      const content = read('CLAUDE.md');
      expect(content).not.toMatch(/---#/);
      expect(content).toMatch(/\n---\n\n# CLAUDE\.md/);
      expect(content).toContain('Some existing notes.');
    });

    it('upgrade heals legacy `---#` artifact and is idempotent', async () => {
      seed(
        'CLAUDE.md',
        '@./.safeword/SAFEWORD.md\n\n---# CLAUDE.md — my project\n\nSome existing notes.\n',
      );

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', makeContext());

      const healed = read('CLAUDE.md');
      expect(healed).not.toMatch(/---#/);
      expect(healed).toMatch(/\n---\n\n# CLAUDE\.md/);

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', makeContext());
      expect(read('CLAUDE.md')).toBe(healed);
    });
  });
});
