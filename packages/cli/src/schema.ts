/**
 * SAFEWORD Schema - Single Source of Truth
 *
 * All files, directories, configurations, and packages managed by safeword
 * are defined here. Commands use this schema via the reconciliation engine.
 *
 * Adding a new file? Add it here and it will be handled by setup/upgrade/reset.
 */

import nodePath from 'node:path';

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
  resolvedNamespaceRootLabel,
} from './owned-paths.js';
import type {
  FileDefinition,
  JsonMergeDefinition,
  ManagedFileDefinition,
  ProjectContext,
} from './packs/types.js';
import { CURSOR_HOOKS, SETTINGS_HOOKS } from './templates/config.js';
import { AGENTS_MD_LINK, CLAUDE_MD_IMPORT_BLOCK } from './templates/content.js';
import { getTemplatesDirectory, readFile } from './utils/fs.js';
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
  // Context predicate gating APPLICATION only (install/upgrade/creation) —
  // e.g. hook shims apply only in husky hosts (ZJMZ50). Unpatch is deliberately
  // NOT gated: reset must strip a leftover block even when the host's world
  // changed after install (a husky -> lefthook migration).
  when?: (ctx: ProjectContext) => boolean;
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

const CODEX_SKILL_TEMPLATE_FILES = [
  ['audit/SKILL.md', 'skills/audit/SKILL.md'],
  ['bdd/SKILL.md', 'skills/bdd/SKILL.md'],
  ['bdd/DISCOVERY.md', 'skills/bdd/DISCOVERY.md'],
  ['bdd/PLAN_IMPLEMENTATION.md', 'skills/bdd/PLAN_IMPLEMENTATION.md'],
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
  ['retro/SKILL.md', 'skills/retro/SKILL.md'],
  ['review-spec/SKILL.md', 'skills/review-spec/SKILL.md'],
  ['self-review/SKILL.md', 'skills/self-review/SKILL.md'],
  ['tdd-review/SKILL.md', 'skills/tdd-review/SKILL.md'],
  ['testing/SKILL.md', 'skills/testing/SKILL.md'],
  ['ticket-system/SKILL.md', 'skills/ticket-system/SKILL.md'],
  ['verify/SKILL.md', 'skills/verify/SKILL.md'],
] as const;

const CODEX_SKILL_DEPRECATED_FILES = CODEX_SKILL_TEMPLATE_FILES.map(
  ([target]) => `.agents/skills/${target}`,
);

const CODEX_SKILL_DEPRECATED_DIRS = [
  ...new Set(
    CODEX_SKILL_TEMPLATE_FILES.map(([target]) => `.agents/skills/${target.split('/', 1)[0]}`),
  ),
];

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
  '.safeword/boundary-audit.jsonl',
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

// Header line of the managed .gitattributes block — also its marker (re-applied and
// re-rendered against this exact string). See GitHub #566 / ticket GA7T6M.
const GITATTRIBUTES_HEADER = '# Safeword - managed merge strategy for generated artifacts';

/**
 * The managed `.gitattributes` block (issue #566): safeword's committed but
 * deterministically-regenerated artifacts — the architecture docs and the ticket index —
 * get `merge=union` so a local `git merge`/`rebase`/`pull` of the default branch
 * auto-resolves them instead of conflicting on the `fingerprint:` line + reconcile/stale
 * markers. `union` is a BUILT-IN driver (attribute-only, no `git config`), so it works on
 * any clone/CI from the committed file; the heal + `architecture --check` pipeline then
 * reconciles the union result to the correct content. `linguist-generated=true` collapses
 * their diffs and marks them generated on GitHub. Resolved per-ctx so a custom
 * `paths.projectRoot` ticket index is covered; the architecture-doc glob is root-agnostic.
 */
function managedGitattributes(ctx: ProjectContext): string {
  const root = resolvedNamespaceRootLabel(ctx);
  return [
    GITATTRIBUTES_HEADER,
    '**/architecture.generated.md merge=union linguist-generated=true',
    `${root}/tickets/INDEX.md merge=union linguist-generated=true`,
    `${root}/tickets/INDEX-completed.md merge=union linguist-generated=true`,
  ].join('\n');
}

/**
 * The starter BDD lane's full surface — files (the bddLaneFile entries
 * below), deps (typescriptPackages.conditional.scaffoldBddLane), and the
 * test:bdd script. The `safeword check` leftover-scaffold advisory
 * enumerates from these constants so its list can never drift from the
 * schema (ticket 56JCFZ, TB3.AC2).
 */
