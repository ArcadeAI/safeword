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
import { CURSOR_COMMAND_WRAPPERS, CURSOR_RULE_WRAPPERS } from './cursor-wrappers.js';
import {
  dirGlobExcludeMerge,
  generateOwnedPathsModule,
  resolvedIgnoreDirectories,
  resolvedNamespaceDirectory,
} from './owned-paths.js';
import type {
  FileDefinition,
  JsonMergeDefinition,
  ManagedFileDefinition,
  ProjectContext,
} from './packs/types.js';
import { CURSOR_HOOKS, SETTINGS_HOOKS } from './templates/config.js';
import { AGENTS_MD_LINK, CLAUDE_MD_IMPORT_BLOCK } from './templates/content.js';
import { filterOutSafewordHooks } from './utils/hooks.js';
import { MCP_SERVERS } from './utils/install.js';
import { assignOrPrune } from './utils/json-merge.js';
import { VERSION } from './version.js';

export interface TextPatchDefinition {
  operation: 'prepend' | 'append';
  // Static string, or a factory resolved with ctx at plan time so the block can
  // depend on the resolved namespace root (e.g. a custom paths.projectRoot, #293).
  content: string | ((ctx: ProjectContext) => string);
  marker: string; // Used to detect if already applied & for removal
  // On apply, first remove this exact legacy block if present, then add `content`
  // — a byte-exact, idempotent one-block swap for migrating a managed file (e.g.
  // replacing a superseded SessionStart hook with its replacement) without a
  // separate imperative path. A no-op when the block is absent; guarded by
  // applyWhenContentIncludes so it only touches safeword-scaffolded files.
  supersedes?: string;
  applyWhenContentIncludes?: string[]; // Optional guard for semi-owned config files
  unpatchContent?: string[]; // Additional exact blocks to remove on uninstall/reset
  removeFileIfContentEquals?: string[]; // Delete file only when remaining content is known scaffold
  // When set (append patches only), re-render the managed block in place on
  // upgrade instead of skip-on-marker — so a ctx-dependent block (e.g. a custom
  // projectRoot added to .prettierignore) heals on existing installs. A no-op
  // when the block is already current, so unchanged installs never churn (#293).
  rerender?: boolean;
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
  // A file may carry an ordered list of patches (e.g. .codex/config.toml's hook
  // retrofit + MCP-server retrofit). Patches apply in list order and unpatch in
  // reverse, so the patch that owns file removal (removeFileIfContentEquals)
  // runs last on uninstall. See #269.
  textPatches: Record<string, TextPatchDefinition | TextPatchDefinition[]>;
  legacyTextPatches: Record<string, TextPatchDefinition>; // Remove old managed text patches without installing them
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
    const mcpServers = { ...(existing.mcpServers as Record<string, unknown>) };
    // Add-if-missing: preserve any user-authored entry — including its key
    // ordering — and inject safeword's default only when the server key is
    // absent. This keeps `upgrade` from clobbering a customized
    // context7/playwright definition (e.g. a hosted HTTP transport), and
    // spreading existing first means an already-correct file produces an
    // identical merge (no write churn). (#255)
    mcpServers.context7 ??= MCP_SERVERS.context7;
    mcpServers.playwright ??= MCP_SERVERS.playwright;
    return { ...existing, mcpServers };
  },
  unmerge: existing => {
    const result = { ...existing };
    const mcpServers = { ...(existing.mcpServers as Record<string, unknown>) };

    // Blind-delete on uninstall: removing the server names safeword introduced
    // is the predictable inverse of install and matches the package.json /
    // .cursor/hooks.json unmerges. A value-match "delete-if-ours" was
    // considered but rejected — it can't tell a user customization from a
    // server installed by an older safeword version (different default value),
    // so it would orphan stale entries. uninstall is an explicit destructive
    // action; #255 is about upgrade not clobbering, which the merge handles.
    delete mcpServers.context7;
    delete mcpServers.playwright;

    assignOrPrune(result, 'mcpServers', mcpServers);
    return result;
  },
};

/**
 * markdownlint-cli2 `ignores` merge — add safeword-owned dirs so a consuming
 * repo's markdownlint never flags safeword's generated agent docs (ticket #262,
 * extends the EYRK34 formatter-ignore family alongside prettier/biome/dprint/oxfmt).
 *
 * Why this and not `.markdownlintignore`: markdownlint-cli2 does NOT read
 * `.markdownlintignore` at all (it's a markdownlint-cli v1 file), and even when a
 * tool honors it, lint-staged passes explicit absolute file paths that bypass
 * ignore-file globbing entirely. The cli2 `ignores` array is the one mechanism
 * that filters files even when passed explicitly — verified against lint-staged's
 * default absolute-path invocation.
 *
 * Glob form (see the call below) prefixes each dir with a leading globstar,
 * unlike the bare trailing-globstar form used by dprint/oxfmt: lint-staged passes
 * absolute paths by default, and the leading globstar is required for the glob to
 * match `/abs/repo/.claude/...`. It also still matches the relative tree-glob and
 * relative-explicit invocations.
 *
 * `ignores` is a cli2-only option, so it lives solely in `.markdownlint-cli2.jsonc`
 * (the standard `.markdownlint.*` rule files have no `ignores` field). `skipIfMissing`
 * → only ever touches a config the customer already has, never imposes markdownlint.
 *
 * Limitation (shared by the sibling biome/dprint/oxfmt `.jsonc` merges): the merge
 * engine parses with `JSON.parse`, so a `.markdownlint-cli2.jsonc` that actually
 * uses comments parses as undefined and `skipIfMissing` makes this a safe no-op —
 * the ignores aren't added, but the customer's commented config is never clobbered.
 * Stripping comments to parse would round-trip the file through `JSON.stringify` and
 * destroy those comments, which is worse than the no-op; comment-preserving JSONC
 * editing is a future improvement for the whole merge engine, not this ticket.
 */
