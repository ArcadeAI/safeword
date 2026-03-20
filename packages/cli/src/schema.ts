/**
 * SAFEWORD Schema - Single Source of Truth
 *
 * All files, directories, configurations, and packages managed by safeword
 * are defined here. Commands use this schema via the reconciliation engine.
 *
 * Adding a new file? Add it here and it will be handled by setup/upgrade/reset.
 */

import { dbtManagedFiles, dbtOwnedFiles } from './packs/dbt/files.js';
import { golangManagedFiles, golangOwnedFiles } from './packs/golang/files.js';
import { pythonManagedFiles, pythonOwnedFiles } from './packs/python/files.js';
import { rustManagedFiles, rustOwnedFiles } from './packs/rust/files.js';
import {
  typescriptJsonMerges,
  typescriptManagedFiles,
  typescriptOwnedFiles,
  typescriptPackages,
} from './packs/typescript/files.js';
// Re-export shared types from packs/types.ts (breaks circular dependency)
export type {
  FileDefinition,
  JsonMergeDefinition,
  ManagedFileDefinition,
  ProjectContext,
} from './packs/types.js';
import type { FileDefinition, JsonMergeDefinition, ManagedFileDefinition } from './packs/types.js';
import { CURSOR_HOOKS, SETTINGS_HOOKS } from './templates/config.js';
import { AGENTS_MD_LINK } from './templates/content.js';
import { filterOutSafewordHooks } from './utils/hooks.js';
import { MCP_SERVERS } from './utils/install.js';
import { VERSION } from './version.js';

export interface TextPatchDefinition {
  operation: 'prepend' | 'append';
  content: string;
  marker: string; // Used to detect if already applied & for removal
  createIfMissing: boolean;
}

export interface SafewordSchema {
  version: string;
  ownedDirs: string[]; // Fully owned - create on setup, delete on reset
  sharedDirs: string[]; // We add to but don't own
  preservedDirs: string[]; // Created on setup, NOT deleted on reset (user data)
  deprecatedFiles: string[]; // Files to delete on upgrade (renamed or removed)
  deprecatedPackages: string[]; // Packages to uninstall on upgrade (consolidated into safeword plugin)
  deprecatedDirs: string[]; // Directories to delete on upgrade (no longer managed)
  ownedFiles: Record<string, FileDefinition>; // Overwrite on upgrade (if changed)
  managedFiles: Record<string, ManagedFileDefinition>; // Create if missing, update if safeword content
  jsonMerges: Record<string, JsonMergeDefinition>;
  textPatches: Record<string, TextPatchDefinition>;
  packages: {
    base: string[];
    conditional: Record<string, string[]>;
  };
}

// ============================================================================
// Shared JSON Merge Definitions
// ============================================================================

/**
 * MCP servers JSON merge - shared between .mcp.json and .cursor/mcp.json
 */
const MCP_JSON_MERGE: JsonMergeDefinition = {
  keys: ['mcpServers.context7', 'mcpServers.playwright'],
  removeFileIfEmpty: true,
  merge: existing => {
    const mcpServers = (existing.mcpServers as Record<string, unknown>) ?? {};
    return {
      ...existing,
      mcpServers: {
        ...mcpServers,
        context7: MCP_SERVERS.context7,
        playwright: MCP_SERVERS.playwright,
      },
    };
  },
  unmerge: existing => {
    const result = { ...existing };
    const mcpServers = { ...(existing.mcpServers as Record<string, unknown>) };

    delete mcpServers.context7;
    delete mcpServers.playwright;

    if (Object.keys(mcpServers).length > 0) {
      result.mcpServers = mcpServers;
    } else {
      delete result.mcpServers;
    }

    return result;
  },
};

// ============================================================================
// SAFEWORD_SCHEMA - The Single Source of Truth
// ============================================================================