export const BDD_LANE_FILE_PATHS = [
  'cucumber.mjs',
  'features/safeword-lane.feature',
  'steps/world.ts',
  'steps/shared.steps.ts',
] as const;

export const BDD_LANE_SCRIPT = 'test:bdd';

/**
 * Starter-lane template entry, suppressed when the repo has its own cucumber
 * harness (ticket 56JCFZ, issue #645): the generator returns undefined so
 * reconcile skips the file entirely instead of scaffolding a competing lane.
 * Behaves exactly like `{ template }` when no harness is detected.
 */
function bddLaneFile(templatePath: string): FileDefinition {
  return {
    // `template` declares provenance for the schema↔templates contract;
    // the generator (which takes precedence) gates on harness detection.
    template: templatePath,
    generator: (ctx: ProjectContext): string | undefined =>
      ctx.projectType.scaffoldBddLane
        ? readFile(nodePath.join(getTemplatesDirectory(), templatePath))
        : undefined,
  };
}

// Filing invariants shared word-for-word by the retro and self-report-filing
// guides (#801). Both carry guide-specific nuance around them, so the guides
// can't be collapsed into one — instead the shared bullets are contract-pinned
// in both files below. Single-line bullets on purpose: contracts match exact
// substrings, so a rewrap would break the check.
const SHARED_FILING_INVARIANTS = [
  '- **Autonomous** — no human approval; sanitization + dedup + caps are the safeguards, not a human gate.',
  "- **Upstream only** — `ArcadeAI/safeword`, never the host project's tracker.",
  '- **Code owns egress** — nothing leaves beyond what the sanitized output contains.',
];

// One session-id → safe-token rule (FG6V57): triage (public ledger JSON), the
// retro draft spool (filename), and self-report (local records) each reduce an
// attacker-influenceable session id to a bare bounded token. The spool module is
// deliberately self-contained (node:* only), so the rule is pinned byte-identical
// across the three files instead of shared via import — edit them together.
// (Keep this string minimal: an equivalent-but-reformatted regex fails the pin.)
const SESSION_TOKEN_RULE = [String.raw`.replaceAll(/[^\w.-]/g, '_').slice(0, 80) || 'unknown'`];

/** Marker substring identifying a boundary-gate shim line (ZJMZ50). */
const BOUNDARY_SHIM_MARKER = '# Safeword boundary gate';

/**
 * The armored boundary-gate invocation, shared by every hook manager so the
 * safety semantics can never drift: the `[ -x … ]` guard keeps a fresh clone
 * (no node_modules) silent, and `|| true` keeps a crashing gate from blocking
 * (warn-only contract, TB1.R4). Husky appends it via the textPatch below;
 * the lefthook/pre-commit snippets interpolate it in hook-nudge.ts.
 */
export function boundaryShimCommand(at: 'commit' | 'push'): string {
  return `[ -x node_modules/.bin/safeword ] && node_modules/.bin/safeword boundary --at ${at} || true`;
}

/**
 * One-line boundary-gate shim for a husky hook file (see the textPatches
 * entry comment for the full design rationale). The marker is a trailing sh
 * comment on the command line itself, so the block IS the marker line.
 */
function boundaryShimPatch(at: 'commit' | 'push'): TextPatchDefinition {
  return {
    operation: 'append',
    content: `${boundaryShimCommand(at)} ${BOUNDARY_SHIM_MARKER}: warn-only; removed by \`safeword reset\`\n`,
    marker: BOUNDARY_SHIM_MARKER,
    rerender: true,
    // A hook file that setup alone created holds nothing but the shim after
    // unpatch — delete it rather than leave an empty husk (TB1.R5).
    removeFileIfContentEquals: ['', '\n'],
    when: ctx => ctx.hookManager === 'husky',
  };
}

