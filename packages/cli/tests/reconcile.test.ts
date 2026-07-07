/**
 * Test Suite: Reconciliation Engine
 *
 * Tests the reconcile() function that computes and executes plans
 * based on SAFEWORD_SCHEMA and the current project state.
 *
 * TDD RED phase - these tests should FAIL until src/reconcile.ts is implemented.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ESLINT_PACKAGE, JITI_PACKAGE } from '../src/packs/typescript/files.js';

// This import will fail until reconcile.ts is created (RED phase)
// import { reconcile, computePackagesToInstall } from '../src/reconcile.js';
// import { SAFEWORD_SCHEMA } from '../src/schema.js';

/**
 * Default project type fixture with all flags false.
 * Spread with overrides in tests: { ...DEFAULT_PROJECT_TYPE, astro: true }
 */
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
  hasJsSource: true, // default reconcile fixture is a JS project (gets knip + dependency-cruiser)
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

const GHERKIN_LINT_SCRIPT = 'safeword lint-gherkin';

describe('Reconcile - Reconciliation Engine', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-reconcile-test-'));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  // Helper to create a minimal package.json
  /**
   *
   * @param content
   */
  function createPackageJson(content: Record<string, unknown> = {}) {
    const defaultContent = {
      name: 'test-project',
      version: '1.0.0',
      ...content,
    };
    writeFileSync(
      nodePath.join(temporaryDirectory, 'package.json'),
      JSON.stringify(defaultContent, undefined, 2),
    );
    return defaultContent;
  }

  // Write .safeword/config.json with a custom paths.projectRoot (issue #273 tests).
  function writeProjectRootConfig(projectRoot: string) {
    mkdirSync(nodePath.join(temporaryDirectory, '.safeword'), { recursive: true });
    writeFileSync(
      nodePath.join(temporaryDirectory, '.safeword', 'config.json'),
      JSON.stringify({ paths: { projectRoot } }),
    );
  }

  // Helper to create project context
  /**
   *
   * @param overrides
   */
  function createContext(overrides: Record<string, unknown> = {}) {
    return {
      cwd: temporaryDirectory,
      projectType: {
        ...DEFAULT_PROJECT_TYPE,
        ...(overrides.projectType as Record<string, unknown>),
      },
      developmentDeps: (overrides.developmentDeps as Record<string, string>) ?? {},
      productionDeps: (overrides.productionDeps as Record<string, string>) ?? {},
      isGitRepo: (overrides.isGitRepo as boolean) ?? true,
      // Default to JavaScript project for existing tests
      languages: (overrides.languages as {
        javascript: boolean;
        python: boolean;
        golang: boolean;
        rust: boolean;
        sql: boolean;
      }) ?? {
        javascript: true,
        python: false,
        golang: false,
        rust: false,
        sql: false,
      },
    };
  }

  function readCodexConfigTemplate(): string {
    return readFileSync(
      nodePath.resolve(import.meta.dirname, '../templates/codex/config.toml'),
      'utf8',
    );
  }

  function readLegacyCodexConfigWithoutPromptTimestamp(): string {
    const template = readCodexConfigTemplate();
    const promptStart = template.indexOf('\n[[hooks.UserPromptSubmit]]');
    const preToolStart = template.indexOf('\n[[hooks.PreToolUse]]');
    if (promptStart === -1 || preToolStart === -1 || preToolStart <= promptStart) {
      throw new Error('Codex config template no longer has the expected hook block order');
    }
    return template.slice(0, promptStart) + template.slice(preToolStart);
  }

  describe('reconcile() - install mode', () => {
    it('should create all owned directories', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      expect(result.applied).toBe(true);

      // Verify all ownedDirs were created
      for (const dir of SAFEWORD_SCHEMA.ownedDirs) {
        expect(existsSync(nodePath.join(temporaryDirectory, dir))).toBe(true);
      }
    });

    it('should create all shared directories', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      for (const dir of SAFEWORD_SCHEMA.sharedDirs) {
        expect(existsSync(nodePath.join(temporaryDirectory, dir))).toBe(true);
      }
    });

    it('should create all preserved directories', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Fresh repo → namespace entries land at .project/ (N9S5XG translation).
      for (const dir of SAFEWORD_SCHEMA.preservedDirs) {
        const resolved = dir.replace(/^\.safeword-project/, '.project');
        expect(existsSync(nodePath.join(temporaryDirectory, resolved)), resolved).toBe(true);
      }
    });

    it('should write all owned files', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Check a sample of owned files exist
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/version'))).toBe(true);

      // created should include all owned files
      expect(result.created.length).toBeGreaterThan(0);
    });

    it('should work in non-git repos', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext({ isGitRepo: false });

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // .safeword should still be created
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/hooks'))).toBe(true);
    });

    it('should create managed files when missing', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // managedFiles should be created
      expect(existsSync(nodePath.join(temporaryDirectory, 'eslint.config.mjs'))).toBe(true);
      expect(existsSync(nodePath.join(temporaryDirectory, '.prettierrc'))).toBe(true);
    });

    it('does not write .prettierrc or .safeword/.prettierrc when project already has a prettier config', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      // Customer already uses prettier via a JS-module config we can't merge into.
      writeFileSync(
        nodePath.join(temporaryDirectory, 'prettier.config.mjs'),
        'export default { singleQuote: false };\n',
      );

      const ctx = createContext({ projectType: { existingPrettierConfig: true } });

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Safeword must not drop a competing .prettierrc — it would shadow the module config.
      expect(existsSync(nodePath.join(temporaryDirectory, '.prettierrc'))).toBe(false);
      // ...nor its own hook config; the lint hook formats against .safeword/.prettierrc.
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/.prettierrc'))).toBe(false);
      // Customer's config left untouched.
      expect(existsSync(nodePath.join(temporaryDirectory, 'prettier.config.mjs'))).toBe(true);
    });

    it('leaves a customer bare .prettierrc resolved config unchanged (no churning default-fill)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      // A bare .prettierrc that sets only one option. Safeword must NOT fill in
      // its own style defaults (singleQuote, semi, trailingComma, …) or inject
      // plugins — either changes the resolved style and reformats the customer's
      // files on the next prettier run (ticket 9C2CFX; revisits 8BNSTE's call
      // that the additive merge was "safe").
      writeFileSync(
        nodePath.join(temporaryDirectory, '.prettierrc'),
        `${JSON.stringify({ printWidth: 120 }, undefined, 2)}\n`,
      );

      const ctx = createContext({ projectType: { existingPrettierConfig: true } });

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const resolved = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, '.prettierrc'), 'utf8'),
      );
      expect(resolved).toEqual({ printWidth: 120 });
    });

    it('excludes every safeword-owned dir from an existing biome.json (not just .safeword)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const { SAFEWORD_IGNORE_DIRS } = await import('../src/owned-paths.js');

      createPackageJson();
      writeFileSync(
        nodePath.join(temporaryDirectory, 'biome.json'),
        `${JSON.stringify({ files: { includes: ['**'] } }, undefined, 2)}\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      const biome = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, 'biome.json'), 'utf8'),
      ) as { files: { includes: string[] } };
      // Every safeword-owned dir is excluded so the customer's biome never churns
      // safeword's files (ticket EYRK34) — sourced from the one SAFEWORD_IGNORE_DIRS list.
      for (const dir of SAFEWORD_IGNORE_DIRS) {
        expect(biome.files.includes).toContain(`!${dir}`);
      }
    });

    it('excludes a custom paths.projectRoot from an existing biome.json (#273)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeProjectRootConfig('team-ns');
      writeFileSync(
        nodePath.join(temporaryDirectory, 'biome.json'),
        `${JSON.stringify({ files: { includes: ['**'] } }, undefined, 2)}\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      const biome = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, 'biome.json'), 'utf8'),
      ) as { files: { includes: string[] } };
      expect(biome.files.includes).toContain('!team-ns'); // custom root excluded
      expect(biome.files.includes).toContain('!.safeword'); // base dirs preserved
    });

    it('excludes a custom paths.projectRoot from an existing dprint.json (#273)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeProjectRootConfig('team-ns');
      writeFileSync(
        nodePath.join(temporaryDirectory, 'dprint.json'),
        `${JSON.stringify({ excludes: ['node_modules'] }, undefined, 2)}\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      const dprint = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, 'dprint.json'), 'utf8'),
      ) as { excludes: string[] };
      expect(dprint.excludes).toContain('team-ns/**'); // custom root excluded
      expect(dprint.excludes).toContain('.safeword/**'); // base dirs preserved
    });

    it('ignores a custom paths.projectRoot in an existing .markdownlint-cli2.jsonc (#273)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeProjectRootConfig('team-ns');
      writeFileSync(
        nodePath.join(temporaryDirectory, '.markdownlint-cli2.jsonc'),
        `${JSON.stringify({ config: { default: true }, ignores: ['dist/**'] }, undefined, 2)}\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      const cli2 = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, '.markdownlint-cli2.jsonc'), 'utf8'),
      ) as { ignores: string[] };
      expect(cli2.ignores).toContain('**/team-ns/**'); // custom root, leading-globstar form
      expect(cli2.ignores).toContain('**/.safeword/**'); // base dirs preserved
    });

    it('adds a custom paths.projectRoot to knip.json ignore (#273)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeProjectRootConfig('team-ns');

      await reconcile(
        SAFEWORD_SCHEMA,
        'install',
        createContext({ projectType: { hasJsSource: true } }),
      );

      const knip = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, 'knip.json'), 'utf8'),
      ) as { ignore: string[] };
      expect(knip.ignore).toContain('team-ns/**'); // custom root ignored by knip
      expect(knip.ignore).toContain('.project/**'); // well-known roots preserved
    });

    it('removes a custom paths.projectRoot from dprint.json on uninstall (#273 symmetry)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      // Use the real context builder: it resolves namespaceRoot up front (the CLI
      // does this before uninstall removes .safeword/config.json), which is what
      // lets unmerge clean up the custom root rather than orphan it.
      const { createProjectContext } = await import('../src/utils/context.js');

      createPackageJson();
      writeProjectRootConfig('team-ns');
      writeFileSync(
        nodePath.join(temporaryDirectory, 'dprint.json'),
        `${JSON.stringify({ excludes: ['node_modules'] }, undefined, 2)}\n`,
      );

      const dprintPath = nodePath.join(temporaryDirectory, 'dprint.json');
      const excludesAfter = (): string[] =>
        (JSON.parse(readFileSync(dprintPath, 'utf8')) as { excludes?: string[] }).excludes ?? [];

      await reconcile(SAFEWORD_SCHEMA, 'install', createProjectContext(temporaryDirectory));
      expect(excludesAfter()).toContain('team-ns/**'); // added on install

      await reconcile(SAFEWORD_SCHEMA, 'uninstall', createProjectContext(temporaryDirectory));
      // unmerge removes exactly what merge added — including the custom root.
      expect(excludesAfter()).not.toContain('team-ns/**');
      expect(excludesAfter()).not.toContain('.safeword/**');
      expect(excludesAfter()).toContain('node_modules'); // user entry preserved
    });

    it('SAFEWORD_IGNORE_DIRS covers every safeword-owned dot-directory the schema manages (no drift)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const { SAFEWORD_IGNORE_DIRS, computeSafewordPathPrefixes } =
        await import('../src/owned-paths.js');

      const schemaDotDirectories = computeSafewordPathPrefixes(SAFEWORD_SCHEMA)
        .filter(prefix => prefix.endsWith('/') && prefix.startsWith('.'))
        .map(prefix => prefix.slice(0, -1))
        // .husky is USER-owned — safeword only appends a marker line to hook
        // files there (ZJMZ50 boundary shims). Excluding the host's own hooks
        // from the host's own formatter would be overreach, so it is exempt
        // from the owned-dir ignore guarantee (husky's generated `.husky/_`
        // stays excluded via managedPrettierPaths).
        .filter(dir => dir !== '.husky');

      // Every dot-directory the schema actually manages must be in the single
      // ignore list, so a newly-owned dir can't silently escape the formatters'
      // excludes (the done_when's "one source" guarantee, ticket EYRK34).
      for (const dir of schemaDotDirectories) {
        expect(SAFEWORD_IGNORE_DIRS).toContain(dir);
      }
    });

    it('prettierignore excludes every safeword-owned dir on a fresh install (incl. .codex/ + wholesale .project/)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const { SAFEWORD_IGNORE_DIRS } = await import('../src/owned-paths.js');

      createPackageJson();
      writeFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'dist/\n');

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      const content = readFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'utf8');
      expect(content).toContain('dist/'); // customer content preserved
      for (const dir of SAFEWORD_IGNORE_DIRS) {
        expect(content).toContain(`${dir}/`);
      }
      // Wholesale namespace exclude — not the old per-file INDEX lines.
      expect(content).not.toContain('.project/tickets/INDEX.md');
    });

    it('prettierignore re-applies on upgrade for an existing pre-EYRK34 block (.codex/ now excluded)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      // An existing install's OLD managed block — header WITHOUT the "(owned dirs)"
      // suffix, so the new marker is absent and the broadened block re-applies.
      const oldBlock =
        '\n# Safeword - managed prettier exclusions\n.safeword/\n.cursor/\n.project/tickets/INDEX.md\n';
      writeFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), `dist/${oldBlock}`);

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', createContext());

      const content = readFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'utf8');
      expect(content).toContain('.codex/');
      expect(content).toContain('# Safeword - managed prettier exclusions (owned dirs)');
    });

    const PRETTIER_HEADER = '# Safeword - managed prettier exclusions (owned dirs)';
    const prettierDirectories = [
      '.husky/_',
      '.safeword/',
      '.claude/',
      '.cursor/',
      '.codex/',
      '.agents/',
      '.project/',
      '.safeword-project/',
    ].join('\n');
    const currentPrettierBlock = `\n${PRETTIER_HEADER}\n${prettierDirectories}\n`;
    const countHeaders = (content: string): number => content.split(PRETTIER_HEADER).length - 1;

    it('prettierignore excludes a custom paths.projectRoot on fresh install (#293)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeProjectRootConfig('team-ns');
      writeFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'dist/\n');

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      const content = readFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'utf8');
      expect(content).toContain('team-ns/'); // custom root excluded
      expect(content).toContain('dist/'); // customer content preserved
    });

    it('prettierignore re-renders in place to add a custom root on upgrade — exactly one block (#293)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeProjectRootConfig('team-ns');
      // Existing custom-root install: current block WITHOUT the custom root yet,
      // and a customer ignore line AFTER the managed block.
      writeFileSync(
        nodePath.join(temporaryDirectory, '.prettierignore'),
        `dist/${currentPrettierBlock}coverage/\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', createContext());

      const content = readFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'utf8');
      expect(content).toContain('team-ns/'); // custom root now excluded
      expect(content).toContain('dist/'); // customer content before preserved
      expect(content).toContain('coverage/'); // customer line AFTER the block preserved
      expect(countHeaders(content)).toBe(1); // re-rendered in place, not appended
    });

    it('prettierignore does not churn a default install on upgrade (#293)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'dist/\n');

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());
      const afterInstall = readFileSync(
        nodePath.join(temporaryDirectory, '.prettierignore'),
        'utf8',
      );

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', createContext());
      const afterUpgrade = readFileSync(
        nodePath.join(temporaryDirectory, '.prettierignore'),
        'utf8',
      );

      expect(afterUpgrade).toBe(afterInstall); // byte-identical — no churn, one block
      expect(countHeaders(afterUpgrade)).toBe(1);
    });

    it('prettierignore adds no bare repo-root entry for projectRoot "." (#293)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeProjectRootConfig('.');
      writeFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'dist/\n');

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      const content = readFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'utf8');
      // No bare './' or empty entry that would exclude the whole repo.
      expect(content).not.toMatch(/^\.\/$/m);
      expect(content).not.toMatch(/^\/$/m);
    });

    it('prettierignore re-render preserves a customer line after the block even if it equals an owned dir (#293)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeProjectRootConfig('team-ns');
      // Customer manually duplicated `.claude/` (an owned dir) right AFTER the block.
      writeFileSync(
        nodePath.join(temporaryDirectory, '.prettierignore'),
        `dist/${currentPrettierBlock}.claude/\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', createContext());

      const content = readFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'utf8');
      expect(content).toContain('team-ns/'); // re-rendered with the custom root
      expect(countHeaders(content)).toBe(1);
      // The block has one `.claude/`; the customer's trailing one must survive → two total.
      expect(content.split('.claude/').length - 1).toBe(2);
    });

    it('prettierignore block is removed on uninstall, customer content preserved (#293)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const { createProjectContext } = await import('../src/utils/context.js');

      createPackageJson();
      writeProjectRootConfig('team-ns');
      writeFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'dist/\n');

      await reconcile(SAFEWORD_SCHEMA, 'install', createProjectContext(temporaryDirectory));
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', createProjectContext(temporaryDirectory));

      const content = readFileSync(nodePath.join(temporaryDirectory, '.prettierignore'), 'utf8');
      expect(content).not.toContain(PRETTIER_HEADER); // managed block gone
      expect(content).not.toContain('team-ns/');
      expect(content).toContain('dist/'); // customer content preserved
    });

    it('excludes every safeword-owned dir from an existing dprint.json', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const { SAFEWORD_IGNORE_DIRS } = await import('../src/owned-paths.js');

      createPackageJson();
      writeFileSync(
        nodePath.join(temporaryDirectory, 'dprint.json'),
        `${JSON.stringify({ excludes: ['node_modules'] }, undefined, 2)}\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      const dprint = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, 'dprint.json'), 'utf8'),
      ) as { excludes: string[] };
      expect(dprint.excludes).toContain('node_modules'); // customer entry preserved
      for (const dir of SAFEWORD_IGNORE_DIRS) {
        expect(dprint.excludes).toContain(`${dir}/**`);
      }
    });

    it('excludes every safeword-owned dir from an existing .oxfmtrc.json (ignorePatterns)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const { SAFEWORD_IGNORE_DIRS } = await import('../src/owned-paths.js');

      createPackageJson();
      writeFileSync(
        nodePath.join(temporaryDirectory, '.oxfmtrc.json'),
        `${JSON.stringify({ ignorePatterns: ['build/**'] }, undefined, 2)}\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      const oxfmt = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, '.oxfmtrc.json'), 'utf8'),
      ) as { ignorePatterns: string[] };
      expect(oxfmt.ignorePatterns).toContain('build/**'); // customer entry preserved
      for (const dir of SAFEWORD_IGNORE_DIRS) {
        expect(oxfmt.ignorePatterns).toContain(`${dir}/**`);
      }
    });

    it('ignores every safeword-owned dir in an existing .markdownlint-cli2.jsonc (ticket #262)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const { SAFEWORD_IGNORE_DIRS } = await import('../src/owned-paths.js');

      createPackageJson();
      writeFileSync(
        nodePath.join(temporaryDirectory, '.markdownlint-cli2.jsonc'),
        `${JSON.stringify({ config: { default: true }, ignores: ['dist/**'] }, undefined, 2)}\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      const cli2 = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, '.markdownlint-cli2.jsonc'), 'utf8'),
      ) as { config: unknown; ignores: string[] };
      expect(cli2.ignores).toContain('dist/**'); // customer entry preserved
      expect(cli2.config).toEqual({ default: true }); // rule config untouched
      // Leading-globstar form (not a bare dir glob): lint-staged passes absolute
      // paths, and the leading globstar is required to match them.
      for (const dir of SAFEWORD_IGNORE_DIRS) {
        expect(cli2.ignores).toContain(`**/${dir}/**`);
      }
    });

    it('does not create .markdownlint-cli2.jsonc when the repo has no markdownlint config (skipIfMissing)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      expect(existsSync(nodePath.join(temporaryDirectory, '.markdownlint-cli2.jsonc'))).toBe(false);
    });

    it('removes safeword ignore globs from .markdownlint-cli2.jsonc on uninstall, preserving customer entries', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeFileSync(
        nodePath.join(temporaryDirectory, '.markdownlint-cli2.jsonc'),
        `${JSON.stringify({ ignores: ['dist/**'] }, undefined, 2)}\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'install', createContext());
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', createContext());

      const cli2 = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, '.markdownlint-cli2.jsonc'), 'utf8'),
      ) as { ignores: string[] };
      expect(cli2.ignores).toEqual(['dist/**']); // safeword globs gone, customer entry kept
    });

    it('warns (instead of silently skipping) when a jsonMerge target exists but does not parse', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      // A real-world commented .markdownlint-cli2.jsonc (JSONC). JSON.parse fails on
      // the comment, so the merge is skipped — but it must not be skipped silently.
      const commented = '{\n  // my markdownlint config\n  "ignores": ["dist/**"]\n}\n';
      writeFileSync(nodePath.join(temporaryDirectory, '.markdownlint-cli2.jsonc'), commented);

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      expect(result.warnings.some(w => w.includes('.markdownlint-cli2.jsonc'))).toBe(true);
      expect(result.warnings.some(w => w.includes('ignores'))).toBe(true);
      // The customer's commented file is left untouched (never clobbered).
      expect(
        readFileSync(nodePath.join(temporaryDirectory, '.markdownlint-cli2.jsonc'), 'utf8'),
      ).toBe(commented);
    });

    it('stays silent (no warning) when a skipIfMissing jsonMerge target is genuinely absent', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      expect(result.warnings.some(w => w.includes('.markdownlint-cli2.jsonc'))).toBe(false);
    });

    it('does not warn when a jsonMerge target parses cleanly', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeFileSync(
        nodePath.join(temporaryDirectory, '.markdownlint-cli2.jsonc'),
        `${JSON.stringify({ ignores: ['dist/**'] }, undefined, 2)}\n`,
      );

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', createContext());

      expect(result.warnings.some(w => w.includes('.markdownlint-cli2.jsonc'))).toBe(false);
    });

    it('should merge JSON files', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson({ scripts: { test: 'vitest' } });
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const pkg = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, 'package.json'), 'utf8'),
      );

      // Existing scripts preserved
      expect(pkg.scripts.test).toBe('vitest');
      // Safeword scripts added
      expect(pkg.scripts.lint).toBe('eslint . && bun run lint:gherkin');
      expect(pkg.scripts['lint:gherkin']).toBe(GHERKIN_LINT_SCRIPT);
      expect(pkg.scripts.format).toBe('prettier --write .');
      expect(pkg.scripts.knip).toBe('knip');
    });

    it('should not create root context files as text patch targets', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      expect(existsSync(nodePath.join(temporaryDirectory, 'AGENTS.md'))).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, 'CLAUDE.md'))).toBe(false);
    });

    it('should preserve existing CLAUDE.md without adding a safeword import', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      // Simulate an existing user CLAUDE.md whose first content line is a heading.
      writeFileSync(
        nodePath.join(temporaryDirectory, 'CLAUDE.md'),
        '# CLAUDE.md — my project\n\nSome existing notes.\n',
      );
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, 'CLAUDE.md'), 'utf8');

      expect(content).toBe('# CLAUDE.md — my project\n\nSome existing notes.\n');
      expect(content).not.toContain('@./.safeword/SAFEWORD.md');
      expect(content).not.toMatch(/---#/);
    });

    it('should remove legacy safeword import blocks from CLAUDE.md', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      // Reproduce a CLAUDE.md as it would exist after a pre-fix safeword install:
      // the import block is present (marker found, reconcile would skip the patch),
      // but the `---` separator is glued to the user's first heading.
      writeFileSync(
        nodePath.join(temporaryDirectory, 'CLAUDE.md'),
        '@./.safeword/SAFEWORD.md\n\n---# CLAUDE.md — my project\n\nSome existing notes.\n',
      );
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, 'CLAUDE.md'), 'utf8');
      expect(content).toBe('# CLAUDE.md — my project\n\nSome existing notes.\n');
      expect(content).not.toContain('@./.safeword/SAFEWORD.md');
      expect(content).not.toMatch(/---#/);
      // Heal must be idempotent: running reconcile again leaves the file unchanged.
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);
      const contentAfter = readFileSync(nodePath.join(temporaryDirectory, 'CLAUDE.md'), 'utf8');
      expect(contentAfter).toBe(content);
    });

    it('should remove legacy safeword prose from AGENTS.md', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeFileSync(
        nodePath.join(temporaryDirectory, 'AGENTS.md'),
        '**⚠️ ALWAYS READ FIRST:** `.safeword/SAFEWORD.md`\n\n---# AGENTS.md — my project\n\nSome existing notes.\n',
      );
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');
      expect(content).toBe('# AGENTS.md — my project\n\nSome existing notes.\n');
      expect(content).not.toContain('.safeword/SAFEWORD.md');
      expect(content).not.toMatch(/---#/);
    });

    it('should preserve existing AGENTS.md without adding safeword prose', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      writeFileSync(
        nodePath.join(temporaryDirectory, 'AGENTS.md'),
        '# AGENTS.md — my project\n\nSome existing notes.\n',
      );
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');

      expect(content).toBe('# AGENTS.md — my project\n\nSome existing notes.\n');
      expect(content).not.toContain('.safeword/SAFEWORD.md');
      expect(content).not.toMatch(/---#/);
    });

    it('should compute packages to install', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Should include all base packages
      expect(result.packagesToInstall).toContain(ESLINT_PACKAGE);
      expect(result.packagesToInstall).toContain('prettier');
      expect(result.packagesToInstall).toContain('safeword');
      expect(result.packagesToInstall).toContain(JITI_PACKAGE);
      expect(result.packagesToInstall).not.toContain('gherkin-lint');
    });

    it('should include conditional packages based on project type', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext({
        projectType: { astro: true, tailwind: true },
      });

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Astro and tailwind prettier plugins are NOT bundled in safeword
      expect(result.packagesToInstall).toContain('prettier-plugin-astro');
      expect(result.packagesToInstall).toContain('prettier-plugin-tailwindcss');
    });

    it('should exclude already installed packages', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson({
        devDependencies: { eslint: '^8.0.0', prettier: '^3.0.0' },
      });
      const ctx = createContext({
        developmentDeps: { eslint: '^8.0.0', prettier: '^3.0.0' },
      });

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      expect(result.packagesToInstall).not.toContain(ESLINT_PACKAGE);
      expect(result.packagesToInstall).not.toContain('prettier');
      // But should still include others
      expect(result.packagesToInstall).toContain('knip');
    });
  });

  describe('reconcile() - upgrade mode', () => {
    it('should remove deprecated files that exist', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Create a deprecated file (simulating old version)
      const deprecatedPath = nodePath.join(
        temporaryDirectory,
        '.safeword/templates/user-stories-template.md',
      );
      mkdirSync(nodePath.join(temporaryDirectory, '.safeword/templates'), {
        recursive: true,
      });
      writeFileSync(deprecatedPath, '# Old User Stories Template');

      // Upgrade should remove deprecated file
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      expect(result.removed).toContain('.safeword/templates/user-stories-template.md');
      expect(existsSync(deprecatedPath)).toBe(false);
    });

    it('should not fail when deprecated files do not exist', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Ensure deprecated file does not exist
      const deprecatedPath = nodePath.join(
        temporaryDirectory,
        '.safeword/templates/user-stories-template.md',
      );
      expect(existsSync(deprecatedPath)).toBe(false);

      // Upgrade should succeed without errors
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      expect(result.applied).toBe(true);
      // Deprecated file not in removed list since it didn't exist
      expect(result.removed).not.toContain('.safeword/templates/user-stories-template.md');
    });

    it('should include deprecated files in dryRun upgrade actions', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Create a deprecated file
      const deprecatedPath = nodePath.join(
        temporaryDirectory,
        '.safeword/templates/user-stories-template.md',
      );
      mkdirSync(nodePath.join(temporaryDirectory, '.safeword/templates'), {
        recursive: true,
      });
      writeFileSync(deprecatedPath, '# Old Template');

      // dryRun upgrade should report deprecated file in actions
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // Should have rm action for deprecated file
      const rmActions = result.actions.filter(a => a.type === 'rm');
      expect(rmActions.some(a => a.path === '.safeword/templates/user-stories-template.md')).toBe(
        true,
      );

      // File should still exist (dryRun)
      expect(existsSync(deprecatedPath)).toBe(true);

      // Should be in removed list
      expect(result.removed).toContain('.safeword/templates/user-stories-template.md');
    });

    it('should update owned files only if content changed', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Modify an owned file
      const versionPath = nodePath.join(temporaryDirectory, '.safeword/version');
      writeFileSync(versionPath, 'old-version');

      // Upgrade should update it
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      expect(result.updated).toContain('.safeword/version');
    });

    it('should not update owned files if content matches', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Upgrade without changes
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      // Nothing should be updated
      expect(result.updated).toHaveLength(0);
    });

    it('should skip managed files if user modified them', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // User modifies eslint config
      const eslintPath = nodePath.join(temporaryDirectory, 'eslint.config.mjs');
      writeFileSync(eslintPath, '// User customized config\nexport default [];');

      // Upgrade should NOT overwrite it
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      expect(result.updated).not.toContain('eslint.config.mjs');

      // Verify content preserved
      const content = readFileSync(eslintPath, 'utf8');
      expect(content).toContain('User customized');
    });

    it('should update managed files if content matches template', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Simulate template changed (by changing version in schema)
      // In real world, the template content would change
      // For this test, we verify the logic path exists

      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      // Result should be valid
      expect(result.applied).toBe(true);
    });
  });

  describe('reconcile() - uninstall mode', () => {
    it('should remove all owned files including .safeword/', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // All owned files should be removed
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude/commands/lint.md'))).toBe(false);
      expect(
        existsSync(nodePath.join(temporaryDirectory, '.claude/skills/quality-review/SKILL.md')),
      ).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/SAFEWORD.md'))).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword'))).toBe(false);
    });

    it('should unmerge JSON files', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson({ scripts: { test: 'vitest' } });
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      const pkg = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, 'package.json'), 'utf8'),
      );

      // Safeword-specific scripts removed (but lint/format preserved)
      expect(pkg.scripts['lint:md']).toBeUndefined();
      expect(pkg.scripts['format:check']).toBeUndefined();
      expect(pkg.scripts.knip).toBeUndefined();

      // lint/format preserved (useful standalone)
      expect(pkg.scripts.lint).toBe('eslint . && bun run lint:gherkin');
      expect(pkg.scripts['lint:gherkin']).toBe(GHERKIN_LINT_SCRIPT);
      expect(pkg.scripts.format).toBe('prettier --write .');

      // Original scripts preserved
      expect(pkg.scripts.test).toBe('vitest');
    });

    it('should remove legacy text patches', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Create existing AGENTS.md with legacy safeword content and user content
      writeFileSync(
        nodePath.join(temporaryDirectory, 'AGENTS.md'),
        '**⚠️ ALWAYS READ FIRST:** `.safeword/SAFEWORD.md`\n\n---\n\n# My Project\n\nCustom content here.',
      );
      createPackageJson();
      const ctx = createContext();

      // Install removes the legacy patch and preserves customer content.
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      let content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');
      expect(content).not.toContain('.safeword/SAFEWORD.md');
      expect(content).toContain('Custom content here');

      // Uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // Patch removed, user content preserved
      content = readFileSync(nodePath.join(temporaryDirectory, 'AGENTS.md'), 'utf8');
      expect(content).not.toContain('.safeword/SAFEWORD.md');
      expect(content).toContain('Custom content here');
    });

    it('should remove safeword-only Codex config on uninstall', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);
      expect(existsSync(nodePath.join(temporaryDirectory, '.codex/config.toml'))).toBe(true);

      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      expect(existsSync(nodePath.join(temporaryDirectory, '.codex/config.toml'))).toBe(false);
    });

    it('should strip safeword hooks from user-extended Codex config on uninstall', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);
      writeFileSync(
        nodePath.join(temporaryDirectory, '.codex/config.toml'),
        `${readCodexConfigTemplate()}\nmodel = "gpt-5-codex"\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8');
      expect(content).toContain('model = "gpt-5-codex"');
      expect(content).not.toContain('.safeword/hooks/prompt-timestamp.ts');
      expect(content).not.toContain('.safeword/hooks/codex/pre-tool-quality.ts');
      expect(content).not.toContain('.safeword/hooks/codex/post-tool-skill-nudge.ts');
      expect(content).not.toContain('.safeword/hooks/codex/post-tool-quality.ts');
      expect(content).not.toContain('.safeword/hooks/codex/stop.ts');
      expect(content).not.toContain('[[hooks.Stop]]');
    });

    it('should clean legacy Codex config that only has the safeword PreToolUse hook', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      mkdirSync(nodePath.join(temporaryDirectory, '.codex'), { recursive: true });
      writeFileSync(
        nodePath.join(temporaryDirectory, '.codex/config.toml'),
        readLegacyCodexConfigWithoutPromptTimestamp(),
      );

      await reconcile(SAFEWORD_SCHEMA, 'uninstall', createContext());

      expect(existsSync(nodePath.join(temporaryDirectory, '.codex/config.toml'))).toBe(false);
    });

    it('should remove owned directories but preserve user content', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Add a completed ticket (should be preserved - user content)
      const completedDirectory = nodePath.join(
        temporaryDirectory,
        '.safeword-project/tickets/completed',
      );
      mkdirSync(completedDirectory, { recursive: true });
      writeFileSync(nodePath.join(completedDirectory, '001-done.md'), 'Completed ticket');

      // Uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      // Owned dirs removed
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/hooks'))).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword/guides'))).toBe(false);

      // Preserved dir still exists with user content
      expect(
        existsSync(
          nodePath.join(temporaryDirectory, '.safeword-project/tickets/completed/001-done.md'),
        ),
      ).toBe(true);

      // .safeword-project parent still exists because of preserved content
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword-project'))).toBe(true);
    });
  });

  describe('reconcile() - uninstall-full mode', () => {
    it('should remove managed files', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Full uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', ctx);

      // Managed files removed (if they match template)
      expect(existsSync(nodePath.join(temporaryDirectory, 'eslint.config.mjs'))).toBe(false);
      // .prettierrc is removed if it matches our template (no customizations)
      // Note: jsonMerge unmerge cleans up plugins for files that DON'T match template
      expect(existsSync(nodePath.join(temporaryDirectory, '.prettierrc'))).toBe(false);
    });

    it('should compute packages to remove', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson({
        devDependencies: {
          eslint: '^8.0.0',
          prettier: '^3.0.0',
          knip: '^5.0.0',
        },
      });
      const ctx = createContext({
        developmentDeps: {
          eslint: '^8.0.0',
          prettier: '^3.0.0',
          knip: '^5.0.0',
        },
      });

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // Full uninstall
      const result = await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', ctx);

      // Should include packages to remove
      expect(result.packagesToRemove).toContain(ESLINT_PACKAGE);
      expect(result.packagesToRemove).toContain('prettier');
      expect(result.packagesToRemove).toContain('knip');
    });

    it('should remove .mcp.json if empty after unmerge', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install (creates .mcp.json with our servers)
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);
      expect(existsSync(nodePath.join(temporaryDirectory, '.mcp.json'))).toBe(true);

      // Full uninstall
      await reconcile(SAFEWORD_SCHEMA, 'uninstall-full', ctx);

      // .mcp.json should be removed (was only our content)
      expect(existsSync(nodePath.join(temporaryDirectory, '.mcp.json'))).toBe(false);
    });
  });

  describe('reconcile() - MCP server merge (#255)', () => {
    // Regression: #255 — MCP reconcile must not clobber user-customized servers.
    it('should preserve a user-customized context7 entry on upgrade (#255)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const mcpPath = nodePath.join(temporaryDirectory, '.mcp.json');
      // User authored a custom context7 transport with headers.
      const customContext7 = {
        url: 'https://mcp.context7.com/mcp',
        headers: { Authorization: 'Bearer user-token' },
      };
      writeFileSync(
        mcpPath,
        JSON.stringify({ mcpServers: { context7: customContext7 } }, undefined, 2),
      );

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      const result = JSON.parse(readFileSync(mcpPath, 'utf8')) as {
        mcpServers: Record<string, unknown>;
      };
      // User's customization survives reconcile/upgrade...
      expect(result.mcpServers.context7).toEqual(customContext7);
      // ...and the missing default (playwright) is still injected.
      expect(result.mcpServers.playwright).toBeDefined();
    });

    it('should preserve unrelated user MCP servers on upgrade (#255)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const mcpPath = nodePath.join(temporaryDirectory, '.mcp.json');
      const customServer = { command: 'bunx', args: ['@acme/custom-mcp@latest'] };
      writeFileSync(mcpPath, JSON.stringify({ mcpServers: { acme: customServer } }, undefined, 2));

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      const result = JSON.parse(readFileSync(mcpPath, 'utf8')) as {
        mcpServers: Record<string, unknown>;
      };
      expect(result.mcpServers.acme).toEqual(customServer);
      expect(result.mcpServers.context7).toBeDefined();
      expect(result.mcpServers.playwright).toBeDefined();
    });

    it('should seed default MCP servers when none are present (#255)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const { MCP_SERVERS } = await import('../src/utils/install.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const result = JSON.parse(
        readFileSync(nodePath.join(temporaryDirectory, '.mcp.json'), 'utf8'),
      ) as { mcpServers: Record<string, unknown> };
      expect(result.mcpServers.context7).toEqual(MCP_SERVERS.context7);
      expect(result.mcpServers.playwright).toEqual(MCP_SERVERS.playwright);
    });

    it('should not rewrite .mcp.json when servers are already correct (#255)', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const mcpPath = nodePath.join(temporaryDirectory, '.mcp.json');
      // A user-authored server ordered before our managed ones; both defaults present.
      const onDisk = `${JSON.stringify(
        {
          mcpServers: {
            acme: { command: 'bunx', args: ['@acme/custom-mcp@latest'] },
            context7: { url: 'https://mcp.context7.com/mcp' },
            playwright: { command: 'bunx', args: ['@playwright/mcp@latest'] },
          },
        },
        undefined,
        2,
      )}\n`;
      writeFileSync(mcpPath, onDisk);

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      // Idempotent: byte-identical, no key reordering churn.
      expect(readFileSync(mcpPath, 'utf8')).toBe(onDisk);
    });
  });

  describe('reconcile() - Codex MCP parity (#269)', () => {
    it('configures context7 and playwright MCP servers in Codex config on install', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8');
      // context7 over the hosted streamable-HTTP transport (parity with MCP_SERVERS).
      expect(content).toContain('[mcp_servers.context7]');
      expect(content).toContain('url = "https://mcp.context7.com/mcp"');
      // playwright over stdio.
      expect(content).toContain('[mcp_servers.playwright]');
      expect(content).toContain('command = "bunx"');
      expect(content).toContain('args = ["@playwright/mcp@latest"]');
    });

    it('strips safeword MCP servers from a user-extended Codex config on uninstall', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);
      // User appends their own config below safeword's managed content.
      writeFileSync(
        nodePath.join(temporaryDirectory, '.codex/config.toml'),
        `${readCodexConfigTemplate()}\nmodel = "gpt-5-codex"\n`,
      );

      await reconcile(SAFEWORD_SCHEMA, 'uninstall', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8');
      // User content survives; safeword's MCP servers are removed.
      expect(content).toContain('model = "gpt-5-codex"');
      expect(content).not.toContain('[mcp_servers.context7]');
      expect(content).not.toContain('[mcp_servers.playwright]');
    });

    it('retrofits MCP servers into an existing pre-MCP Codex config on upgrade', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // Simulate a config from a safeword version that predates MCP parity:
      // the hooks scaffold, but no [mcp_servers.*] tables. Strip the exact MCP
      // block so this stays correct regardless of template section ordering.
      const { CODEX_MCP_SERVERS_BLOCK } = await import('../src/schema.js');
      const preMcp = readCodexConfigTemplate().replace(CODEX_MCP_SERVERS_BLOCK, '');
      mkdirSync(nodePath.join(temporaryDirectory, '.codex'), { recursive: true });
      writeFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), preMcp);

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8');
      expect(content).toContain('[mcp_servers.context7]');
      expect(content).toContain('url = "https://mcp.context7.com/mcp"');
      expect(content).toContain('[mcp_servers.playwright]');
      // Idempotent: retrofit appends exactly one context7 table, not a duplicate.
      expect(content.match(/\[mcp_servers\.context7\]/g)).toHaveLength(1);
    });

    it('does not overwrite or duplicate a user-authored context7 on upgrade', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // User already has a customized context7 in their Codex config.
      const { CODEX_MCP_SERVERS_BLOCK } = await import('../src/schema.js');
      const base = readCodexConfigTemplate().replace(CODEX_MCP_SERVERS_BLOCK, '').trimEnd();
      const customized = `${base}\n[mcp_servers.context7]\nurl = "https://example.test/custom"\n`;
      mkdirSync(nodePath.join(temporaryDirectory, '.codex'), { recursive: true });
      writeFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), customized);

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8');
      // User's customization survives; no duplicate table injected.
      expect(content).toContain('url = "https://example.test/custom"');
      expect(content).not.toContain('url = "https://mcp.context7.com/mcp"');
      expect(content.match(/\[mcp_servers\.context7\]/g)).toHaveLength(1);
    });
  });

  describe('reconcile() - Codex retro parity (#602)', () => {
    it('configures the silent Stop retro hook and prompt nudge hook on install', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8');
      expect(content).toContain('.safeword/hooks/codex/stop.ts');
      expect(content).toContain('timeout = 600');
      expect(content).toContain('Running safeword retro if this session is substantial');
      expect(content).toContain('.safeword/hooks/prompt-retro-nudge.ts');
      expect(content).toContain('Checking spooled safeword retro drafts');
    });

    it('retrofits the Codex prompt retro nudge into an existing pre-nudge config', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { CODEX_PROMPT_RETRO_NUDGE_HOOK_PATCH, SAFEWORD_SCHEMA } =
        await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const preNudge = readCodexConfigTemplate().replace(CODEX_PROMPT_RETRO_NUDGE_HOOK_PATCH, '');
      mkdirSync(nodePath.join(temporaryDirectory, '.codex'), { recursive: true });
      writeFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), preNudge);

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8');
      expect(content).toContain('.safeword/hooks/prompt-retro-nudge.ts');
      expect(content.match(/\.safeword\/hooks\/prompt-retro-nudge\.ts/g)).toHaveLength(1);
    });
  });

  describe('reconcile() - Codex quality-state parity (#630)', () => {
    it('configures the PostToolUse quality-state hook on install', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8');
      expect(content).toContain('.safeword/hooks/codex/post-tool-quality.ts');
      expect(content).toContain('Updating safeword quality state');
    });

    it('retrofits the PostToolUse quality-state hook into an existing pre-#630 config', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { CODEX_POST_TOOL_QUALITY_HOOK_PATCH, SAFEWORD_SCHEMA } =
        await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const preQuality = readCodexConfigTemplate().replace(CODEX_POST_TOOL_QUALITY_HOOK_PATCH, '');
      mkdirSync(nodePath.join(temporaryDirectory, '.codex'), { recursive: true });
      writeFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), preQuality);

      await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx);

      const content = readFileSync(nodePath.join(temporaryDirectory, '.codex/config.toml'), 'utf8');
      expect(content.match(/\.safeword\/hooks\/codex\/post-tool-quality\.ts/g)).toHaveLength(1);
    });
  });

  describe('reconcile() - dryRun option', () => {
    it('should not make any changes in dryRun mode', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx, {
        dryRun: true,
      });

      expect(result.applied).toBe(false);

      // No files should be created
      expect(existsSync(nodePath.join(temporaryDirectory, '.safeword'))).toBe(false);
      expect(existsSync(nodePath.join(temporaryDirectory, '.claude'))).toBe(false);
    });

    it('should still compute actions in dryRun mode', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      const result = await reconcile(SAFEWORD_SCHEMA, 'install', ctx, {
        dryRun: true,
      });

      // Actions should be computed
      expect(result.actions.length).toBeGreaterThan(0);

      // Should have mkdir, write, and json-merge actions
      expect(result.actions.some(a => a.type === 'mkdir')).toBe(true);
      expect(result.actions.some(a => a.type === 'write')).toBe(true);
      expect(result.actions.some(a => a.type === 'json-merge')).toBe(true);
    });

    it('should report healthy when dryRun upgrade finds no changes', async () => {
      const { reconcile } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      createPackageJson();
      const ctx = createContext();

      // First install
      await reconcile(SAFEWORD_SCHEMA, 'install', ctx);

      // dryRun upgrade should find no changes
      const result = await reconcile(SAFEWORD_SCHEMA, 'upgrade', ctx, {
        dryRun: true,
      });

      // No actions means healthy
      expect(result.actions.filter(a => a.type === 'write')).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
    });
  });

  describe('computePackagesToInstall()', () => {
    it('should return all base packages for fresh install', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // no existing formatter, gets prettier
      const projectType = { ...DEFAULT_PROJECT_TYPE };

      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      // Base packages + prettier (from "standard" conditional for non-Biome projects)
      expect(result).toContain(ESLINT_PACKAGE);
      expect(result).toContain('safeword');
      expect(result).toContain(JITI_PACKAGE);
      expect(result).toContain('dependency-cruiser');
      expect(result).toContain('knip');
      expect(result).toContain('prettier'); // standard conditional
    });

    it('should not include prettier for Biome projects', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Has existing formatter, doesn't get prettier
      const projectType = { ...DEFAULT_PROJECT_TYPE, existingFormatter: true };

      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      expect(result).toContain(ESLINT_PACKAGE);
      expect(result).toContain('safeword');
      expect(result).not.toContain('prettier');
    });

    it('should add conditional packages for astro', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      const projectType = { ...DEFAULT_PROJECT_TYPE, astro: true };

      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      expect(result).toContain('prettier-plugin-astro');
    });

    it('should not add prettier plugins for projects with existing formatter', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Existing formatter handles formatting
      const projectType = {
        ...DEFAULT_PROJECT_TYPE,
        astro: true,
        existingFormatter: true,
      };

      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      expect(result).not.toContain('prettier');
      expect(result).not.toContain('prettier-plugin-astro');
    });

    it('should add multiple conditional packages', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      const projectType = {
        ...DEFAULT_PROJECT_TYPE,
        astro: true,
        tailwind: true,
        publishableLibrary: true,
      };

      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      // Conditional packages NOT bundled in safeword
      expect(result).toContain('prettier-plugin-astro');
      expect(result).toContain('prettier-plugin-tailwindcss');
      expect(result).toContain('publint');
    });

    it('should exclude already installed packages', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      const projectType = { ...DEFAULT_PROJECT_TYPE };

      const installedDevelopmentDependencies = {
        eslint: '^8.0.0',
        prettier: '^3.0.0',
        knip: '^5.0.0',
      };

      const result = computePackagesToInstall(
        SAFEWORD_SCHEMA,
        projectType,
        installedDevelopmentDependencies,
      );

      expect(result).not.toContain(ESLINT_PACKAGE);
      expect(result).not.toContain('prettier');
      expect(result).not.toContain('knip');
      expect(result).toContain('safeword'); // Not installed, should be included
    });

    it('should exclude packages provided by workspace members', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Create a temp monorepo with a workspace member named "safeword"
      const workspaceRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-workspace-test-'));
      const memberDirectory = nodePath.join(workspaceRoot, 'packages', 'cli');
      mkdirSync(memberDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(workspaceRoot, 'package.json'),
        JSON.stringify({ name: 'my-monorepo', workspaces: ['packages/*'] }),
      );
      writeFileSync(
        nodePath.join(memberDirectory, 'package.json'),
        JSON.stringify({ name: 'safeword' }),
      );

      try {
        const projectType = { ...DEFAULT_PROJECT_TYPE };
        const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {}, workspaceRoot);

        expect(result).not.toContain('safeword');
        expect(result).toContain(ESLINT_PACKAGE); // Other packages still included
        expect(result).toContain('knip');
      } finally {
        rmSync(workspaceRoot, { recursive: true, force: true });
      }
    });

    it('should include packages when no workspaces exist', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Create a temp project with no workspaces
      const projectRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-no-workspace-test-'));
      writeFileSync(nodePath.join(projectRoot, 'package.json'), JSON.stringify({ name: 'my-app' }));

      try {
        const projectType = { ...DEFAULT_PROJECT_TYPE };
        const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {}, projectRoot);

        expect(result).toContain('safeword'); // Not a workspace member, should install from npm
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('should work when cwd is not provided (backward compat)', async () => {
      const { computePackagesToInstall } = await import('../src/reconcile.js');
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      const projectType = { ...DEFAULT_PROJECT_TYPE };
      const result = computePackagesToInstall(SAFEWORD_SCHEMA, projectType, {});

      expect(result).toContain('safeword');
    });
  });
});
