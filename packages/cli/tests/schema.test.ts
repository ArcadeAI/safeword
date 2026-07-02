/**
 * Test Suite: Schema Validation
 *
 * Tests that SAFEWORD_SCHEMA is the single source of truth.
 * Every template file must have a schema entry, no orphans.
 *
 * TDD RED phase - these tests should FAIL until src/schema.ts is implemented.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import {
  CURSOR_COMMAND_WRAPPERS,
  CURSOR_RULE_WRAPPERS,
  renderCursorCommandWrapper,
  renderCursorRuleWrapper,
  SKILL_CURSOR_PAIRS,
} from '../src/cursor-wrappers.js';
import { ESLINT_PACKAGE } from '../src/packs/typescript/files.js';
import { SETTINGS_HOOKS } from '../src/templates/config.js';

// Type guard for filtering out undefined values
const isDefined = <T>(x: T | undefined): x is T => x !== undefined;

/**
 * Mirrors `getClaudeParentDirectoryForCleanup` in reconcile.ts: any `.claude/*`
 * path deeper than `.claude`, `.claude/skills`, `.claude/commands` gets
 * removed automatically at uninstall. Hoisted to file scope per
 * unicorn/consistent-function-scoping.
 */
const isAutoCleanedClaudePath = (parent: string): boolean =>
  parent.startsWith('.claude/') && parent !== '.claude/skills' && parent !== '.claude/commands';