const MARKDOWNLINT_CLI2_IGNORES_MERGE = dirGlobExcludeMerge('ignores', dir => `**/${dir}/**`);

const CODEX_PROMPT_TIMESTAMP_HOOK_PATCH = `
[[hooks.UserPromptSubmit]]

[[hooks.UserPromptSubmit.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/prompt-timestamp.ts"'
timeout = 5
statusMessage = "Adding current timestamp"
`;

export const CODEX_SESSION_START_HOOK_PATCH = `
[[hooks.SessionStart]]
matcher = ""

[[hooks.SessionStart.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/session-codex-start.ts"'
timeout = 120
statusMessage = "Checking safeword updates and loading standing instructions"
`;

export const CODEX_LEGACY_CONTEXT_SESSION_START_HOOK_PATCH = `
[[hooks.SessionStart]]
matcher = ""

[[hooks.SessionStart.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/session-safeword-context.ts" --agent=codex'
timeout = 30
statusMessage = "Loading safeword standing instructions"
`;

const CODEX_PRE_TOOL_QUALITY_HOOK_PATCH = `
[[hooks.PreToolUse]]
matcher = "^(apply_patch|Bash|Edit|Write|MultiEdit|NotebookEdit)$"

[[hooks.PreToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/pre-tool-quality.ts"'
timeout = 30
statusMessage = "Checking safeword PreToolUse gates"
`;

// Edit-only (no Bash): the language-skill nudge fires on source-file edits. Codex
// PostToolUse supports hookSpecificOutput.additionalContext (GA), so the adapter
// forwards the Claude hook's nudge verbatim.
const CODEX_POST_TOOL_SKILL_NUDGE_HOOK_PATCH = `
[[hooks.PostToolUse]]
matcher = "^(apply_patch|Edit|Write|MultiEdit|NotebookEdit)$"

[[hooks.PostToolUse.hooks]]
type = "command"
command = 'bun "$(git rev-parse --show-toplevel)/.safeword/hooks/codex/post-tool-skill-nudge.ts"'
timeout = 30
statusMessage = "Surfacing language-skill guidance"
`;

// MCP servers for Codex parity with .mcp.json / .cursor/mcp.json (#269).
// context7 uses the hosted streamable-HTTP transport (url); playwright uses
// stdio (command/args) — matching MCP_SERVERS. Shipped via the codex/config.toml
// template and re-applied as a retrofit text-patch on upgrade. Must byte-match
// the block appended to that template (exported so tests strip it exactly).
export const CODEX_MCP_SERVERS_BLOCK = `
[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"

[mcp_servers.playwright]
command = "bunx"
args = ["@playwright/mcp@latest"]
`;

const CODEX_CONFIG_SCAFFOLD_WITHOUT_HOOKS = `
# Safeword Codex project configuration.
#
# Project-local Codex config loads only after the project is reviewed and trusted.
# Run Codex's hook trust flow after setup/upgrade before assuming these gates run.

[features]
hooks = true
`;

const CODEX_SKILL_TEMPLATE_FILES = [
  ['audit/SKILL.md', 'skills/audit/SKILL.md'],
  ['bdd/SKILL.md', 'skills/bdd/SKILL.md'],
  ['bdd/DISCOVERY.md', 'skills/bdd/DISCOVERY.md'],
  ['bdd/SCENARIOS.md', 'skills/bdd/SCENARIOS.md'],
  ['bdd/TDD.md', 'skills/bdd/TDD.md'],
  ['bdd/DONE.md', 'skills/bdd/DONE.md'],
  ['bdd/SPLITTING.md', 'skills/bdd/SPLITTING.md'],
  ['bdd/VERIFY.md', 'skills/bdd/VERIFY.md'],
  ['brainstorm/SKILL.md', 'skills/brainstorm/SKILL.md'],
  ['cleanup-zombies/SKILL.md', 'skills/cleanup-zombies/SKILL.md'],
  ['debug/SKILL.md', 'skills/debug/SKILL.md'],
  ['elicit/SKILL.md', 'skills/elicit/SKILL.md'],
  ['explain/SKILL.md', 'skills/explain/SKILL.md'],
  ['figure-it-out/SKILL.md', 'skills/figure-it-out/SKILL.md'],
  ['lint/SKILL.md', 'skills/lint/SKILL.md'],
  ['quality-review/SKILL.md', 'skills/quality-review/SKILL.md'],
  ['refactor/SKILL.md', 'skills/refactor/SKILL.md'],
  ['review-spec/SKILL.md', 'skills/review-spec/SKILL.md'],
  ['self-review/SKILL.md', 'skills/self-review/SKILL.md'],
  ['tdd-review/SKILL.md', 'skills/tdd-review/SKILL.md'],
  ['testing/SKILL.md', 'skills/testing/SKILL.md'],
  ['ticket-system/SKILL.md', 'skills/ticket-system/SKILL.md'],
  ['verify/SKILL.md', 'skills/verify/SKILL.md'],
] as const;

