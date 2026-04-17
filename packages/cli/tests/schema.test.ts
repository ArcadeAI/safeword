/**
 * Test Suite: Schema Validation
 *
 * Tests that SAFEWORD_SCHEMA is the single source of truth.
 * Every template file must have a schema entry, no orphans.
 *
 * TDD RED phase - these tests should FAIL until src/schema.ts is implemented.
 */

import { existsSync, readdirSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { ESLINT_PACKAGE } from '../src/packs/typescript/files.js';
import { SETTINGS_HOOKS } from '../src/templates/config.js';

// Type guard for filtering out undefined values
const isDefined = <T>(x: T | undefined): x is T => x !== undefined;

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

  describe('ownedFiles', () => {
    it('should have entry for every template file (template → schema)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const templateFiles = collectTemplateFiles(templatesDirectory);

      // Collect all template: property values from schema
      const schemaTemplatePaths = new Set(
        Object.values(SAFEWORD_SCHEMA.ownedFiles)
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
    it('should include AGENTS.md patch (creates if missing)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const agentsPatch = SAFEWORD_SCHEMA.textPatches['AGENTS.md'];
      expect(agentsPatch).toBeDefined();
      expect(agentsPatch?.operation).toBe('prepend');
      expect(agentsPatch?.createIfMissing).toBe(true);
    });

    it('should include CLAUDE.md patch (only if exists)', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const claudePatch = SAFEWORD_SCHEMA.textPatches['CLAUDE.md'];
      expect(claudePatch).toBeDefined();
      expect(claudePatch?.operation).toBe('prepend');
      expect(claudePatch?.createIfMissing).toBe(false);
    });
  });

  describe('packages', () => {
    it('should include all required base packages', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');
      const required = [
        ESLINT_PACKAGE, // Pinned to v9 until ESLint plugin ecosystem supports v10
        'safeword', // bundles eslint-config-prettier + all ESLint plugins
        'dependency-cruiser',
        'knip',
      ];

      for (const pkg of required) {
        expect(SAFEWORD_SCHEMA.packages.base).toContain(pkg);
      }
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
      const ACTION_SKILLS = new Set(['lint', 'verify', 'audit', 'cleanup-zombies']);
      // Contextual skills without Cursor rule counterparts
      const CLAUDE_ONLY_SKILLS = new Set(['brainstorm', 'tdd-review']);

      // Extract skill names from Claude schema paths (short names: debug, quality-review, refactor)
      const claudeSkills = Object.keys(SAFEWORD_SCHEMA.ownedFiles)
        .filter(path => path.startsWith('.claude/skills/') && path.endsWith('/SKILL.md'))
        .map(path => path.split('/')[2])
        .filter(isDefined)
        // Exclude BDD (split into multiple Cursor rules), action skills, and Claude-only skills
        .filter(name => name !== 'bdd' && !ACTION_SKILLS.has(name) && !CLAUDE_ONLY_SKILLS.has(name))
        .toSorted((a, b) => a.localeCompare(b));

      // Cursor rules still use safeword- prefix, extract the suffix
      const cursorRules = Object.keys(SAFEWORD_SCHEMA.ownedFiles)
        .filter(path => path.startsWith('.cursor/rules/safeword-') && !path.includes('core'))
        .map(path => /safeword-([^.]+)/.exec(path)?.[1])
        .filter(isDefined)
        .toSorted((a, b) => a.localeCompare(b));

      // Cursor rules use gerund names, Claude skills use short names
      const CURSOR_RULE_TO_SKILL: Record<string, string> = {
        debugging: 'debug',
        'quality-reviewing': 'quality-review',
        refactoring: 'refactor',
      };
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
      for (const cmd of claudeCommands) {
        expect(cursorCommands, `Cursor missing Claude command: ${cmd}`).toContain(cmd);
      }
    });
  });

  describe('Drift detection', () => {
    it('should have templates for all local skills', async () => {
      const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
      const skillsDirectory = nodePath.join(repoRoot, '.claude/skills');
      const skillTemplatesDirectory = nodePath.join(import.meta.dirname, '../templates/skills');

      const localSkills = readdirSync(skillsDirectory, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      const missing: string[] = [];
      for (const skill of localSkills) {
        if (!existsSync(nodePath.join(skillTemplatesDirectory, skill))) {
          missing.push(skill);
        }
      }

      expect(missing, `Local skills missing from templates/: ${missing.join(', ')}`).toEqual([]);
    });

    it('should have all hook files wired in SETTINGS_HOOKS', async () => {
      const { SAFEWORD_SCHEMA } = await import('../src/schema.js');

      // Extract hook filenames from SETTINGS_HOOKS command strings
      const wiredHooks = new Set<string>();
      for (const entries of Object.values(SETTINGS_HOOKS)) {
        for (const entry of entries) {
          for (const hookDefinition of entry.hooks) {
            const match = /\/([^/]+)$/.exec(hookDefinition.command);
            if (match) wiredHooks.add(match[1]);
          }
        }
      }

      // Hook files in ownedFiles (excluding lib/ modules and cursor/ adapters)
      const hookFiles = Object.keys(SAFEWORD_SCHEMA.ownedFiles)
        .filter(
          path =>
            path.startsWith('.safeword/hooks/') &&
            !path.includes('/lib/') &&
            !path.includes('/cursor/'),
        )
        .map(path => path.split('/').pop())
        .filter(isDefined);

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

      function collectFiles(directory: string, prefix: string): string[] {
        const results: string[] = [];
        if (!existsSync(directory)) return results;
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
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
        untracked.push(file);
      }

      expect(
        untracked,
        `Files in .safeword/ not tracked by schema ownedFiles or deprecatedFiles:\n  ${untracked.join('\n  ')}`,
      ).toEqual([]);
    });
  });
});