const LEGACY_SAFEWORD_SCHEMA: SafewordSchema = {
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
    '.cursor/agents',
  ],

  // Directories we add to but don't own (not deleted on reset)
  sharedDirs: [
    '.claude',
    '.claude/skills',
    '.claude/commands',
    // Custom-agent homes (GH628F): safeword ships safeword-retro-filer here, but
    // users keep their own agents in these dirs — add-to, never own.
    '.claude/agents',
    '.codex',
    '.codex/agents',
  ],

  // Created on setup but NOT deleted on reset (preserves user data)
  preservedDirs: [
    '.safeword-project/learnings',
    '.safeword/logs',
    // Runtime cloud-filing spool (BNGK9W) — per-session drafts + nudge markers the
    // retro writes at runtime; user/runtime data the schema does not own.
    '.safeword/retro-drafts',
    // Runtime self-report capture (already in SAFEWORD_TRANSIENT_PATHS /
    // gitignore) — per-session JSONL the hooks write; without this entry the
    // schema-drift test fails for any session that recorded a signal.
    '.safeword/self-reports',
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
    // Codex implementation moved into the packaged Codex plugin and `safeword hook codex`.
    // Keep cleanup file-scoped for `.agents/skills/*` because `.agents/skills` is a shared
    // agent directory; a user-authored sibling skill must survive migration.
    ...CODEX_SKILL_DEPRECATED_FILES,
    '.safeword/hooks/codex/pre-tool-quality.ts',
    '.safeword/hooks/codex/pre-tool-quality-helpers.ts',
    '.safeword/hooks/codex/stop.ts',
    '.safeword/hooks/codex/post-tool-quality.ts',
    '.safeword/hooks/codex/post-tool-skill-nudge.ts',
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
    // Empty after deprecated Codex hook files are removed.
    '.safeword/hooks/codex',
    // Empty after deprecated Codex skill files are removed; non-empty user-modified dirs survive.
    ...CODEX_SKILL_DEPRECATED_DIRS,
  ],

  // Files owned by safeword (overwritten on upgrade if content changed)
  // (bddLaneFile entries: see the helper defined above the schema)
  ownedFiles: {
    // Project root config files (for audit/quality tools)
    '.jscpd.json': { template: '.jscpd.json' },
    // BDD acceptance lane config (ticket 102b) — safeword-owned; the lane's
    // working files (features/, steps/) are customer-owned in managedFiles.
    // Suppressed when the repo has its own cucumber harness (56JCFZ).
    'cucumber.mjs': bddLaneFile('cucumber/cucumber.mjs'),
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
    '.safeword/hooks/lib/cursor-state.ts': {
      template: 'hooks/lib/cursor-state.ts',
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
    '.safeword/hooks/lib/jsonl-spool.ts': { template: 'hooks/lib/jsonl-spool.ts' },
    '.safeword/hooks/lib/namespace-root.ts': { template: 'hooks/lib/namespace-root.ts' },
    '.safeword/hooks/lib/retro-draft-spool.ts': { template: 'hooks/lib/retro-draft-spool.ts' },
    '.safeword/hooks/lib/retro-debug.ts': { template: 'hooks/lib/retro-debug.ts' },
    '.safeword/hooks/lib/retro-extract.ts': { template: 'hooks/lib/retro-extract.ts' },
    '.safeword/hooks/lib/retro-filing-gate.ts': { template: 'hooks/lib/retro-filing-gate.ts' },
    '.safeword/hooks/lib/retro-nudge.ts': { template: 'hooks/lib/retro-nudge.ts' },
    '.safeword/hooks/lib/retro-trigger.ts': { template: 'hooks/lib/retro-trigger.ts' },
    '.safeword/hooks/lib/self-report.ts': { template: 'hooks/lib/self-report.ts' },
    '.safeword/hooks/lib/skill-invocation-log.ts': {
      template: 'hooks/lib/skill-invocation-log.ts',
    },
    '.safeword/hooks/lib/parse-annotation.ts': { template: 'hooks/lib/parse-annotation.ts' },
    '.safeword/hooks/lib/jtbd.ts': { template: 'hooks/lib/jtbd.ts' },
    '.safeword/hooks/lib/phase-provenance.ts': { template: 'hooks/lib/phase-provenance.ts' },
    '.safeword/hooks/lib/impl-plan.ts': { template: 'hooks/lib/impl-plan.ts' },
    '.safeword/hooks/lib/plan-gate.ts': { template: 'hooks/lib/plan-gate.ts' },
    '.safeword/hooks/lib/replan-relevance.ts': { template: 'hooks/lib/replan-relevance.ts' },
    '.safeword/hooks/lib/replan.ts': { template: 'hooks/lib/replan.ts' },
    '.safeword/hooks/lib/review-ledger.ts': { template: 'hooks/lib/review-ledger.ts' },
    '.safeword/hooks/lib/lint-config.ts': { template: 'hooks/lib/lint-config.ts' },
    '.safeword/hooks/lib/typecheck-gate.ts': { template: 'hooks/lib/typecheck-gate.ts' },
    '.safeword/hooks/lib/checkbox-transitions.ts': {
      template: 'hooks/lib/checkbox-transitions.ts',
    },
    '.safeword/hooks/lib/shell-segments.ts': { template: 'hooks/lib/shell-segments.ts' },
    '.safeword/hooks/lib/bash-ledger-writes.ts': {
      template: 'hooks/lib/bash-ledger-writes.ts',
    },
    '.safeword/hooks/lib/process-kill-guard.ts': {
      template: 'hooks/lib/process-kill-guard.ts',
    },
    '.safeword/hooks/lib/work-log-stamp.ts': {
      template: 'hooks/lib/work-log-stamp.ts',
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
    '.safeword/hooks/prompt-retro-nudge.ts': {
      template: 'hooks/prompt-retro-nudge.ts',
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
    '.safeword/hooks/stop-retro-filing.ts': { template: 'hooks/stop-retro-filing.ts' },
    '.safeword/hooks/stop-retro.ts': { template: 'hooks/stop-retro.ts' },
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
    '.safeword/hooks/post-tool-work-log.ts': {
      template: 'hooks/post-tool-work-log.ts',
    },

    // Retro filer subagent (GH628F, issue #628): the filing procedure lives in
    // the agent definition, dispatched by the per-harness stop gates. One
    // markdown source serves Claude and Cursor; Codex takes TOML. OWNED (not
    // managed): overwritten on upgrade and removed on reset — a leftover copy
    // would keep `.cursor/` alive after reset.
    '.claude/agents/safeword-retro-filer.md': { template: 'agents/safeword-retro-filer.md' },
    '.cursor/agents/safeword-retro-filer.md': { template: 'agents/safeword-retro-filer.md' },

    // Guides
    '.safeword/guides/architecture-guide.md': {
      template: 'guides/architecture-guide.md',
    },
    '.safeword/guides/self-report-filing.md': {
      template: 'guides/self-report-filing.md',
    },
    '.safeword/guides/retro.md': {
      template: 'guides/retro.md',
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
    // the plan-implementation phase, validated by the stop hook's impl-plan gate.
    '.safeword/templates/impl-plan-template.md': {
      template: 'doc-templates/impl-plan-template.md',
    },
    '.safeword/templates/adr-template.md': {
      template: 'doc-templates/adr-template.md',
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
    '.claude/skills/bdd/PLAN_IMPLEMENTATION.md': {
      template: 'skills/bdd/PLAN_IMPLEMENTATION.md',
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
    '.claude/skills/retro/SKILL.md': { template: 'skills/retro/SKILL.md' },
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

    // Cursor rules — generated from wrapper metadata; physical files stay installed.
    ...CURSOR_RULE_WRAPPER_OWNED_FILES,

    // Cursor commands (Cursor needs explicit commands for all action capabilities)
    ...CURSOR_COMMAND_WRAPPER_OWNED_FILES,
    '.cursor/commands/explain.md': { template: 'commands/explain.md' },
    '.cursor/commands/verify.md': { template: 'commands/verify.md' },
    '.cursor/commands/self-review.md': { template: 'commands/self-review.md' },
    '.cursor/commands/review-spec.md': { template: 'commands/review-spec.md' },
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
    // safeword-owned in ownedFiles. All suppressed when the repo has its own
    // cucumber harness (56JCFZ).
    'features/safeword-lane.feature': bddLaneFile('cucumber/safeword-lane.feature'),
    'steps/world.ts': bddLaneFile('cucumber/world.ts'),
    'steps/shared.steps.ts': bddLaneFile('cucumber/shared.steps.ts'),

    // TypeScript/JavaScript managed files (ESLint, tsconfig, Knip, Prettier configs)
    ...typescriptManagedFiles,
    // Python managed files (ruff.toml, mypy.ini, .importlinter)
    ...pythonManagedFiles,
    // Go managed files (.golangci.yml)
    ...golangManagedFiles,
    // Rust managed files (clippy.toml, rustfmt.toml, deny.toml)
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
    // Boundary-gate shims for husky hosts (ZJMZ50, #810 child 2). One line,
    // all logic in the versioned CLI: explicit .bin path (husky's PATH
    // prepend is relative — worktree-unsafe, 9P3VVH), existence-guarded
    // (fresh clones), whole-line `|| true` (husky runs hooks with sh -e, so
    // an unguarded failure would BLOCK the commit — TB1.R4). The marker rides
    // the line as a trailing comment, which makes the whole block the marker
    // line: rerender then heals ANY future line change in place
    // (rerenderBlockLines excludes marker lines). Gated to the husky world —
    // lefthook/pre-commit/bare hosts get a printed nudge instead, and
    // `when` never gates unpatch, so reset still strips after a migration.
    '.husky/pre-commit': boundaryShimPatch('commit'),
    '.husky/pre-push': boundaryShimPatch('push'),
    '.gitignore': {
      operation: 'append',
      content: `\n# Safeword - Local cache and transient state\n${SAFEWORD_TRANSIENT_PATHS.join('\n')}\n`,
      // Marker is the NEWEST line (.safeword/boundary-audit.jsonl, the boundary
      // gate's audit record — ZJMZ50) so customers with any older block
      // re-apply on upgrade and pick up the latest transient paths. Hooks write
      // state under the resolved root, so fresh installs generate these under
      // .project/. Without them, those generated files show as untracked in
      // `git status --porcelain` — churning the tree and blocking the
      // auto-upgrade gate.
      marker: '.safeword/boundary-audit.jsonl',
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
    '.gitattributes': {
      // ctx factory + rerender (issue #566), same shape as .prettierignore: a custom
      // paths.projectRoot resolves into the ticket-index paths, and the block re-renders
      // in place on upgrade. Default/legacy output is byte-identical, so those installs
      // no-op. Appended (marker-delimited) so a consumer's own .gitattributes is preserved.
      // No leading newline (unlike .prettierignore): prettier-plugin-sh DOES format
      // .gitattributes and rejects a leading blank line on a fresh install; existing
      // content separates via its own trailing newline.
      operation: 'append',
      content: ctx => `${managedGitattributes(ctx)}\n`,
      rerender: true,
      marker: GITATTRIBUTES_HEADER,
    },
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
    'packages/cli/src/retro/triage.ts': {
      // Shared session-token rule (FG6V57) — see SESSION_TOKEN_RULE above.
      requires: SESSION_TOKEN_RULE,
    },
    'packages/cli/templates/hooks/lib/retro-draft-spool.ts': {
      // Shared session-token rule (FG6V57); the .safeword mirror follows via pairs.
      requires: SESSION_TOKEN_RULE,
    },
    'packages/cli/templates/hooks/lib/self-report.ts': {
      // Shared session-token rule (FG6V57); sanitizeToken stays for non-session fields.
      requires: SESSION_TOKEN_RULE,
    },
    'packages/cli/templates/guides/self-report-filing.md': {
      // Shared filing invariants with retro.md (#801): the two guides carried
      // independently hand-tuned Rules blocks that silently forked. The exact
      // bullet text below must appear in BOTH guides — edit them together.
      requires: SHARED_FILING_INVARIANTS,
    },
    'packages/cli/templates/guides/retro.md': {
      // See self-report-filing.md contract above (#801).
      requires: SHARED_FILING_INVARIANTS,
    },
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

function withoutCodexProjectAssets<T>(entries: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(entries).filter(
      ([path]) => path !== '.codex/config.toml' && !path.startsWith('.codex/agents/'),
    ),
  );
}

/**
 * The public schema is plugin-only for Codex. Existing project hooks are left
 * untouched until `safeword migrate codex-plugin` verifies the profile plugin.
 */
export const SAFEWORD_SCHEMA: SafewordSchema = {
  ...LEGACY_SAFEWORD_SCHEMA,
  ownedFiles: withoutCodexProjectAssets(LEGACY_SAFEWORD_SCHEMA.ownedFiles),
  managedFiles: withoutCodexProjectAssets(LEGACY_SAFEWORD_SCHEMA.managedFiles),
  textPatches: withoutCodexProjectAssets(LEGACY_SAFEWORD_SCHEMA.textPatches),
  legacyTextPatches: withoutCodexProjectAssets(LEGACY_SAFEWORD_SCHEMA.legacyTextPatches),
};

/** @deprecated Use SAFEWORD_SCHEMA; retained temporarily for migration callers. */
export const SAFEWORD_PLUGIN_SCHEMA = SAFEWORD_SCHEMA;