const CODEX_SKILL_DIRS = [
  ...new Set(
    CODEX_SKILL_TEMPLATE_FILES.map(([target]) => `.agents/skills/${target.split('/', 1)[0]}`),
  ),
];

const CODEX_SKILL_OWNED_FILES: Record<string, FileDefinition> = Object.fromEntries(
  CODEX_SKILL_TEMPLATE_FILES.map(([target, template]) => [
    `.agents/skills/${target}`,
    { template },
  ]),
);

const CURSOR_RULE_WRAPPER_OWNED_FILES: Record<string, FileDefinition> = Object.fromEntries(
  CURSOR_RULE_WRAPPERS.map(wrapper => [
    `.cursor/rules/${wrapper.name}.mdc`,
    { template: `cursor/rules/${wrapper.name}.mdc` },
  ]),
);

const CURSOR_COMMAND_WRAPPER_OWNED_FILES: Record<string, FileDefinition> = Object.fromEntries(
  CURSOR_COMMAND_WRAPPERS.map(wrapper => [
    `.cursor/commands/${wrapper.name}.md`,
    { template: `commands/${wrapper.name}.md` },
  ]),
);

// ============================================================================
// SAFEWORD_SCHEMA - The Single Source of Truth
// ============================================================================

/**
 * Transient state files safeword's hooks write under the *resolved namespace
 * root* every turn, as root-relative names (quality-state, failure-counts,
 * skill-invocations, re-entry, dependency-readiness). Single source for both
 * the per-root `.gitignore` managed file (`NAMESPACE_GITIGNORE_CONTENT`) and the
 * repo-root `.gitignore` block (`SAFEWORD_TRANSIENT_PATHS`). Patterns are exact
 * filenames plus the one `quality-state*` glob — never a bare `*` — so durable
 * siblings (tickets/, learnings/, personas.md, glossary.md, surfaces.md) stay tracked.
 */
const NAMESPACE_TRANSIENT_BASENAMES: readonly string[] = [
  'quality-state*.json',
  'cursor-run-identity.json',
  'codex-run-identity.json',
  'failure-counts.json',
  'skill-invocations.log',
  're-entry.md',
  'dependency-readiness.json',
];

/**
 * Runtime/transient state files safeword's hooks write to the working tree
 * every turn (update-cache plus the namespace-root state above). They must be
 * gitignored — and untracked on upgrade if a customer committed them before the
 * ignore rule existed — because the hooks read/write these paths directly, so
 * git tracking is never consulted. Single source for the repo-root managed
 * `.gitignore` block (below) and the upgrade-time untrack.
 *
 * Both well-known namespace roots are listed: hooks write transient state under
 * the resolved root (TAGWZ8), which is `.project/` on fresh installs and
 * `.safeword-project/` on legacy ones. A *custom* `paths.projectRoot` is covered
 * by the per-root `.gitignore` (`NAMESPACE_GITIGNORE_CONTENT`) instead, since a
 * static repo-root block cannot name an arbitrary root (issue #272).
 */
export const SAFEWORD_TRANSIENT_PATHS: readonly string[] = [
  '.safeword/.update-cache.json',
  '.safeword/self-reports/',
  ...['.project', '.safeword-project'].flatMap(root =>
    NAMESPACE_TRANSIENT_BASENAMES.map(name => `${root}/${name}`),
  ),
];

/**
 * Content of the `.gitignore` written *inside* the resolved namespace root
 * (issue #272). Because the ignore rules live with the files they describe, a
 * custom `paths.projectRoot` is handled for free — the file lands wherever the
 * root resolves, and git applies each pattern relative to that directory. The
 * legacy-prefixed managed-file key is remapped to the resolved root by
 * `withResolvedNamespaceRoot`.
 *
 * Patterns are leading-slash-anchored so they match only the transient files at
 * the namespace root — where the hooks write them — and never a same-named file
 * deeper in the tree (e.g. a `tickets/.../re-entry.md`). This mirrors the
 * repo-root block, whose `.project/re-entry.md` entries are likewise anchored.
 */
const NAMESPACE_GITIGNORE_PATTERNS = NAMESPACE_TRANSIENT_BASENAMES.map(name => `/${name}`).join(
  '\n',
);
const NAMESPACE_GITIGNORE_CONTENT = `# Safeword - transient session state (auto-managed)\n${NAMESPACE_GITIGNORE_PATTERNS}\n`;

