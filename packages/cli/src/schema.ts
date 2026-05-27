/**
 * SAFEWORD Schema - Single Source of Truth
 *
 * All files, directories, configurations, and packages managed by safeword
 * are defined here. Commands use this schema via the reconciliation engine.
 *
 * Adding a new file? Add it here and it will be handled by setup/upgrade/reset.
 */

import { golangManagedFiles, golangOwnedFiles } from './packs/golang/files.js';
import { pythonManagedFiles, pythonOwnedFiles } from './packs/python/files.js';
import { rustManagedFiles, rustOwnedFiles } from './packs/rust/files.js';
import { sqlManagedFiles, sqlOwnedFiles } from './packs/sql/files.js';
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
import { generateOwnedPathsModule } from './owned-paths.js';
import type { FileDefinition, JsonMergeDefinition, ManagedFileDefinition } from './packs/types.js';
import { CURSOR_HOOKS, SETTINGS_HOOKS } from './templates/config.js';
import { AGENTS_MD_LINK, CLAUDE_MD_IMPORT_BLOCK } from './templates/content.js';
import { filterOutSafewordHooks } from './utils/hooks.js';
import { MCP_SERVERS } from './utils/install.js';
import { VERSION } from './version.js';

export interface TextPatchDefinition {
  operation: 'prepend' | 'append';
  content: string;
  marker: string; // Used to detect if already applied & for removal
}