describe('Schema - Single Source of Truth', () => {
  /** Recursively collect all files in templates/ directory (skips _ prefixed dirs) */
  function collectTemplateFiles(dir: string, prefix = ''): string[] {
    const files: string[] = [];
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = nodePath.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip _shared directories - they contain include files, not installable templates
        if (entry.name.startsWith('_')) continue;
        files.push(...collectTemplateFiles(fullPath, relativePath));
      } else {
        files.push(relativePath);
      }
    }

    return files;
  }

  const templatesDirectory = nodePath.join(import.meta.dirname, '../templates');

  describe('ownedDirs', () => {
    it('should include all required .safeword subdirectories', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const required = [
        '.safeword',
        '.safeword/hooks',
        '.safeword/hooks/cursor',
        '.safeword/hooks/lib',
        '.safeword/scripts',
        '.safeword/guides',
        '.safeword/templates',
        '.safeword/prompts',
        '.cursor',
        '.cursor/rules',
        '.cursor/commands',
      ];

      for (const dir of required) {
        expect(SAFEWORD_SCHEMA.ownedDirs).toContain(dir);
      }
    });

    it('should NOT include deprecated planning directories', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const deprecated = [
        '.safeword/planning',
        '.safeword/planning/specs',
        '.safeword/planning/test-definitions',
        '.safeword/planning/design',
        '.safeword/planning/issues',
        '.safeword/planning/plans',
      ];

      for (const dir of deprecated) {
        expect(SAFEWORD_SCHEMA.ownedDirs).not.toContain(dir);
      }
    });

    // Regression: v0.36.x shipped with .safeword/statusline/reentry.ts owned but
    // .safeword/statusline missing from ownedDirs — uninstall left an empty
    // directory behind, which made removeIfEmpty('.safeword') silently fail.
    // The bug class is "owned file under unregistered directory", so the test
    // is structural: every dirname(ownedFile) must be removable at uninstall
    // — either by an explicit ownedDirs/sharedDirs/preservedDirs entry, or by
    // the .claude/* auto-cleanup path in reconcile.ts (getClaudeParentDirectoryForCleanup).
    it('should declare a directory for every parent of every ownedFile', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const declared = new Set<string>([
        ...SAFEWORD_SCHEMA.ownedDirs,
        ...SAFEWORD_SCHEMA.sharedDirs,
        ...SAFEWORD_SCHEMA.preservedDirs,
      ]);

      const missing: { file: string; parent: string }[] = [];
      for (const filePath of Object.keys(SAFEWORD_SCHEMA.ownedFiles)) {
        const parent = nodePath.posix.dirname(filePath);
        if (parent === '.' || parent === '') continue;
        if (declared.has(parent)) continue;
        if (isAutoCleanedClaudePath(parent)) continue;
        missing.push({ file: filePath, parent });
      }

      if (missing.length > 0) {
        const detail = missing
          .map(
            ({ file, parent }) =>
              `  - '${file}' needs '${parent}' in ownedDirs/sharedDirs/preservedDirs`,
          )
          .join('\n');
        expect.fail(`ownedFiles point to undeclared directories:\n${detail}`);
      }
    });
  });

  describe('sharedDirs', () => {
    it('should include .claude directories', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      expect(SAFEWORD_SCHEMA.sharedDirs).toContain('.claude');
      expect(SAFEWORD_SCHEMA.sharedDirs).toContain('.claude/skills');
      expect(SAFEWORD_SCHEMA.sharedDirs).toContain('.claude/commands');
    });
  });

  describe('preservedDirs', () => {
    it('should preserve user content directories', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      expect(SAFEWORD_SCHEMA.preservedDirs).toContain('.safeword-project/learnings');
      expect(SAFEWORD_SCHEMA.preservedDirs).toContain('.safeword/logs');
      expect(SAFEWORD_SCHEMA.preservedDirs).toContain('.safeword-project/tickets');
      expect(SAFEWORD_SCHEMA.preservedDirs).toContain('.safeword-project/tickets/completed');
      expect(SAFEWORD_SCHEMA.preservedDirs).toContain('.safeword-project/tmp');
    });

    it('should NOT include old .safeword/tickets paths', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      expect(SAFEWORD_SCHEMA.preservedDirs).not.toContain('.safeword/tickets');
      expect(SAFEWORD_SCHEMA.preservedDirs).not.toContain('.safeword/tickets/completed');
    });
  });

  describe('deprecatedDirs', () => {
    it('should include old planning and tickets directories', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      expect(SAFEWORD_SCHEMA.deprecatedDirs).toContain('.safeword/planning');
      expect(SAFEWORD_SCHEMA.deprecatedDirs).toContain('.safeword/tickets');
    });
  });

  describe('.gitignore textPatch - transient state', () => {
    // Every generated transient file must be ignored. If it isn't, it shows as
    // untracked in `git status --porcelain` — churning the customer's tree and
    // blocking the auto-upgrade clean-tree gate. Regression guard for the bug
    // where re-entry.md / failure-counts.json / skill-invocations.log were
    // ignored in safeword's own repo but missing from the shipped textPatch.
    it('ignores all generated transient files', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const gitignorePatch = SAFEWORD_SCHEMA.textPatches['.gitignore'];
      const content =
        (Array.isArray(gitignorePatch) ? gitignorePatch[0]?.content : gitignorePatch?.content) ??
        '';
      for (const entry of [
        '.safeword/.update-cache.json',
        '.safeword-project/quality-state*.json',
        '.safeword-project/failure-counts.json',
        '.safeword-project/skill-invocations.log',
        '.safeword-project/re-entry.md',
      ]) {
        expect(content).toContain(entry);
      }
    });
  });

  describe('ownedFiles', () => {
    it('should have entry for every template file (template → schema)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const templateFiles = collectTemplateFiles(templatesDirectory);

      // Collect template: property values from both ownedFiles and managedFiles —
      // either bucket can reference a template (ownedFiles overwrites on upgrade;
      // managedFiles preserves user content).
      const schemaTemplatePaths = new Set(
        [
          ...Object.values(SAFEWORD_SCHEMA.ownedFiles),
          ...Object.values(SAFEWORD_SCHEMA.managedFiles),
        ]
          .map(definition => definition.template)
          .filter(isDefined),
      );

      // Check every template file has a schema entry with template: pointing to it
      for (const templateFile of templateFiles) {
        if (!schemaTemplatePaths.has(templateFile)) {
          expect.fail(
            `Template file '${templateFile}' has no schema entry with template: '${templateFile}'`,
          );
        }
      }
    });

    it('should not have orphan schema entries (schema → template)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Files that are generated (not from templates)
      const generatedFiles = new Set(['.safeword/version']);

      for (const [path, definition] of Object.entries(SAFEWORD_SCHEMA.ownedFiles)) {
        if (generatedFiles.has(path)) continue;

        // If it has a template reference, verify template exists
        if (definition.template) {
          const templatePath = nodePath.join(templatesDirectory, definition.template);
          if (!existsSync(templatePath)) {
            expect.fail(
              `Schema entry '${path}' references template '${definition.template}' which does not exist`,
            );
          }
        }
      }
    });
  });

  describe('verify command registration (T10)', () => {
    it('should have verify registered in ownedFiles for both Claude and Cursor', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      expect('.claude/skills/verify/SKILL.md' in SAFEWORD_SCHEMA.ownedFiles).toBe(true);
      expect('.cursor/commands/verify.md' in SAFEWORD_SCHEMA.ownedFiles).toBe(true);
    });

    it('should NOT have done.md in ownedFiles', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      expect('.claude/commands/done.md' in SAFEWORD_SCHEMA.ownedFiles).toBe(false);
      expect('.cursor/commands/done.md' in SAFEWORD_SCHEMA.ownedFiles).toBe(false);
    });

    it('should have done.md in deprecatedFiles', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      expect(SAFEWORD_SCHEMA.deprecatedFiles).toContain('.claude/commands/done.md');
      expect(SAFEWORD_SCHEMA.deprecatedFiles).toContain('.cursor/commands/done.md');
    });

    it('should NOT have any path in BOTH deprecatedFiles AND ownedFiles (regression: v0.32.0 shipped with safeword-brainstorming.mdc in both, causing dogfood upgrade to delete a freshly-installed file)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const ownedPaths = new Set(Object.keys(SAFEWORD_SCHEMA.ownedFiles));
      const conflicts = SAFEWORD_SCHEMA.deprecatedFiles.filter(path => ownedPaths.has(path));
      expect(conflicts).toEqual([]);
    });
  });

  describe('managedFiles', () => {
    it('should include eslint.config.mjs, tsconfig.json, knip.json, and .prettierrc', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      // Note: toHaveProperty interprets "." as nested path, use `in` operator instead
      expect('eslint.config.mjs' in SAFEWORD_SCHEMA.managedFiles).toBe(true);
      expect('tsconfig.json' in SAFEWORD_SCHEMA.managedFiles).toBe(true);
      expect('knip.json' in SAFEWORD_SCHEMA.managedFiles).toBe(true);
      expect('.prettierrc' in SAFEWORD_SCHEMA.managedFiles).toBe(true);
    });
  });

  describe('jsonMerges', () => {
    it('should include package.json, .claude/settings.json, .mcp.json, Cursor configs, and .prettierrc', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      // Note: toHaveProperty interprets "." and "/" as nested path, use `in` operator instead
      expect('package.json' in SAFEWORD_SCHEMA.jsonMerges).toBe(true);
      expect('.claude/settings.json' in SAFEWORD_SCHEMA.jsonMerges).toBe(true);
      expect('.mcp.json' in SAFEWORD_SCHEMA.jsonMerges).toBe(true);
      expect('.cursor/mcp.json' in SAFEWORD_SCHEMA.jsonMerges).toBe(true);
      expect('.cursor/hooks.json' in SAFEWORD_SCHEMA.jsonMerges).toBe(true);
      // .prettierrc is in jsonMerges for uninstall cleanup (removes plugins key)
      expect('.prettierrc' in SAFEWORD_SCHEMA.jsonMerges).toBe(true);
    });
  });

  describe('textPatches', () => {
    it('should not patch customer context files to point at safeword', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      expect(SAFEWORD_SCHEMA.textPatches).not.toHaveProperty('AGENTS.md');
      expect(SAFEWORD_SCHEMA.textPatches).not.toHaveProperty('CLAUDE.md');
    });
  });

  describe('packages', () => {
    it('should include all required base packages', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const required = [
        ESLINT_PACKAGE, // Fresh installs use the current supported ESLint lane.
        'safeword', // bundles eslint-config-prettier + all ESLint plugins
        'jiti@^2.2.0', // generated hook ESLint config loads eslint.config.ts through jiti
      ];

      for (const pkg of required) {
        expect(SAFEWORD_SCHEMA.packages.base).toContain(pkg);
      }
    });

    it('gates JS-app dead-code/architecture tools on real JS source (BE7C7B)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      // Moved out of base so a non-JS repo (carrying only the TS BDD lane) doesn't get them.
      expect(SAFEWORD_SCHEMA.packages.base).not.toContain('knip');
      expect(SAFEWORD_SCHEMA.packages.base).not.toContain('dependency-cruiser');
      expect(SAFEWORD_SCHEMA.packages.conditional.hasJsSource).toEqual([
        'dependency-cruiser',
        'knip',
      ]);
    });

    it('should have prettier in standard conditional (non-Biome projects)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      expect(SAFEWORD_SCHEMA.packages.conditional).toHaveProperty('standard');
      expect(SAFEWORD_SCHEMA.packages.conditional.standard).toContain('prettier');
    });

    it('should have conditional packages for frameworks not in safeword plugin', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      // These frameworks are NOT in safeword/eslint (or need prettier plugins)
      const requiredConditions = [
        'astro', // prettier-plugin-astro (ESLint rules are in safeword)
        'tailwind', // prettier-plugin-tailwindcss
        'publishableLibrary', // publint
        'shellcheck', // shellcheck for shell scripts
      ];

      for (const condition of requiredConditions) {
        expect(SAFEWORD_SCHEMA.packages.conditional).toHaveProperty(condition);
      }
    });
  });

  describe('Claude/Cursor parity', () => {
    it('should have matching skills for Claude and Cursor rules (excluding core, BDD split, and action skills)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Action skills have disable-model-invocation and use Cursor commands instead of rules
      const ACTION_SKILLS = new Set([
        'lint',
        'verify',
        'audit',
        'explain',
        'cleanup-zombies',
        'self-review',
        'review-spec',
      ]);

      // Extract skill names from Claude schema paths (short names: debug, quality-review, refactor)
      const claudeSkills = Object.keys(SAFEWORD_SCHEMA.ownedFiles)
        .filter(path => path.startsWith('.claude/skills/') && path.endsWith('/SKILL.md'))
        .map(path => path.split('/', 3)[2])
        .filter(isDefined)
        // Exclude BDD (split into multiple Cursor rules) and action skills (Cursor commands, not rules)
        .filter(name => name !== 'bdd' && !ACTION_SKILLS.has(name))
        .toSorted((a, b) => a.localeCompare(b));

      // Cursor rules still use safeword- prefix, extract the suffix
      const cursorRules = Object.keys(SAFEWORD_SCHEMA.ownedFiles)
        .filter(path => path.startsWith('.cursor/rules/safeword-') && !path.includes('core'))
        .map(path => /safeword-([^.]+)/.exec(path)?.[1])
        .filter(isDefined)
        .toSorted((a, b) => a.localeCompare(b));

      // Derived from canonical SKILL_CURSOR_PAIRS fixture: cursor-rule suffix → skill name.
      // Covers gerund-form rules (brainstorming → brainstorm) and identity cases alike.
      const CURSOR_RULE_TO_SKILL: Record<string, string> = Object.fromEntries(
        SKILL_CURSOR_PAIRS.flatMap(pair =>
          (pair.cursorRules ?? [])
            .filter(rule => rule.startsWith('safeword-'))
            .map(rule => [rule.replace(/^safeword-/, ''), pair.skill] as const),
        ),
      );
      const normalizedCursorRules = cursorRules
        .map(name => CURSOR_RULE_TO_SKILL[name] ?? name)
        .toSorted((a, b) => a.localeCompare(b));

      expect(normalizedCursorRules).toEqual(claudeSkills);
    });

    it('should have BDD skill in Claude with corresponding split rules in Cursor', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Claude should have the BDD skill
      const hasBddSkill = Object.keys(SAFEWORD_SCHEMA.ownedFiles).some(path =>
        path.includes('bdd/SKILL.md'),
      );
      expect(hasBddSkill).toBe(true);

      // Cursor should have split BDD rules
      const bddRules = Object.keys(SAFEWORD_SCHEMA.ownedFiles).filter(path =>
        /\.cursor\/rules\/bdd-[^.]+\.mdc$/.exec(path),
      );
      expect(bddRules.length).toBeGreaterThanOrEqual(7);
    });

    it('should have Cursor commands as superset of Claude commands', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Extract command names from schema paths
      const claudeCommands = Object.keys(SAFEWORD_SCHEMA.ownedFiles)
        .filter(path => path.startsWith('.claude/commands/'))
        .map(path => path.split('/').pop())
        .filter(isDefined)
        .toSorted((a, b) => a.localeCompare(b));

      const cursorCommands = Object.keys(SAFEWORD_SCHEMA.ownedFiles)
        .filter(path => path.startsWith('.cursor/commands/'))
        .map(path => path.split('/').pop())
        .filter(isDefined)
        .toSorted((a, b) => a.localeCompare(b));

      // Cursor commands must be a superset of Claude commands
      // (Cursor needs explicit commands for all capabilities since it has no skills)
      // Claude commands are standalone-only — skills auto-create /slash-commands
      for (const command of claudeCommands) {
        expect(cursorCommands, `Cursor missing Claude command: ${command}`).toContain(command);
      }
    });

    it('should have a Cursor command for every action skill (DC6276)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Action skills are disable-model-invocation on Claude/Codex; on Cursor
      // (no skills) they must each ship as an explicit command — otherwise the
      // capability is silently absent there (e.g. /explain was missing).
      const ACTION_SKILLS = [
        'lint',
        'verify',
        'audit',
        'explain',
        'cleanup-zombies',
        'self-review',
        'review-spec',
      ];

      const cursorCommands = new Set(
        Object.keys(SAFEWORD_SCHEMA.ownedFiles)
          .filter(path => path.startsWith('.cursor/commands/'))
          .map(path => path.split('/').pop()?.replace(/\.md$/, ''))
          .filter(isDefined),
      );

      for (const skill of ACTION_SKILLS) {
        expect(cursorCommands, `Cursor missing command for action skill: ${skill}`).toContain(
          skill,
        );
      }
    });
  });

  describe('Drift detection', () => {
    it('should have templates for all local customer-facing skills', () => {
      const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
      const skillsDirectory = nodePath.join(repoRoot, '.claude/skills');
      const skillTemplatesDirectory = nodePath.join(import.meta.dirname, '../templates/skills');

      // Skills with `audience: maintainer` frontmatter are for safeword maintainers
      // (e.g. release discipline docs) and must not ship to customer projects.
      //
      // `audience` is a safeword-local convention, not an official Claude Code field.
      // Verified against https://code.claude.com/docs/en/skills (2026-05-13): the official
      // schema has no audience/visibility/private field — the loader tolerates unknown
      // frontmatter, so this is safe. If Claude Code ships an official field for this
      // someday, rename the field and update this check together.
      const isMaintainerOnly = (skillDirectory: string): boolean => {
        const skillFile = nodePath.join(skillDirectory, 'SKILL.md');
        if (!existsSync(skillFile)) return false;
        const content = readFileSync(skillFile, 'utf8');
        const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
        if (!frontmatterMatch?.[1]) return false;
        const frontmatter = YAML.parse(frontmatterMatch[1]) as Record<string, unknown> | undefined;
        return frontmatter?.audience === 'maintainer';
      };

      const localSkills = readdirSync(skillsDirectory, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .filter(entry => !isMaintainerOnly(nodePath.join(skillsDirectory, entry.name)))
        .map(entry => entry.name);

      const missing: string[] = [];
      for (const skill of localSkills) {
        if (!existsSync(nodePath.join(skillTemplatesDirectory, skill))) {
          missing.push(skill);
        }
      }

      expect(missing, `Local skills missing from templates/: ${missing.join(', ')}`).toEqual([]);
    });

    it('keeps thin Cursor command wrappers generated from metadata', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

      for (const wrapper of CURSOR_COMMAND_WRAPPERS) {
        const installedPath = `.cursor/commands/${wrapper.name}.md`;
        const templatePath = `commands/${wrapper.name}.md`;
        const expected = renderCursorCommandWrapper({ wrapper });

        expect(SAFEWORD_SCHEMA.ownedFiles[installedPath]?.template).toBe(templatePath);
        expect(readFileSync(nodePath.join(repoRoot, installedPath), 'utf8')).toBe(expected);
        expect(readFileSync(nodePath.join(templatesDirectory, templatePath), 'utf8')).toBe(
          expected,
        );
      }
    });

    it('keeps Cursor rule wrappers generated from metadata', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');

      for (const wrapper of CURSOR_RULE_WRAPPERS) {
        const installedPath = `.cursor/rules/${wrapper.name}.mdc`;
        const templatePath = `cursor/rules/${wrapper.name}.mdc`;
        const expected = renderCursorRuleWrapper({ wrapper });

        expect(SAFEWORD_SCHEMA.ownedFiles[installedPath]?.template).toBe(templatePath);
        expect(readFileSync(nodePath.join(repoRoot, installedPath), 'utf8')).toBe(expected);
        expect(readFileSync(nodePath.join(templatesDirectory, templatePath), 'utf8')).toBe(
          expected,
        );
      }
    });

    it('keeps Cursor rule skill metadata aligned with Claude skill references', () => {
      const mismatches = CURSOR_RULE_WRAPPERS.filter(
        wrapper =>
          wrapper.skill !== undefined &&
          !wrapper.referencePath.startsWith(`.claude/skills/${wrapper.skill}/`),
      ).map(
        wrapper =>
          `${wrapper.name}: skill=${wrapper.skill ?? '<none>'}, reference=${wrapper.referencePath}`,
      );

      expect(
        mismatches,
        `Cursor rule skill/reference drift:\n  ${mismatches.join('\n  ')}`,
      ).toEqual([]);
    });

    it('should have all hook files wired in SETTINGS_HOOKS', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Extract hook filenames from SETTINGS_HOOKS command strings
      const wiredHooks = new Set<string>();
      for (const entries of Object.values(SETTINGS_HOOKS)) {
        for (const entry of entries) {
          for (const hookDefinition of entry.hooks) {
            const match = /\/([^/\s]+?\.(?:ts|sh))(?:\s|$)/.exec(hookDefinition.command);
            if (match?.[1]) wiredHooks.add(match[1]);
          }
        }
      }

      // Non-lifecycle hook modules live beside lifecycle hooks because they
      // share hook libs or are imported by hook entrypoints, but Claude Code
      // never fires them directly, so they have no SETTINGS_HOOKS entry.
      const NON_LIFECYCLE_HOOK_MODULES = new Set([
        // Codex-only dispatcher wired through .codex/config.toml, not Claude SETTINGS_HOOKS.
        'session-codex-start.ts',
        // Codex-only Stop adapter wired through .codex/config.toml, not Claude SETTINGS_HOOKS.
        'stop.ts',
        // Cursor-only wrapper wired through .cursor/hooks.json, not Claude SETTINGS_HOOKS.
        'session-cursor-auto-upgrade.ts',
        'write-review-stamp.ts',
        'resolve-namespace-root.ts',
        'record-skill-invocation.ts',
        'pre-tool-quality-helpers.ts',
      ]);

      // Hook files in ownedFiles (excluding lib/ modules and cursor/ + codex/
      // adapters — those are wired through .cursor/hooks.json and .codex/config.toml
      // respectively, not Claude SETTINGS_HOOKS).
      const hookFiles = Object.keys(SAFEWORD_SCHEMA.ownedFiles)
        .filter(
          path =>
            path.startsWith('.safeword/hooks/') &&
            !path.includes('/lib/') &&
            !path.includes('/cursor/') &&
            !path.includes('/codex/'),
        )
        .map(path => path.split('/').pop())
        .filter(isDefined)
        .filter(file => !NON_LIFECYCLE_HOOK_MODULES.has(file));

      const unwired: string[] = [];
      for (const file of hookFiles) {
        if (!wiredHooks.has(file)) {
          unwired.push(file);
        }
      }

      expect(
        unwired,
        `Hook files in schema but not in SETTINGS_HOOKS: ${unwired.join(', ')}`,
      ).toEqual([]);
    });

    it('should track all deployed .safeword/ files in ownedFiles or deprecatedFiles', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
      const safewordDirectory = nodePath.join(repoRoot, '.safeword');

      // Generated/dynamic files not managed by schema
      const DYNAMIC_FILES = new Set([
        'config.json',
        'version',
        'depcruise-config.cjs',
        'eslint.config.mjs',
        '.prettierrc',
      ]);

      const ownedPaths = new Set(Object.keys(SAFEWORD_SCHEMA.ownedFiles));
      const deprecatedPaths = new Set(SAFEWORD_SCHEMA.deprecatedFiles);
      // preservedDirs (e.g. .safeword/logs) hold runtime/user data the schema
      // intentionally does not own — files under them are not drift.
      const preservedDirectories = SAFEWORD_SCHEMA.preservedDirs;

      function collectFiles(directory: string, prefix: string): string[] {
        const results: string[] = [];
        if (!existsSync(directory)) return results;
        const entries = readdirSync(directory, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const relativePath = `${prefix}/${entry.name}`;
          if (entry.isDirectory()) {
            results.push(...collectFiles(nodePath.join(directory, entry.name), relativePath));
          } else {
            results.push(relativePath);
          }
        }
        return results;
      }

      const deployedFiles = collectFiles(safewordDirectory, '.safeword');

      const untracked: string[] = [];
      for (const file of deployedFiles) {
        const filename = file.split('/').pop() ?? '';
        if (DYNAMIC_FILES.has(filename)) continue;
        if (ownedPaths.has(file)) continue;
        if (deprecatedPaths.has(file)) continue;
        if (preservedDirectories.some(dir => file === dir || file.startsWith(`${dir}/`))) continue;
        untracked.push(file);
      }

      expect(
        untracked,
        `Files in .safeword/ not tracked by schema ownedFiles or deprecatedFiles:\n  ${untracked.join('\n  ')}`,
      ).toEqual([]);
    });
  });
});