export const SAFEWORD_SCHEMA: SafewordSchema = {
  version: VERSION,

  // Directories fully owned by safeword (created on setup, deleted on reset)
  ownedDirs: [
    '.safeword',
    '.safeword/hooks',
    '.safeword/hooks/cursor',
    '.safeword/hooks/lib',
    '.safeword/guides',
    '.safeword/templates',
    '.safeword/prompts',
    '.safeword/scripts',
    '.cursor',
    '.cursor/rules',
    '.cursor/commands',
  ],

  // Directories we add to but don't own (not deleted on reset)
  sharedDirs: ['.claude', '.claude/skills', '.claude/commands'],

  // Created on setup but NOT deleted on reset (preserves user data)
  preservedDirs: [
    '.safeword-project/learnings',
    '.safeword/logs',
    '.safeword-project/tickets',
    '.safeword-project/tickets/completed',
    '.safeword-project/tmp',
  ],

  // Files to delete on upgrade (renamed or removed in newer versions)
  deprecatedFiles: [
    '.safeword/templates/user-stories-template.md',
    // Consolidated into planning-guide.md and testing-guide.md (v0.8.0)
    '.safeword/guides/development-workflow.md',
    '.safeword/guides/tdd-best-practices.md',
    '.safeword/guides/user-story-guide.md',
    '.safeword/guides/test-definitions-guide.md',
    // Boundaries config now project-specific (v0.9.0)
    '.safeword/eslint-boundaries.config.mjs',
    // Shell hooks replaced with TypeScript/Bun (v0.13.0)
    '.safeword/hooks/session-verify-agents.sh',
    '.safeword/hooks/session-version.sh',
    '.safeword/hooks/session-lint-check.sh',
    '.safeword/hooks/prompt-timestamp.sh',
    '.safeword/hooks/prompt-questions.sh',
    '.safeword/hooks/post-tool-lint.sh',
    '.safeword/hooks/stop-quality.sh',
    '.safeword/hooks/cursor/after-file-edit.sh',
    '.safeword/hooks/cursor/stop.sh',
    // Shell libraries no longer needed with Bun
    '.safeword/lib/common.sh',
    '.safeword/lib/jq-fallback.sh',
    // Skill renamed from enforcing-tdd to tdd-enforcing (v0.16.0)
    '.claude/skills/safeword-enforcing-tdd/SKILL.md',
    '.cursor/rules/safeword-enforcing-tdd.mdc',
    // TDD skill and command removed - BDD skill includes full TDD in Phase 6 (v0.16.0)
    '.claude/skills/safeword-tdd-enforcing/SKILL.md',
    '.cursor/rules/safeword-tdd-enforcing.mdc',
    '.claude/commands/tdd.md',
    '.cursor/commands/tdd.md',
    // BDD skill split into phase files (v0.16.0)
    '.cursor/rules/safeword-bdd-orchestrating.mdc',
    '.safeword/commands/tdd.md',
    // Brainstorming skill removed - never used, BDD discovery phase covers this (v0.16.0)
    '.claude/skills/safeword-brainstorming/SKILL.md',
    '.cursor/rules/safeword-brainstorming.mdc',
    // Writing-plans skill removed - redundant with BDD decomposition + Claude Code native plan mode (v0.16.0)
    '.claude/skills/safeword-writing-plans/SKILL.md',
    '.cursor/rules/safeword-writing-plans.mdc',
    // Skills renamed from safeword-* to short names, overlapping commands removed (v0.17.0)
    '.claude/skills/safeword-debugging/SKILL.md',
    '.claude/skills/safeword-quality-reviewing/SKILL.md',
    '.claude/skills/safeword-refactoring/SKILL.md',
    '.claude/skills/safeword-bdd-orchestrating/SKILL.md',
    '.claude/skills/safeword-bdd-orchestrating/DISCOVERY.md',
    '.claude/skills/safeword-bdd-orchestrating/SCENARIOS.md',
    '.claude/skills/safeword-bdd-orchestrating/DECOMPOSITION.md',
    '.claude/skills/safeword-bdd-orchestrating/TDD.md',
    '.claude/skills/safeword-bdd-orchestrating/DONE.md',
    '.claude/skills/safeword-bdd-orchestrating/SPLITTING.md',
    // Command for debug was never a standalone command before v0.17.0 (always a skill)
    // /done renamed to /verify (v0.20.0)
    '.claude/commands/done.md',
    '.cursor/commands/done.md',
    // Shim commands removed — skills auto-create /slash-commands (v0.22.0)
    '.claude/commands/bdd.md',
    '.claude/commands/debug.md',
    '.claude/commands/quality-review.md',
    '.claude/commands/refactor.md',
    '.claude/commands/testing.md',
  ],

  // Packages to uninstall on upgrade (now bundled in safeword/eslint)
  deprecatedPackages: [
    // Individual ESLint plugins now bundled in safeword/eslint
    '@eslint/js',
    'eslint-plugin-import-x',
    'eslint-import-resolver-typescript',
    'eslint-plugin-sonarjs',
    'eslint-plugin-unicorn',
    'eslint-plugin-boundaries',
    'eslint-plugin-playwright',
    'eslint-plugin-promise',
    'eslint-plugin-regexp',
    'eslint-plugin-jsdoc',
    'eslint-plugin-simple-import-sort',
    'eslint-plugin-security',
    // Conditional ESLint plugins now in safeword
    'typescript-eslint',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',
    'eslint-plugin-jsx-a11y',
    '@next/eslint-plugin-next',
    'eslint-plugin-astro',
    '@vitest/eslint-plugin',
  ],

  // Directories to delete on upgrade (no longer managed by safeword)
  deprecatedDirs: [
    '.safeword/lib', // Shell libraries no longer needed with Bun (v0.13.0)
    '.safeword/planning', // Moved to .safeword-project/tickets/ (v0.16.0)
    '.safeword/tickets', // Moved to .safeword-project/tickets/ (v0.16.0)
    '.claude/skills/safeword-enforcing-tdd', // Renamed to safeword-tdd-enforcing (v0.16.0)
    '.claude/skills/safeword-tdd-enforcing', // Removed - BDD includes TDD (v0.16.0)
    '.claude/skills/safeword-brainstorming', // Removed - BDD discovery phase covers this (v0.16.0)
    '.claude/skills/safeword-writing-plans', // Removed - redundant with BDD + native plan mode (v0.16.0)
    // Skills renamed from safeword-* to short names (v0.17.0)
    '.claude/skills/safeword-debugging',
    '.claude/skills/safeword-quality-reviewing',
    '.claude/skills/safeword-refactoring',
    '.claude/skills/safeword-bdd-orchestrating',
  ],

  // Files owned by safeword (overwritten on upgrade if content changed)
  ownedFiles: {
    // Project root config files (for audit/quality tools)
    '.jscpd.json': { template: '.jscpd.json' },
    // Note: knip.json is in typescriptManagedFiles (with context-aware ignoreDependencies)

    // Core files
    '.safeword/AGENTS.md': { template: 'AGENTS.md' },
    '.safeword/SAFEWORD.md': { template: 'SAFEWORD.md' },
    '.safeword/version': { content: () => VERSION },
    // config.json is created by packs system but needs to be registered for cleanup on uninstall
    // Generator returns undefined = never created/updated by schema, but still deleted on uninstall
    '.safeword/config.json': { generator: (): undefined => undefined },

    // Language-specific safeword configs for hooks (extend project configs if they exist)
    ...typescriptOwnedFiles,
    ...pythonOwnedFiles,
    ...golangOwnedFiles,
    ...rustOwnedFiles,
    ...dbtOwnedFiles,

    // Hooks - Bash (no Bun dependency, must run before Bun hooks)
    '.safeword/hooks/session-bun-check.sh': {
      template: 'hooks/session-bun-check.sh',
    },

    // Hooks shared library - TypeScript with Bun runtime
    '.safeword/hooks/lib/active-ticket.ts': { template: 'hooks/lib/active-ticket.ts' },
    '.safeword/hooks/lib/hierarchy.ts': { template: 'hooks/lib/hierarchy.ts' },
    '.safeword/hooks/lib/lint.ts': { template: 'hooks/lib/lint.ts' },
    '.safeword/hooks/lib/quality.ts': { template: 'hooks/lib/quality.ts' },
    '.safeword/hooks/lib/quality-state.ts': { template: 'hooks/lib/quality-state.ts' },

    // Hooks - TypeScript with Bun runtime
    '.safeword/hooks/session-verify-agents.ts': {
      template: 'hooks/session-verify-agents.ts',
    },
    '.safeword/hooks/session-version.ts': {
      template: 'hooks/session-version.ts',
    },
    '.safeword/hooks/session-lint-check.ts': {
      template: 'hooks/session-lint-check.ts',
    },
    '.safeword/hooks/session-compact-context.ts': {
      template: 'hooks/session-compact-context.ts',
    },
    '.safeword/hooks/prompt-timestamp.ts': {
      template: 'hooks/prompt-timestamp.ts',
    },
    '.safeword/hooks/prompt-questions.ts': {
      template: 'hooks/prompt-questions.ts',
    },
    '.safeword/hooks/post-tool-lint.ts': {
      template: 'hooks/post-tool-lint.ts',
    },
    '.safeword/hooks/post-tool-quality.ts': {
      template: 'hooks/post-tool-quality.ts',
    },
    '.safeword/hooks/post-tool-bypass-warn.ts': {
      template: 'hooks/post-tool-bypass-warn.ts',
    },
    '.safeword/hooks/pre-tool-quality.ts': {
      template: 'hooks/pre-tool-quality.ts',
    },
    '.safeword/hooks/pre-tool-config-guard.ts': {
      template: 'hooks/pre-tool-config-guard.ts',
    },
    '.safeword/hooks/session-cleanup-quality.ts': {
      template: 'hooks/session-cleanup-quality.ts',
    },
    '.safeword/hooks/stop-quality.ts': { template: 'hooks/stop-quality.ts' },

    // Guides
    '.safeword/guides/architecture-guide.md': {
      template: 'guides/architecture-guide.md',
    },
    '.safeword/guides/cli-reference.md': {
      template: 'guides/cli-reference.md',
    },
    '.safeword/guides/context-files-guide.md': {
      template: 'guides/context-files-guide.md',
    },
    '.safeword/guides/data-architecture-guide.md': {
      template: 'guides/data-architecture-guide.md',
    },
    '.safeword/guides/design-doc-guide.md': {
      template: 'guides/design-doc-guide.md',
    },
    '.safeword/guides/learning-extraction.md': {
      template: 'guides/learning-extraction.md',
    },
    '.safeword/guides/llm-writing-guide.md': {
      template: 'guides/llm-writing-guide.md',
    },
    '.safeword/guides/planning-guide.md': {
      template: 'guides/planning-guide.md',
    },
    '.safeword/guides/testing-guide.md': {
      template: 'guides/testing-guide.md',
    },
    '.safeword/guides/zombie-process-cleanup.md': {
      template: 'guides/zombie-process-cleanup.md',
    },

    // Templates
    '.safeword/templates/architecture-template.md': {
      template: 'doc-templates/architecture-template.md',
    },
    '.safeword/templates/design-doc-template.md': {
      template: 'doc-templates/design-doc-template.md',
    },
    '.safeword/templates/task-spec-template.md': {
      template: 'doc-templates/task-spec-template.md',
    },
    '.safeword/templates/test-definitions-feature.md': {
      template: 'doc-templates/test-definitions-feature.md',
    },
    '.safeword/templates/ticket-template.md': {
      template: 'doc-templates/ticket-template.md',
    },
    '.safeword/templates/feature-spec-template.md': {
      template: 'doc-templates/feature-spec-template.md',
    },
    '.safeword/templates/work-log-template.md': {
      template: 'doc-templates/work-log-template.md',
    },

    // Prompts
    '.safeword/prompts/architecture.md': {
      template: 'prompts/architecture.md',
    },

    // Scripts
    '.safeword/scripts/bisect-test-pollution.sh': {
      template: 'scripts/bisect-test-pollution.sh',
    },
    '.safeword/scripts/bisect-zombie-processes.sh': {
      template: 'scripts/bisect-zombie-processes.sh',
    },
    '.safeword/scripts/cleanup-zombies.sh': {
      template: 'scripts/cleanup-zombies.sh',
    },

    // Claude skills (short names, auto-trigger + explicit invocation)
    '.claude/skills/debug/SKILL.md': {
      template: 'skills/debug/SKILL.md',
    },
    '.claude/skills/quality-review/SKILL.md': {
      template: 'skills/quality-review/SKILL.md',
    },
    '.claude/skills/refactor/SKILL.md': {
      template: 'skills/refactor/SKILL.md',
    },
    '.claude/skills/testing/SKILL.md': {
      template: 'skills/testing/SKILL.md',
    },
    '.claude/skills/bdd/SKILL.md': {
      template: 'skills/bdd/SKILL.md',
    },
    '.claude/skills/bdd/DISCOVERY.md': {
      template: 'skills/bdd/DISCOVERY.md',
    },
    '.claude/skills/bdd/SCENARIOS.md': {
      template: 'skills/bdd/SCENARIOS.md',
    },
    '.claude/skills/bdd/DECOMPOSITION.md': {
      template: 'skills/bdd/DECOMPOSITION.md',
    },
    '.claude/skills/bdd/TDD.md': {
      template: 'skills/bdd/TDD.md',
    },
    '.claude/skills/bdd/DONE.md': {
      template: 'skills/bdd/DONE.md',
    },
    '.claude/skills/bdd/SPLITTING.md': {
      template: 'skills/bdd/SPLITTING.md',
    },
    '.claude/skills/ticket-system/SKILL.md': {
      template: 'skills/ticket-system/SKILL.md',
    },
    // Claude commands — only standalone commands that have no matching skill
    // Skills auto-create /slash-commands, so shim commands are redundant
    '.claude/commands/verify.md': { template: 'commands/verify.md' },
    '.claude/commands/audit.md': { template: 'commands/audit.md' },
    '.claude/commands/cleanup-zombies.md': {
      template: 'commands/cleanup-zombies.md',
    },
    '.claude/commands/lint.md': { template: 'commands/lint.md' },

    // Cursor rules
    '.cursor/rules/safeword-core.mdc': {
      template: 'cursor/rules/safeword-core.mdc',
    },
    '.cursor/rules/safeword-debugging.mdc': {
      template: 'cursor/rules/safeword-debugging.mdc',
    },
    '.cursor/rules/safeword-quality-reviewing.mdc': {
      template: 'cursor/rules/safeword-quality-reviewing.mdc',
    },
    '.cursor/rules/safeword-refactoring.mdc': {
      template: 'cursor/rules/safeword-refactoring.mdc',
    },
    '.cursor/rules/safeword-testing.mdc': {
      template: 'cursor/rules/safeword-testing.mdc',
    },
    '.cursor/rules/safeword-ticket-system.mdc': {
      template: 'cursor/rules/safeword-ticket-system.mdc',
    },
    '.cursor/rules/bdd-core.mdc': {
      template: 'cursor/rules/bdd-core.mdc',
    },
    '.cursor/rules/bdd-discovery.mdc': {
      template: 'cursor/rules/bdd-discovery.mdc',
    },
    '.cursor/rules/bdd-scenarios.mdc': {
      template: 'cursor/rules/bdd-scenarios.mdc',
    },
    '.cursor/rules/bdd-decomposition.mdc': {
      template: 'cursor/rules/bdd-decomposition.mdc',
    },
    '.cursor/rules/bdd-tdd.mdc': {
      template: 'cursor/rules/bdd-tdd.mdc',
    },
    '.cursor/rules/bdd-done.mdc': {
      template: 'cursor/rules/bdd-done.mdc',
    },
    '.cursor/rules/bdd-splitting.mdc': {
      template: 'cursor/rules/bdd-splitting.mdc',
    },

    // Cursor commands (8 files - Cursor needs explicit commands for all capabilities)
    '.cursor/commands/bdd.md': { template: 'commands/bdd.md' },
    '.cursor/commands/debug.md': { template: 'commands/debug.md' },
    '.cursor/commands/verify.md': { template: 'commands/verify.md' },
    '.cursor/commands/audit.md': { template: 'commands/audit.md' },
    '.cursor/commands/cleanup-zombies.md': {
      template: 'commands/cleanup-zombies.md',
    },
    '.cursor/commands/lint.md': { template: 'commands/lint.md' },
    '.cursor/commands/quality-review.md': {
      template: 'commands/quality-review.md',
    },
    '.cursor/commands/refactor.md': { template: 'commands/refactor.md' },
    '.cursor/commands/testing.md': { template: 'commands/testing.md' },

    // Cursor hooks adapters - TypeScript with Bun runtime
    '.safeword/hooks/cursor/after-file-edit.ts': {
      template: 'hooks/cursor/after-file-edit.ts',
    },
    '.safeword/hooks/cursor/stop.ts': { template: 'hooks/cursor/stop.ts' },
  },

  // Files created if missing, updated only if content matches current template
  managedFiles: {
    // TypeScript/JavaScript managed files (ESLint, tsconfig, Knip, Prettier configs)
    ...typescriptManagedFiles,
    // Python managed files (ruff.toml, mypy.ini, .importlinter)
    ...pythonManagedFiles,
    // Go managed files (.golangci.yml)
    ...golangManagedFiles,
    // Rust managed files (clippy.toml, rustfmt.toml)
    ...rustManagedFiles,
    // dbt managed files (.sqlfluff)
    ...dbtManagedFiles,
  },

  // JSON files where we merge specific keys
  jsonMerges: {
    // TypeScript/JavaScript JSON merges (package.json, .prettierrc, biome.json)
    ...typescriptJsonMerges,

    // Language-agnostic JSON merges
    '.claude/settings.json': {
      keys: ['hooks'],
      merge: existing => {
        // Preserve non-safeword hooks while adding/updating safeword hooks
        const existingHooks = (existing.hooks as Record<string, unknown[]>) ?? {};
        const mergedHooks: Record<string, unknown[]> = { ...existingHooks };

        for (const [event, newHooks] of Object.entries(SETTINGS_HOOKS)) {
          const eventHooks = mergedHooks[event] ?? [];
          const nonSafewordHooks = filterOutSafewordHooks(eventHooks);
          mergedHooks[event] = [...nonSafewordHooks, ...newHooks];
        }

        return { ...existing, hooks: mergedHooks };
      },
      unmerge: existing => {
        // Remove only safeword hooks, preserve custom hooks
        const existingHooks = (existing.hooks as Record<string, unknown[]>) ?? {};
        const cleanedHooks: Record<string, unknown[]> = {};

        for (const [event, eventHooks] of Object.entries(existingHooks)) {
          const nonSafewordHooks = filterOutSafewordHooks(eventHooks);
          if (nonSafewordHooks.length > 0) {
            cleanedHooks[event] = nonSafewordHooks;
          }
        }

        const result = { ...existing };
        if (Object.keys(cleanedHooks).length > 0) {
          result.hooks = cleanedHooks;
        } else {
          delete result.hooks;
        }
        return result;
      },
    },

    '.mcp.json': MCP_JSON_MERGE,
    '.cursor/mcp.json': MCP_JSON_MERGE,

    '.cursor/hooks.json': {
      keys: ['version', 'hooks.afterFileEdit', 'hooks.stop'],
      removeFileIfEmpty: true,
      merge: existing => {
        const hooks = (existing.hooks as Record<string, unknown[]>) ?? {};
        return {
          ...existing,
          version: 1, // Required by Cursor
          hooks: {
            ...hooks,
            ...CURSOR_HOOKS,
          },
        };
      },
      unmerge: existing => {
        const result = { ...existing };
        const hooks = { ...(existing.hooks as Record<string, unknown[]>) };

        delete hooks.afterFileEdit;
        delete hooks.stop;

        if (Object.keys(hooks).length > 0) {
          result.hooks = hooks;
        } else {
          delete result.hooks;
          delete result.version;
        }

        return result;
      },
    },
  },

  // Text files where we patch specific content
  textPatches: {
    'AGENTS.md': {
      operation: 'prepend',
      content: AGENTS_MD_LINK,
      marker: '.safeword/SAFEWORD.md',
      createIfMissing: true,
    },
    'CLAUDE.md': {
      operation: 'prepend',
      content: AGENTS_MD_LINK,
      marker: '.safeword/SAFEWORD.md',
      createIfMissing: false, // Only patch if exists, don't create (AGENTS.md is primary)
    },
  },

  // NPM packages to install (JS/TS specific packages from typescript pack)
  packages: typescriptPackages,
};