export interface ContractDefinition {
  requires: string[]; // Strings that must appear verbatim in the file content
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
  contracts: Record<string, ContractDefinition>; // Files that must contain specific strings (predicate parity)
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
    '.safeword/statusline',
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
    // Brainstorming skill: old safeword-* skill removed (v0.16.0); cursor rule was
    // re-introduced under same name (PR #103) for the new short-name brainstorm skill,
    // so .cursor/rules/safeword-brainstorming.mdc is no longer deprecated.
    '.claude/skills/safeword-brainstorming/SKILL.md',
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
    // CLI reference inlined into SAFEWORD.md (v0.28.0, #112h)
    '.safeword/guides/cli-reference.md',
    // Commands converted to skills (ticket 038)
    '.claude/commands/lint.md',
    '.claude/commands/verify.md',
    '.claude/commands/audit.md',
    '.claude/commands/cleanup-zombies.md',
  ],

  // Packages to uninstall on upgrade (now bundled in safeword/eslint or replaced)
  deprecatedPackages: [
    // Individual ESLint plugins now bundled in safeword/eslint
    '@eslint/js',
    'eslint-plugin-import-x',
    'eslint-import-resolver-typescript',
    'eslint-plugin-sonarjs',
    'eslint-plugin-unicorn',
    'eslint-plugin-boundaries', // replaced by dependency-cruiser
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
    ...sqlOwnedFiles,

    // Hooks - Bash (no Bun dependency, must run before Bun hooks)
    '.safeword/hooks/session-bun-check.sh': {
      template: 'hooks/session-bun-check.sh',
    },

    // Hooks shared library - TypeScript with Bun runtime
    '.safeword/hooks/lib/active-ticket.ts': { template: 'hooks/lib/active-ticket.ts' },
    '.safeword/hooks/lib/re-entry.ts': { template: 'hooks/lib/re-entry.ts' },
    '.safeword/hooks/lib/hierarchy.ts': { template: 'hooks/lib/hierarchy.ts' },
    '.safeword/hooks/lib/lint.ts': { template: 'hooks/lib/lint.ts' },
    '.safeword/hooks/lib/quality.ts': { template: 'hooks/lib/quality.ts' },
    '.safeword/hooks/lib/quality-state.ts': { template: 'hooks/lib/quality-state.ts' },
    '.safeword/hooks/lib/skill-invocation-log.ts': {
      template: 'hooks/lib/skill-invocation-log.ts',
    },
    '.safeword/hooks/lib/parse-annotation.ts': { template: 'hooks/lib/parse-annotation.ts' },
    '.safeword/hooks/lib/ledger-validation.ts': { template: 'hooks/lib/ledger-validation.ts' },
    '.safeword/hooks/lib/scenario-format.ts': { template: 'hooks/lib/scenario-format.ts' },
    '.safeword/hooks/lib/test-runner.ts': { template: 'hooks/lib/test-runner.ts' },
    '.safeword/hooks/lib/update-cache.ts': { template: 'hooks/lib/update-cache.ts' },
    '.safeword/hooks/lib/version.ts': { template: 'hooks/lib/version.ts' },
    '.safeword/hooks/lib/learning-verification-stamps.ts': {
      template: 'hooks/lib/learning-verification-stamps.ts',
    },

    // Generated at setup/upgrade from SAFEWORD_SCHEMA itself — the prefix list
    // the auto-upgrade hook uses to decide which files to stage. See owned-paths.ts.
    '.safeword/hooks/lib/owned-paths.ts': {
      generator: (): string => generateOwnedPathsModule(SAFEWORD_SCHEMA),
    },

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
    '.safeword/hooks/pre-tool-git-bare-fix.sh': {
      template: 'hooks/pre-tool-git-bare-fix.sh',
    },
    '.safeword/hooks/session-auto-upgrade.ts': {
      template: 'hooks/session-auto-upgrade.ts',
    },
    '.safeword/hooks/session-update-check.ts': {
      template: 'hooks/session-update-check.ts',
    },
    '.safeword/hooks/session-cleanup-quality.ts': {
      template: 'hooks/session-cleanup-quality.ts',
    },
    '.safeword/hooks/stop-quality.ts': { template: 'hooks/stop-quality.ts' },
    '.safeword/hooks/stop-reentry.ts': { template: 'hooks/stop-reentry.ts' },
    '.safeword/hooks/session-start-reentry.ts': {
      template: 'hooks/session-start-reentry.ts',
    },
    '.safeword/statusline/reentry.ts': {
      template: 'statusline/reentry.ts',
    },
    '.safeword/hooks/post-tool-sync-learnings.ts': {
      template: 'hooks/post-tool-sync-learnings.ts',
    },

    // Guides
    '.safeword/guides/architecture-guide.md': {
      template: 'guides/architecture-guide.md',
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
    '.claude/skills/bdd/VERIFY.md': {
      template: 'skills/bdd/VERIFY.md',
    },
    '.claude/skills/ticket-system/SKILL.md': {
      template: 'skills/ticket-system/SKILL.md',
    },
    // Claude skills — action commands with disable-model-invocation
    // Skills auto-create /slash-commands, so separate commands are unnecessary
    '.claude/skills/lint/SKILL.md': { template: 'skills/lint/SKILL.md' },
    '.claude/skills/verify/SKILL.md': { template: 'skills/verify/SKILL.md' },
    '.claude/skills/audit/SKILL.md': { template: 'skills/audit/SKILL.md' },
    '.claude/skills/cleanup-zombies/SKILL.md': {
      template: 'skills/cleanup-zombies/SKILL.md',
    },
    // Claude skills — contextual (auto-triggered, no slash command)
    '.claude/skills/brainstorm/SKILL.md': {
      template: 'skills/brainstorm/SKILL.md',
    },
    '.claude/skills/elicit/SKILL.md': {
      template: 'skills/elicit/SKILL.md',
    },
    '.claude/skills/tdd-review/SKILL.md': {
      template: 'skills/tdd-review/SKILL.md',
    },
    '.claude/skills/figure-it-out/SKILL.md': {
      template: 'skills/figure-it-out/SKILL.md',
    },

    // Cursor rules
    '.cursor/rules/safeword-core.mdc': {
      template: 'cursor/rules/safeword-core.mdc',
    },
    '.cursor/rules/safeword-brainstorming.mdc': {
      template: 'cursor/rules/safeword-brainstorming.mdc',
    },
    '.cursor/rules/safeword-debugging.mdc': {
      template: 'cursor/rules/safeword-debugging.mdc',
    },
    '.cursor/rules/safeword-elicitation.mdc': {
      template: 'cursor/rules/safeword-elicitation.mdc',
    },
    '.cursor/rules/safeword-figure-it-out.mdc': {
      template: 'cursor/rules/safeword-figure-it-out.mdc',
    },
    '.cursor/rules/safeword-quality-reviewing.mdc': {
      template: 'cursor/rules/safeword-quality-reviewing.mdc',
    },
    '.cursor/rules/safeword-refactoring.mdc': {
      template: 'cursor/rules/safeword-refactoring.mdc',
    },
    '.cursor/rules/safeword-tdd-review.mdc': {
      template: 'cursor/rules/safeword-tdd-review.mdc',
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
    // SQL managed files (.sqlfluff)
    ...sqlManagedFiles,

    // Project personas — scaffolded once with format header + commented example;
    // user authors real persona blocks thereafter (safeword reads, never overwrites
    // user content). See ticket 7YN5QB. `configKey: 'personas'` lets the user
    // redirect via `paths.personas` in .safeword/config.json — when set, reconcile
    // skips this entry uniformly (see ticket K7N2QM).
    '.safeword-project/personas.md': {
      template: 'personas-template.md',
      configKey: 'personas',
    },
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
    },
    'CLAUDE.md': {
      operation: 'prepend',
      // Uses `@` import syntax so SAFEWORD.md inlines into CLAUDE.md's
      // compaction-resistant context (vs. AGENTS.md's prose, which is for
      // non-Claude agents reading the file directly).
      content: CLAUDE_MD_IMPORT_BLOCK,
      // Marker is the `@` import line itself so upgrades from v0.29.0 and
      // earlier (which prepended prose containing `.safeword/SAFEWORD.md` in
      // backticks) still trigger prepending the new `@` import block on top.
      // Existing prose lingers harmlessly — agents skim it; only the import
      // is functionally load-bearing.
      marker: '@./.safeword/SAFEWORD.md',
    },
    '.gitignore': {
      operation: 'append',
      content:
        '\n# Safeword - Local cache and transient state\n.safeword/.update-cache.json\n.safeword-project/quality-state*.json\n',
      marker: '.safeword/.update-cache.json',
    },
    // Prettier ignores: safeword owns .safeword/ and .cursor/ (see ownedDirs).
    // Without this, `prettier --write .` would reformat hooks and Cursor rules;
    // owned-file overwrite on upgrade is the only other defense. Biome/eslint
    // already exclude .safeword/ via their own configs but don't need .cursor/
    // (JS-only linters; cursor holds .mdc/.md).
    //
    // Marker is intentionally specific (not just "# Safeword") to avoid
    // false-positive skips on customers who happen to have a `# Safeword`
    // comment for unrelated reasons.
    '.prettierignore': {
      operation: 'append',
      content: '\n# Safeword - managed prettier exclusions\n.safeword/\n.cursor/\n',
      marker: '# Safeword - managed prettier exclusions',
    },
  },

  // Content predicate parity — files that must contain specific strings.
  // Different from ownedFiles (which requires byte equality between two files):
  // contracts assert one-way "this file must include these tokens" invariants.
  // Used by runParity() in src/parity.ts for both release tests and pre-commit
  // (see ticket 144). Path key = file relative to repo root.
  contracts: {
    'packages/cli/templates/hooks/lib/quality.ts': {
      // Cursor's stop hook imports QUALITY_REVIEW_MESSAGE. The export must exist
      // or Cursor users get a broken hook. The four marker strings (CONFIDENT,
      // BLOCKED, Tried:, Need:) define the binary-terminal shape from ticket 143.
      // Removing any of them would silently regress the prompt back to legacy
      // free-form review.
      requires: ['QUALITY_REVIEW_MESSAGE', 'CONFIDENT', 'BLOCKED', 'Tried:', 'Need:'],
    },
    'packages/cli/templates/doc-templates/test-definitions-feature.md': {
      // Canonical test-definitions.md format. Rule grouping (Gherkin 6+
      // Rule: keyword, Example Mapping alignment) + nested Scenario with
      // Given/When/Then + per-scenario RED/GREEN/REFACTOR sub-checkboxes.
      // The R/G/R checkboxes are load-bearing: parseTddStep in
      // hooks/lib/active-ticket.ts depends on them to inject TDD-step
      // guidance during Phase 6 implement. Removing any marker silently
      // regresses the format the BDD skill teaches.
      requires: [
        '## Rule:',
        '### Scenario:',
        'Given',
        'When',
        'Then',
        '- [ ] RED',
        '- [ ] GREEN',
        '- [ ] REFACTOR',
      ],
    },
    'packages/cli/templates/hooks/lib/scenario-format.ts': {
      // Runtime gate that powers done-phase scenario-completeness checks
      // (stop-quality.ts) and progress reporting. analyzeScenarioFormat is
      // imported by the stop hook; isUnrecognized distinguishes "no
      // scenarios yet" from "scenarios in legacy/malformed format" so the
      // done gate can hard-block the latter. Removing either silently
      // regresses scenario-completeness enforcement.
      requires: ['analyzeScenarioFormat', 'isUnrecognized', 'export function'],
    },
  },

  // NPM packages to install (JS/TS specific packages from typescript pack)
  packages: typescriptPackages,
};