/**
 * Top-level dirs a customer's prettier must skip so safeword's files don't dirty
 * the tree on install. Derived from the single SAFEWORD_IGNORE_DIRS list (ticket
 * EYRK34) — wholesale dir excludes (not per-file INDEX lines), so all of
 * `.safeword/`, `.claude/`, `.cursor/`, `.codex/`, `.agents/` and both namespace
 * roots are covered — plus husky's generated `_` dir. Previously this listed only
 * the INDEX markdown under each root (TAGWZ8/1GGD28); the whole `.project/` is
 * safeword-generated, so excluding it wholesale also covers tickets and learnings.
 *
 * Resolved per-ctx (issue #293) so a custom `paths.projectRoot` is excluded too —
 * for the two well-known roots this is identical to the old static list, so a
 * default/legacy install's `.prettierignore` block is byte-identical (no churn).
 */
function managedPrettierPaths(ctx: ProjectContext): string[] {
  return ['.husky/_', ...resolvedIgnoreDirectories(ctx).map(dir => `${dir}/`)];
}

// Header line of the managed .prettierignore block — also its marker (re-applied
// and re-rendered against this exact string). The "(owned dirs)" suffix marks the
// post-EYRK34 format; the stable prefix is what stale-config-scan detects.
const PRETTIER_EXCLUSIONS_HEADER = '# Safeword - managed prettier exclusions (owned dirs)';

export const SAFEWORD_SCHEMA: SafewordSchema = {
  version: VERSION,

  // Directories fully owned by safeword (created on setup, deleted on reset)
  ownedDirs: [
    '.safeword',
    '.safeword/hooks',
    '.safeword/hooks/codex',
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
  sharedDirs: [
    '.claude',
    '.claude/skills',
    '.claude/commands',
    '.codex',
    '.agents',
    '.agents/skills',
    ...CODEX_SKILL_DIRS,
  ],

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
    // Replaced by session-safeword-context.ts (P30CRP): safeword no longer edits AGENTS.md.
    '.safeword/hooks/session-verify-agents.ts',
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
    // TDD skill and command removed - BDD skill includes full TDD in the implement phase (v0.16.0)
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
    '.safeword/.gherkin-lintrc',
    // Merged into session-auto-upgrade.ts — check + apply now run in one pass (XQ9CXA)
    '.safeword/hooks/session-update-check.ts',
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
    'gherkin-lint',
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
    // BDD acceptance lane config (ticket 102b) — safeword-owned; the lane's
    // working files (features/, steps/) are customer-owned in managedFiles.
    'cucumber.mjs': { template: 'cucumber/cucumber.mjs' },
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
    '.safeword/hooks/resolve-namespace-root.ts': {
      template: 'hooks/resolve-namespace-root.ts',
    },
    '.safeword/hooks/record-skill-invocation.ts': {
      template: 'hooks/record-skill-invocation.ts',
    },

    // Hooks shared library - TypeScript with Bun runtime
    '.safeword/hooks/lib/active-ticket.ts': { template: 'hooks/lib/active-ticket.ts' },
    '.safeword/hooks/lib/architecture-document-nudge.ts': {
      template: 'hooks/lib/architecture-document-nudge.ts',
    },
    '.safeword/hooks/lib/architecture-staged-scope.ts': {
      template: 'hooks/lib/architecture-staged-scope.ts',
    },
    '.safeword/hooks/lib/branch-staleness.ts': { template: 'hooks/lib/branch-staleness.ts' },
    '.safeword/hooks/lib/blocked-on-gate.ts': { template: 'hooks/lib/blocked-on-gate.ts' },
    '.safeword/hooks/lib/cursor-run-identity.ts': {
      template: 'hooks/lib/cursor-run-identity.ts',
    },
    '.safeword/hooks/lib/git-operation.ts': { template: 'hooks/lib/git-operation.ts' },
    '.safeword/hooks/lib/re-entry.ts': { template: 'hooks/lib/re-entry.ts' },
    '.safeword/hooks/lib/hierarchy.ts': { template: 'hooks/lib/hierarchy.ts' },
    '.safeword/hooks/lib/lint.ts': { template: 'hooks/lib/lint.ts' },
    '.safeword/hooks/lib/quality.ts': { template: 'hooks/lib/quality.ts' },
    '.safeword/hooks/lib/quality-state.ts': { template: 'hooks/lib/quality-state.ts' },
    '.safeword/hooks/lib/run-identity.ts': { template: 'hooks/lib/run-identity.ts' },
    '.safeword/hooks/lib/dependency-readiness.ts': {
      template: 'hooks/lib/dependency-readiness.ts',
    },
    '.safeword/hooks/lib/done-gate.ts': { template: 'hooks/lib/done-gate.ts' },
    '.safeword/hooks/lib/namespace-root.ts': { template: 'hooks/lib/namespace-root.ts' },
    '.safeword/hooks/lib/self-report.ts': { template: 'hooks/lib/self-report.ts' },
    '.safeword/hooks/lib/skill-invocation-log.ts': {
      template: 'hooks/lib/skill-invocation-log.ts',
    },
    '.safeword/hooks/lib/parse-annotation.ts': { template: 'hooks/lib/parse-annotation.ts' },
    '.safeword/hooks/lib/jtbd.ts': { template: 'hooks/lib/jtbd.ts' },
    '.safeword/hooks/lib/impl-plan.ts': { template: 'hooks/lib/impl-plan.ts' },
    '.safeword/hooks/lib/replan-relevance.ts': { template: 'hooks/lib/replan-relevance.ts' },
    '.safeword/hooks/lib/replan.ts': { template: 'hooks/lib/replan.ts' },
    '.safeword/hooks/lib/review-ledger.ts': { template: 'hooks/lib/review-ledger.ts' },
    '.safeword/hooks/lib/lint-config.ts': { template: 'hooks/lib/lint-config.ts' },
    '.safeword/hooks/lib/typecheck-gate.ts': { template: 'hooks/lib/typecheck-gate.ts' },
    '.safeword/hooks/lib/checkbox-transitions.ts': {
      template: 'hooks/lib/checkbox-transitions.ts',
    },
    '.safeword/hooks/lib/review-trigger.ts': { template: 'hooks/lib/review-trigger.ts' },
    '.safeword/hooks/lib/dogfood.ts': { template: 'hooks/lib/dogfood.ts' },
    '.safeword/hooks/lib/ledger-git.ts': { template: 'hooks/lib/ledger-git.ts' },
    '.safeword/hooks/lib/ledger-validation.ts': { template: 'hooks/lib/ledger-validation.ts' },
    '.safeword/hooks/lib/scenario-format.ts': { template: 'hooks/lib/scenario-format.ts' },
    '.safeword/hooks/lib/skill-nudge.ts': { template: 'hooks/lib/skill-nudge.ts' },
    '.safeword/hooks/lib/test-runner.ts': { template: 'hooks/lib/test-runner.ts' },
    '.safeword/hooks/lib/auto-upgrade.ts': { template: 'hooks/lib/auto-upgrade.ts' },
    '.safeword/hooks/lib/auto-upgrade-lock.ts': { template: 'hooks/lib/auto-upgrade-lock.ts' },
    '.safeword/hooks/lib/safeword-context.ts': { template: 'hooks/lib/safeword-context.ts' },
    '.safeword/hooks/lib/update-cache.ts': { template: 'hooks/lib/update-cache.ts' },
    '.safeword/hooks/lib/version.ts': { template: 'hooks/lib/version.ts' },
    '.safeword/hooks/lib/learning-verification-stamps.ts': {
      template: 'hooks/lib/learning-verification-stamps.ts',
    },
    '.safeword/hooks/lib/readiness-pointer.ts': { template: 'hooks/lib/readiness-pointer.ts' },

    // Generated at setup/upgrade from SAFEWORD_SCHEMA itself — the prefix list
    // the auto-upgrade hook uses to decide which files to stage. See owned-paths.ts.
    '.safeword/hooks/lib/owned-paths.ts': {
      generator: (ctx): string =>
        generateOwnedPathsModule(SAFEWORD_SCHEMA, resolvedNamespaceDirectory(ctx)),
    },

    // Hooks - TypeScript with Bun runtime
    '.safeword/hooks/session-safeword-context.ts': {
      template: 'hooks/session-safeword-context.ts',
    },
    '.safeword/hooks/session-codex-start.ts': {
      template: 'hooks/session-codex-start.ts',
    },
    '.safeword/hooks/session-cursor-auto-upgrade.ts': {
      template: 'hooks/session-cursor-auto-upgrade.ts',
    },
    '.safeword/hooks/session-dependency-readiness.ts': {
      template: 'hooks/session-dependency-readiness.ts',
    },
    '.safeword/hooks/session-version.ts': {
      template: 'hooks/session-version.ts',
    },
    '.safeword/hooks/session-lint-check.ts': {
      template: 'hooks/session-lint-check.ts',
    },
    '.safeword/hooks/session-architecture-heal.ts': {
      template: 'hooks/session-architecture-heal.ts',
    },
    '.safeword/hooks/session-author-model.ts': {
      template: 'hooks/session-author-model.ts',
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
    '.safeword/hooks/post-tool-skill-nudge.ts': {
      template: 'hooks/post-tool-skill-nudge.ts',
    },
    '.safeword/hooks/post-tool-bypass-warn.ts': {
      template: 'hooks/post-tool-bypass-warn.ts',
    },
    '.safeword/hooks/pre-tool-quality.ts': {
      template: 'hooks/pre-tool-quality.ts',
    },
    '.safeword/hooks/pre-tool-architecture-stage.ts': {
      template: 'hooks/pre-tool-architecture-stage.ts',
    },
    '.safeword/hooks/pre-tool-stale-main.ts': {
      template: 'hooks/pre-tool-stale-main.ts',
    },
    '.safeword/hooks/codex/pre-tool-quality.ts': {
      template: 'hooks/codex/pre-tool-quality.ts',
    },
    '.safeword/hooks/codex/pre-tool-quality-helpers.ts': {
      template: 'hooks/codex/pre-tool-quality-helpers.ts',
    },
    '.safeword/hooks/codex/post-tool-skill-nudge.ts': {
      template: 'hooks/codex/post-tool-skill-nudge.ts',
    },
    '.safeword/hooks/write-review-stamp.ts': {
      template: 'hooks/write-review-stamp.ts',
    },
    '.safeword/hooks/pre-tool-config-guard.ts': {
      template: 'hooks/pre-tool-config-guard.ts',
    },
    '.safeword/hooks/pre-tool-dependency-readiness.ts': {
      template: 'hooks/pre-tool-dependency-readiness.ts',
    },
    '.safeword/hooks/post-tool-dependency-readiness.ts': {
      template: 'hooks/post-tool-dependency-readiness.ts',
    },
    '.safeword/hooks/pre-tool-git-bare-fix.sh': {
      template: 'hooks/pre-tool-git-bare-fix.sh',
    },
    '.safeword/hooks/session-auto-upgrade.ts': {
      template: 'hooks/session-auto-upgrade.ts',
    },
    '.safeword/hooks/session-cleanup-quality.ts': {
      template: 'hooks/session-cleanup-quality.ts',
    },
    '.safeword/hooks/stop-quality.ts': { template: 'hooks/stop-quality.ts' },
    '.safeword/hooks/stop-reentry.ts': { template: 'hooks/stop-reentry.ts' },
    '.safeword/hooks/stop-self-report.ts': { template: 'hooks/stop-self-report.ts' },
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
    '.safeword/guides/self-report-filing.md': {
      template: 'guides/self-report-filing.md',
    },
    '.safeword/guides/cold-start-check.md': {
      template: 'guides/cold-start-check.md',
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
    '.safeword/guides/llm-evals-guide.md': {
      template: 'guides/llm-evals-guide.md',
    },
    '.safeword/guides/planning-guide.md': {
      template: 'guides/planning-guide.md',
    },
    '.safeword/guides/testing-guide.md': {
      template: 'guides/testing-guide.md',
    },
    '.safeword/guides/verification-lanes-guide.md': {
      template: 'guides/verification-lanes-guide.md',
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
    // Per-ticket impl-plan.md scaffold (ticket XDNSZA) — authored at
    // scenario-gate exit, validated by the stop hook's impl-plan gate.
    '.safeword/templates/impl-plan-template.md': {
      template: 'doc-templates/impl-plan-template.md',
    },
    '.safeword/templates/work-log-template.md': {
      template: 'doc-templates/work-log-template.md',
    },
    // Per-ticket spec.md scaffold (ticket Y2HCNJ). ticket-writer reads this
    // from the bundled templates dir when scaffolding a feature's spec.md;
    // deployed here so it joins the other artifact templates and stays in the
    // schema's ownedFiles manifest.
    '.safeword/templates/spec-template.md': {
      template: 'spec-template.md',
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
    '.claude/skills/explain/SKILL.md': { template: 'skills/explain/SKILL.md' },
    '.claude/skills/self-review/SKILL.md': { template: 'skills/self-review/SKILL.md' },
    '.claude/skills/review-spec/SKILL.md': {
      template: 'skills/review-spec/SKILL.md',
    },
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

    // Codex skills (repo-scoped .agents/skills)
    ...CODEX_SKILL_OWNED_FILES,

    // Cursor rules — generated from wrapper metadata; physical files stay installed.
    ...CURSOR_RULE_WRAPPER_OWNED_FILES,

    // Cursor commands (Cursor needs explicit commands for all action capabilities)
    ...CURSOR_COMMAND_WRAPPER_OWNED_FILES,
    '.cursor/commands/explain.md': { template: 'commands/explain.md' },
    '.cursor/commands/verify.md': { template: 'commands/verify.md' },
    '.cursor/commands/self-review.md': { template: 'commands/self-review.md' },
    '.cursor/commands/review-spec.md': { template: 'commands/review-spec.md' },
    '.cursor/commands/audit.md': { template: 'commands/audit.md' },
    '.cursor/commands/cleanup-zombies.md': {
      template: 'commands/cleanup-zombies.md',
    },
    '.cursor/commands/lint.md': { template: 'commands/lint.md' },

    // Cursor hooks adapters - TypeScript with Bun runtime
    '.safeword/hooks/cursor/after-file-edit.ts': {
      template: 'hooks/cursor/after-file-edit.ts',
    },
    '.safeword/hooks/cursor/gate-adapter.ts': {
      template: 'hooks/cursor/gate-adapter.ts',
    },
    '.safeword/hooks/cursor/pre-tool-quality.ts': {
      template: 'hooks/cursor/pre-tool-quality.ts',
    },
    '.safeword/hooks/cursor/before-shell-execution.ts': {
      template: 'hooks/cursor/before-shell-execution.ts',
    },
    '.safeword/hooks/cursor/post-tool-quality.ts': {
      template: 'hooks/cursor/post-tool-quality.ts',
    },
    '.safeword/hooks/cursor/post-tool-skill-nudge.ts': {
      template: 'hooks/cursor/post-tool-skill-nudge.ts',
    },
    '.safeword/hooks/cursor/stop.ts': { template: 'hooks/cursor/stop.ts' },
  },

  // Files created if missing, updated only if content matches current template
  managedFiles: {
    // BDD acceptance lane working files (ticket 102b) — scaffolded once; the
    // customer owns them thereafter (created if missing, updated only while
    // still safeword's template content). The lane config (cucumber.mjs) is
    // safeword-owned in ownedFiles.
    'features/safeword-lane.feature': { template: 'cucumber/safeword-lane.feature' },
    'steps/world.ts': { template: 'cucumber/world.ts' },
    'steps/shared.steps.ts': { template: 'cucumber/shared.steps.ts' },

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

    // Codex project config — create if missing, preserve user-authored config.
    '.codex/config.toml': { template: 'codex/config.toml' },

    // Project personas — scaffolded once with format header + commented example;
    // user authors real persona blocks thereafter (safeword reads, never overwrites
    // user content). See ticket 7YN5QB. `configKey: 'personas'` lets the user
    // redirect via `paths.personas` in .safeword/config.json — when set, reconcile
    // skips this entry uniformly (see ticket K7N2QM).
    '.safeword-project/personas.md': {
      template: 'personas-template.md',
      configKey: 'personas',
    },

    // Project glossary — scaffolded once with format header + commented example;
    // user authors real term blocks thereafter (safeword reads/validates, never
    // overwrites user content). See ticket YR6C49. `configKey: 'glossary'` lets
    // the user redirect via `paths.glossary` in .safeword/config.json — when set,
    // reconcile skips this entry uniformly (see ticket K7N2QM).
    '.safeword-project/glossary.md': {
      template: 'glossary-template.md',
      configKey: 'glossary',
    },

    // Project feature surfaces — scaffolded once with format header + commented
    // example; user authors real surface blocks thereafter. `configKey:
    // 'surfaces'` lets the user redirect via `paths.surfaces` in
    // .safeword/config.json, matching the personas/glossary contract.
    '.safeword-project/surfaces.md': {
      template: 'surfaces-template.md',
      configKey: 'surfaces',
    },

    // Per-root `.gitignore` for hook-written transient state. The legacy-prefixed
    // key is remapped to the resolved namespace root by withResolvedNamespaceRoot,
    // so a custom `paths.projectRoot` ignores its own transient files even though
    // the static repo-root block can't name that root (issue #272). Created once;
    // the repo-root block stays the belt-and-suspenders for `.project/`/legacy.
    '.safeword-project/.gitignore': {
      content: NAMESPACE_GITIGNORE_CONTENT,
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
        assignOrPrune(result, 'hooks', cleanedHooks);
        return result;
      },
    },

    '.mcp.json': MCP_JSON_MERGE,
    '.cursor/mcp.json': MCP_JSON_MERGE,

    // markdownlint-cli2 ignores - hide safeword's generated agent docs from a
    // consuming repo's markdown lint hooks (ticket #262). cli2's only JSON config
    // form is `.jsonc`; yaml/cjs/mjs variants fall back to manual wiring.
    '.markdownlint-cli2.jsonc': MARKDOWNLINT_CLI2_IGNORES_MERGE,

    '.cursor/hooks.json': {
      keys: [
        'version',
        'hooks.sessionStart',
        'hooks.preToolUse',
        'hooks.beforeShellExecution',
        'hooks.afterFileEdit',
        'hooks.postToolUse',
        'hooks.stop',
      ],
      removeFileIfEmpty: true,
      merge: existing => {
        const existingHooks = (existing.hooks as Record<string, unknown[]>) ?? {};
        const hooks: Record<string, unknown[]> = { ...existingHooks };
        for (const [event, newHooks] of Object.entries(CURSOR_HOOKS)) {
          const eventHooks = hooks[event] ?? [];
          const nonSafewordHooks = filterOutSafewordHooks(eventHooks);
          hooks[event] = [...nonSafewordHooks, ...newHooks];
        }
        return {
          ...existing,
          version: 1, // Required by Cursor
          hooks,
        };
      },
      unmerge: existing => {
        const result = { ...existing };
        const existingHooks = (existing.hooks as Record<string, unknown[]>) ?? {};

        // Keep only hooks safeword did NOT install. Filtering entries instead of
        // whole events preserves user-authored Cursor hooks that share an event
        // with safeword, such as `sessionStart`.
        const hooks = Object.fromEntries(
          Object.entries(existingHooks)
            .map(([name, eventHooks]) => [name, filterOutSafewordHooks(eventHooks)] as const)
            .filter(([, eventHooks]) => eventHooks.length > 0),
        );

        // `version` is only meaningful while safeword's hooks remain; drop it
        // alongside an emptied hooks container.
        if (!assignOrPrune(result, 'hooks', hooks)) {
          delete result.version;
        }

        return result;
      },
    },
  },

  // Text files where we patch specific content
  textPatches: {
    '.gitignore': {
      operation: 'append',
      content: `\n# Safeword - Local cache and transient state\n${SAFEWORD_TRANSIENT_PATHS.join('\n')}\n`,
      // Marker is a NEW line (.project/dependency-readiness.json) so customers with
      // the older legacy-only block re-apply on upgrade and pick up the
      // latest transient paths. Hooks write state under the resolved root, so
      // fresh installs generate these under .project/. Without them, those
      // generated files show as untracked in `git status --porcelain` —
      // churning the tree and blocking the auto-upgrade gate.
      marker: '.project/dependency-readiness.json',
    },
    // Prettier ignores: safeword owns the dot-directories in SAFEWORD_IGNORE_DIRS
    // (.safeword/, .claude/, .cursor/, .codex/, .agents/, and both namespace
    // roots). Without this, `prettier --write .` reformats hooks, Cursor/Codex
    // rules, and the generated ticket/learning markdown — churning the tree on
    // install (ticket EYRK34). Biome/eslint exclude these via their own configs.
    //
    // The marker carries an "(owned dirs)" suffix the pre-EYRK34 block lacks, so an
    // existing install re-applies on upgrade and picks up the broadened excludes
    // (.codex/ + wholesale namespace roots). The stable
    // "# Safeword - managed prettier exclusions" header substring is preserved so
    // stale-config-scan still detects the block.
    '.prettierignore': {
      operation: 'append',
      // ctx factory + rerender (issue #293): a custom paths.projectRoot is excluded,
      // and the block re-renders in place on upgrade for an existing custom-root
      // install. Default/legacy output is byte-identical, so those installs no-op.
      content: ctx => `\n${PRETTIER_EXCLUSIONS_HEADER}\n${managedPrettierPaths(ctx).join('\n')}\n`,
      rerender: true,
      marker: PRETTIER_EXCLUSIONS_HEADER,
    },
    '.codex/config.toml': [
      // Primary patch: retrofits the prompt-timestamp hook onto pre-existing
      // configs and owns file removal on uninstall (runs LAST on unpatch).
      {
        operation: 'append',
        content: CODEX_PROMPT_TIMESTAMP_HOOK_PATCH,
        marker: '.safeword/hooks/prompt-timestamp.ts',
        applyWhenContentIncludes: [
          '# Safeword Codex project configuration.',
          '.safeword/hooks/codex/pre-tool-quality.ts',
        ],
        unpatchContent: [
          CODEX_SESSION_START_HOOK_PATCH,
          CODEX_LEGACY_CONTEXT_SESSION_START_HOOK_PATCH,
          CODEX_PRE_TOOL_QUALITY_HOOK_PATCH,
        ],
        removeFileIfContentEquals: [CODEX_CONFIG_SCAFFOLD_WITHOUT_HOOKS],
      },
      // Migrate existing installs (auto-upgrade-codex follow-up to #433): swap the
      // legacy context-only SessionStart hook for the auto-upgrade dispatcher.
      // Codex runs same-event hooks concurrently with no ordering, so this must
      // REPLACE the legacy hook (appending a second SessionStart hook would
      // double-emit context) — hence `supersedes`. managedFiles is
      // create-if-missing, so a fresh install gets the dispatcher from the
      // template while every EXISTING config is skipped by managedFiles and
      // migrated here. Idempotent: skips when the dispatcher marker is already
      // present, and the strip no-ops when the legacy block is absent. Guarded to
      // safeword scaffolds; a user-modified legacy block won't byte-match and is
      // preserved. Uninstall cleanup is owned by the primary patch's
      // unpatchContent above.
      {
        operation: 'append',
        content: CODEX_SESSION_START_HOOK_PATCH,
        marker: '.safeword/hooks/session-codex-start.ts',
        supersedes: CODEX_LEGACY_CONTEXT_SESSION_START_HOOK_PATCH,
        applyWhenContentIncludes: [
          '# Safeword Codex project configuration.',
          '.safeword/hooks/codex/pre-tool-quality.ts',
        ],
      },
      // PostToolUse skill-nudge retrofit (#482): add-if-missing onto existing
      // configs, marker = the hook path so a present block suppresses the append.
      // Own unpatch removes this block; the primary patch (last on reversed
      // unpatch) owns file removal. Mirrors the MCP-server retrofit below.
      {
        operation: 'append',
        content: CODEX_POST_TOOL_SKILL_NUDGE_HOOK_PATCH,
        marker: '.safeword/hooks/codex/post-tool-skill-nudge.ts',
        applyWhenContentIncludes: [
          '# Safeword Codex project configuration.',
          '.safeword/hooks/codex/pre-tool-quality.ts',
        ],
      },
      // MCP-server retrofit (#269): add-if-missing parity with .mcp.json /
      // .cursor/mcp.json. Marker is the context7 table header, so an existing
      // (safeword- or user-authored) [mcp_servers.context7] suppresses the
      // append — never clobbering or duplicating a user's entry. Guarded to
      // safeword-scaffolded configs only.
      {
        operation: 'append',
        content: CODEX_MCP_SERVERS_BLOCK,
        marker: '[mcp_servers.context7]',
        applyWhenContentIncludes: [
          '# Safeword Codex project configuration.',
          '.safeword/hooks/codex/pre-tool-quality.ts',
        ],
        // No unpatchContent/removeFileIfContentEquals by design: unpatch removes
        // this patch's `content` (the MCP block), and the primary patch above —
        // running last on the reversed unpatch — owns file removal.
      },
    ],
  },

  // Cleanup-only text patches. Safeword used to prepend these blocks to
  // customer-owned context files; P30CRP moved SAFEWORD.md delivery to
  // safeword-owned hooks.
  legacyTextPatches: {
    'AGENTS.md': {
      operation: 'prepend',
      content: AGENTS_MD_LINK,
      marker: '.safeword/SAFEWORD.md',
    },
    'CLAUDE.md': {
      operation: 'prepend',
      content: CLAUDE_MD_IMPORT_BLOCK,
      marker: '@./.safeword/SAFEWORD.md',
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
      // guidance during the implement phase. Removing any marker silently
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
