/**
 * SAFEWORD Schema - Single Source of Truth
 *
 * All files, directories, configurations, and packages managed by safeword
 * are defined here. Commands use this schema via the reconciliation engine.
 *
 * Adding a new file? Add it here and it will be handled by setup/upgrade/reset.
 */

import nodePath from 'node:path';

import { acceptedHistoricalHookEntries } from './claude-plugin/historical-ownership.js';
import { CODEX_MIGRATION_SCHEMA } from './codex-plugin/inventory.js';
import { OPENCODE_CATALOGUE_OWNED_FILES } from './opencode/catalogue.js';
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
  durableNamespaceDirectories,
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
import { getTemplatesDirectory, readFile, readFileSafe } from './utils/fs.js';
import { filterOutEquivalentSafewordHooks, filterOutSafewordHooks } from './utils/hooks.js';
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
  // Replacement appended after this managed block is removed. Used when an
  // uninstall must retain configuration for project-owned durable content.
  replacementAfterUnpatch?: string | ((ctx: ProjectContext) => string);
  removeFileIfContentEquals?: string[]; // Delete file only when remaining content is known scaffold
  // When set (append patches only), re-render the managed block in place on
  // upgrade instead of skip-on-marker — so a ctx-dependent block (e.g. a custom
  // projectRoot added to .prettierignore) heals on existing installs. A no-op
  // when the block is already current, so unchanged installs never churn (#293).
  rerender?: boolean;
  // Optional recognizer for every owned body line in a rerenderable block. Use
  // this when ctx changes can replace (rather than only append) body lines, so
  // stale variants can still be removed without consuming following user lines.
  rerenderOwnedLinePattern?: RegExp;
}

export interface ContractDefinition {
  requires: string[]; // Strings that must appear verbatim in the file content
}

interface CodexMigrationDefinition {
  legacyFiles: string[];
  cleanupFiles: string[];
  legacyDirs: string[];
  hookEvents: string[];
  hookEventNames: Record<string, string>;
  hookScripts: string[];
  sharedRuntimePaths: readonly string[];
  cleanupRuntimePaths: string[];
  hookScriptEvents: Record<string, string>;
  hookScriptPrefix: string;
  packageRunner: 'npx';
  projectMarker: string;
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
  // A file may carry an ordered list of patches. Patches apply in list order and
  // unpatch in reverse, so the patch that owns file removal
  // (removeFileIfContentEquals) runs last on uninstall. See #269.
  textPatches: Record<string, TextPatchDefinition | TextPatchDefinition[]>;
  legacyTextPatches: Record<string, TextPatchDefinition>; // Remove old managed text patches without installing them
  contracts: Record<string, ContractDefinition>; // Files that must contain specific strings (predicate parity)
  codexMigration: CodexMigrationDefinition; // Historical Codex identities retained until explicit finalization
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
    let mcpServers = { ...(existing.mcpServers as Record<string, unknown>) };

    // Delete only definitions that are still byte-for-byte Safeword defaults.
    // Add-if-missing cannot prove ownership of a key that a customer later edits,
    // so ambiguous/customized entries must survive uninstall.
    for (const name of ['context7', 'playwright'] as const) {
      if (JSON.stringify(mcpServers[name]) === JSON.stringify(MCP_SERVERS[name])) {
        mcpServers = Object.fromEntries(Object.entries(mcpServers).filter(([key]) => key !== name));
      }
    }

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

const CURSOR_SHARED_SKILL_FILES = [
  'audit/SKILL.md',
  'bdd/SKILL.md',
  'bdd/DISCOVERY.md',
  'bdd/PLAN_IMPLEMENTATION.md',
  'bdd/SCENARIOS.md',
  'bdd/TDD.md',
  'bdd/DONE.md',
  'bdd/SPLITTING.md',
  'bdd/VERIFY.md',
  'brainstorm/SKILL.md',
  'cleanup-zombies/SKILL.md',
  'closeout/SKILL.md',
  'debug/SKILL.md',
  'demand-research/SKILL.md',
  'elicit/SKILL.md',
  'explain/SKILL.md',
  'figure-it-out/SKILL.md',
  'finish-review/SKILL.md',
  'finish-review/REVIEWER.md',
  'lint/SKILL.md',
  'pr-readiness/SKILL.md',
  'quality-review/SKILL.md',
  'refactor/SKILL.md',
  'retro/SKILL.md',
  'retro-filer/SKILL.md',
  'review-spec/SKILL.md',
  'self-review/SKILL.md',
  'spike/SKILL.md',
  'tdd-review/SKILL.md',
  'testing/SKILL.md',
  'ticket-system/SKILL.md',
  'verify/SKILL.md',
] as const;

const CURSOR_SHARED_SKILL_OWNED_FILES: Record<string, FileDefinition> = Object.fromEntries(
  CURSOR_SHARED_SKILL_FILES.map(path => [
    `.safeword/skills/${path}`,
    { template: `skills/${path}` },
  ]),
);

const CURSOR_SHARED_SKILL_DIRS = [
  '.safeword/skills',
  ...new Set(CURSOR_SHARED_SKILL_FILES.map(path => `.safeword/skills/${path.split('/', 1)[0]}`)),
];

function skipCodexRuntimeAssetInstall(): undefined {
  return;
}

const CODEX_RUNTIME_ASSET_FILENAMES = [
  'pre-tool-quality.ts',
  'pre-tool-quality-helpers.ts',
  'post-tool-quality.ts',
  'post-tool-skill-nudge.ts',
  'stop.ts',
] as const;

const CODEX_RUNTIME_ASSETS: Record<string, ManagedFileDefinition> = Object.fromEntries(
  CODEX_RUNTIME_ASSET_FILENAMES.map(file => [
    `.safeword/hooks/codex/${file}`,
    {
      dogfoodParity: true,
      template: `hooks/codex/${file}`,
      generator: skipCodexRuntimeAssetInstall,
    },
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
 * siblings (tickets/, learnings/, principles.md, personas.md, glossary.md,
 * surfaces.md) stay tracked.
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
  '.safeword/config.local.json',
  '.safeword/retro-attempts/',
  '.safeword/retro-drafts/',
  '.safeword/self-reports/',
  '.safeword/boundary-audit.jsonl',
  // Native Claude plugin migration state. The plugin's UserPromptSubmit hook
  // writes these directly every session — plugin mode, the attention record it
  // dedupes advisories against, the per-session launch claims, and the durable
  // cleanup transaction. `attempts-v1/` in particular grows one file per Claude
  // session, so tracking it would commit churn to every customer repository.
  '.safeword/claude-plugin/',
  '.safeword/state/reviews/',
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
 * test:bdd script. The `safeword doctor` leftover-scaffold advisory
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
function bddLaneFile(templatePath: string): ManagedFileDefinition {
  const templateContent = (): string =>
    readFile(nodePath.join(getTemplatesDirectory(), templatePath));
  return {
    // `template` declares provenance for the schema↔templates contract;
    // the generator (which takes precedence) gates on harness detection.
    template: templatePath,
    generator: (ctx: ProjectContext): string | undefined =>
      ctx.projectType.scaffoldBddLane ? templateContent() : undefined,
    removeIfUnmodified: templateContent,
  };
}

function prReviewEnabled(cwd: string): boolean {
  const content = readFileSafe(nodePath.join(cwd, '.safeword', 'config.json'));
  if (content === undefined) return false;

  try {
    const config = JSON.parse(content) as { prReview?: { enabled?: unknown } };
    return config.prReview?.enabled === true;
  } catch {
    return false;
  }
}

function normalizePrReviewWorkflowVersionPins(content: string): string {
  const commandPrefix = 'npx --yes safeword@';
  const segments = content.split(commandPrefix);
  return segments
    .map((segment, index) => {
      if (index === 0) return segment;
      const end = segment.search(/\s/u);
      if (end === -1) return segment;
      const version = segment.slice(0, end);
      const coreIdentifiers = version.split('-', 1)[0]?.split('.') ?? [];
      const isSemver =
        coreIdentifiers.length === 3 &&
        coreIdentifiers.every(identifier => {
          const numeric = Number(identifier);
          return Number.isSafeInteger(numeric) && numeric >= 0 && String(numeric) === identifier;
        });
      return isSemver ? `__SAFEWORD_VERSION__${segment.slice(end)}` : segment;
    })
    .join(commandPrefix);
}

function prReviewWorkflowFile(templatePath: string): ManagedFileDefinition {
  const workflowContent = (): string =>
    readFile(nodePath.join(getTemplatesDirectory(), templatePath))
      .split('__SAFEWORD_VERSION__')
      .join(VERSION);

  return {
    template: templatePath,
    generator: (ctx: ProjectContext): string | undefined =>
      prReviewEnabled(ctx.cwd) ? workflowContent() : undefined,
    normalizeForUnmodifiedComparison: normalizePrReviewWorkflowVersionPins,
    // The pin names the safeword these workflows fetch from npm. They carry write
    // scopes under `pull_request_target` and check nothing out, so the version
    // cannot come from the repo and has to be written into the file — which meant
    // it froze at whichever release first installed it. Refresh it on upgrade,
    // while the workflow is still safeword's own.
    refreshWhileUnmodified: true,
    removeIfUnmodified: workflowContent,
    removeWhenGeneratorOmitted: true,
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
    content: `${boundaryShimCommand(at)} ${BOUNDARY_SHIM_MARKER}: warn-only; removed by \`safeword uninstall --agents=none\`\n`,
    marker: BOUNDARY_SHIM_MARKER,
    rerender: true,
    // A hook file that setup alone created holds nothing but the shim after
    // unpatch — delete it rather than leave an empty husk (TB1.R5).
    removeFileIfContentEquals: ['', '\n'],
    when: ctx => ctx.hookManager === 'husky',
  };
}

/** The canonical schema is plugin-only for Codex. */
export const SAFEWORD_SCHEMA: SafewordSchema = {
  version: VERSION,
  codexMigration: CODEX_MIGRATION_SCHEMA,

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
    ...CURSOR_SHARED_SKILL_DIRS,
    '.cursor',
    '.cursor/rules',
    '.cursor/commands',
    '.cursor/agents',
    '.opencode',
    '.opencode/commands',
    '.opencode/agents',
  ],

  // Directories we add to but don't own (not deleted on reset)
  sharedDirs: [
    '.claude',
    '.claude/skills',
    '.claude/commands',
    // Custom-agent homes (GH628F): users keep their own agents in this dir —
    // add-to, never own. Codex is plugin-only and receives no project scaffold.
    '.claude/agents',
    // Project-owned namespace directories. Safeword creates these when missing,
    // but uninstall must leave the resolved namespace byte-for-byte untouched.
    '.safeword-project/learnings',
    '.safeword-project/tickets',
    '.safeword-project/tickets/completed',
    '.safeword-project/tmp',
  ],

  // Runtime data directories removed on reset only when empty.
  preservedDirs: [
    '.safeword/logs',
    // Runtime cloud-filing spool (BNGK9W) — per-session drafts + nudge markers the
    // retro writes at runtime; user/runtime data the schema does not own.
    '.safeword/retro-drafts',
    // Runtime self-report capture (already in SAFEWORD_TRANSIENT_PATHS /
    // gitignore) — per-session JSONL the hooks write; without this entry the
    // schema-drift test fails for any session that recorded a signal.
    '.safeword/self-reports',
    // Authored collisions retained during automatic .safeword-project → .project
    // migration. Recovery copies are user data, not deployed framework assets.
    '.safeword/namespace-migration-conflicts-v1',
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
    // Legacy Codex assets are intentionally absent. Generic maintenance must
    // preserve them until explicit, proof-gated migration finalization.
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
    // Legacy Codex skill directories remain until explicit migration finalization.
  ],

  // Files owned by safeword (overwritten on upgrade if content changed)
  // (bddLaneFile entries: see the helper defined above the schema)
  ownedFiles: {
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
    '.safeword/hooks/lib/audit-scope.sh': {
      template: 'hooks/lib/audit-scope.sh',
    },
    '.safeword/hooks/resolve-namespace-root.ts': {
      template: 'hooks/resolve-namespace-root.ts',
    },
    '.safeword/hooks/resolve-verify-ticket.ts': {
      template: 'hooks/resolve-verify-ticket.ts',
    },
    '.safeword/hooks/resolve-project-knowledge.ts': {
      template: 'hooks/resolve-project-knowledge.ts',
    },
    '.safeword/hooks/audit-principle-trace.ts': {
      template: 'hooks/audit-principle-trace.ts',
    },
    '.safeword/hooks/record-skill-invocation.ts': {
      template: 'hooks/record-skill-invocation.ts',
    },
    '.safeword/hooks/run-review.ts': {
      template: 'hooks/run-review.ts',
    },

    // Hooks shared library - TypeScript with Bun runtime
    '.safeword/hooks/lib/active-ticket.ts': { template: 'hooks/lib/active-ticket.ts' },
    '.safeword/hooks/lib/feature-provenance.ts': { template: 'hooks/lib/feature-provenance.ts' },
    '.safeword/hooks/lib/inspiration.ts': { template: 'hooks/lib/inspiration.ts' },
    '.safeword/hooks/lib/markdown-structure.ts': { template: 'hooks/lib/markdown-structure.ts' },
    '.safeword/hooks/lib/architecture-document-nudge.ts': {
      template: 'hooks/lib/architecture-document-nudge.ts',
    },
    '.safeword/hooks/lib/architecture-staged-scope.ts': {
      template: 'hooks/lib/architecture-staged-scope.ts',
    },
    '.safeword/hooks/lib/branch-staleness.ts': { template: 'hooks/lib/branch-staleness.ts' },
    '.safeword/hooks/lib/blocked-on-gate.ts': { template: 'hooks/lib/blocked-on-gate.ts' },
    '.safeword/hooks/lib/closeout-binding.ts': { template: 'hooks/lib/closeout-binding.ts' },
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
    '.safeword/hooks/lib/host-toolchain.ts': { template: 'hooks/lib/host-toolchain.ts' },
    '.safeword/hooks/lib/quality.ts': { template: 'hooks/lib/quality.ts' },
    '.safeword/hooks/lib/quality-state.ts': { template: 'hooks/lib/quality-state.ts' },
    '.safeword/hooks/lib/run-identity.ts': { template: 'hooks/lib/run-identity.ts' },
    '.safeword/hooks/lib/dependency-readiness.ts': {
      template: 'hooks/lib/dependency-readiness.ts',
    },
    '.safeword/hooks/lib/done-gate.ts': { template: 'hooks/lib/done-gate.ts' },
    '.safeword/hooks/lib/jsonl-spool.ts': { template: 'hooks/lib/jsonl-spool.ts' },
    '.safeword/hooks/lib/namespace-root.ts': { template: 'hooks/lib/namespace-root.ts' },
    '.safeword/hooks/lib/drain-retro-spool.ts': { template: 'hooks/lib/drain-retro-spool.ts' },
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
    '.safeword/hooks/lib/project-knowledge.ts': { template: 'hooks/lib/project-knowledge.ts' },
    '.safeword/hooks/lib/principle-trace.ts': { template: 'hooks/lib/principle-trace.ts' },
    '.safeword/hooks/lib/plan-gate.ts': { template: 'hooks/lib/plan-gate.ts' },
    '.safeword/hooks/lib/product-plan-contract.ts': {
      template: 'hooks/lib/product-plan-contract.ts',
    },
    '.safeword/hooks/lib/replan-relevance.ts': { template: 'hooks/lib/replan-relevance.ts' },
    '.safeword/hooks/lib/replan.ts': { template: 'hooks/lib/replan.ts' },
    '.safeword/hooks/lib/review-ledger.ts': { template: 'hooks/lib/review-ledger.ts' },
    '.safeword/hooks/lib/review-receipt.ts': { template: 'hooks/lib/review-receipt.ts' },
    '.safeword/hooks/lib/read-receipt.ts': { template: 'hooks/lib/read-receipt.ts' },
    '.safeword/hooks/lib/verify-stamp-claims.ts': { template: 'hooks/lib/verify-stamp-claims.ts' },
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
    '.safeword/hooks/session-reply-format.ts': {
      template: 'hooks/session-reply-format.ts',
    },
    '.safeword/hooks/session-codex-start.ts': {
      template: 'hooks/session-codex-start.ts',
      // Packaged by the CLI for native Codex dispatch, but no longer copied
      // into projects. Existing copies are legacy migration inputs.
      generator: (): undefined => undefined,
    },
    '.safeword/hooks/session-cursor-auto-upgrade.ts': {
      template: 'hooks/session-cursor-auto-upgrade.ts',
    },
    '.safeword/hooks/session-dependency-readiness.ts': {
      template: 'hooks/session-dependency-readiness.ts',
    },
    '.safeword/hooks/dependency-bootstrap.ts': {
      template: 'hooks/dependency-bootstrap.ts',
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
    '.claude/agents/safeword-reviewer.md': { template: 'agents/safeword-reviewer.md' },
    '.cursor/agents/safeword-reviewer.md': { template: 'agents/safeword-reviewer.md' },

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
    '.safeword/guides/skill-eval-optimization-guide.md': {
      template: 'guides/skill-eval-optimization-guide.md',
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
    // Upstream-workaround tripwire scaffold (issue #1907) — header runbook +
    // pinned-version test, emitted when a workaround's removal depends on
    // someone else's release. See guides/testing-guide.md.
    '.safeword/templates/tripwire-template.md': {
      template: 'doc-templates/tripwire-template.md',
    },
    // Per-ticket spec.md scaffold (ticket Y2HCNJ). ticket-writer reads this
    // from the bundled templates dir when scaffolding a feature's spec.md;
    // deployed here so it joins the other artifact templates and stays in the
    // schema's ownedFiles manifest.
    '.safeword/templates/spec-template.md': {
      template: 'spec-template.md',
    },
    '.safeword/templates/child-spec-template.md': {
      template: 'child-spec-template.md',
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
    '.safeword/scripts/closeout-cleanup.ts': {
      template: 'scripts/closeout-cleanup.ts',
    },

    // Host-neutral skill materialization retained for Cursor's thin wrappers.
    // Claude loads the same canonical sources from its native plugin cache.
    ...CURSOR_SHARED_SKILL_OWNED_FILES,

    // Claude skills (short names, auto-trigger + explicit invocation)
    '.claude/skills/debug/SKILL.md': {
      template: 'skills/debug/SKILL.md',
    },
    '.claude/skills/quality-review/SKILL.md': {
      template: 'skills/quality-review/SKILL.md',
    },
    '.claude/skills/pr-readiness/SKILL.md': {
      template: 'skills/pr-readiness/SKILL.md',
    },
    '.claude/skills/demand-research/SKILL.md': {
      template: 'skills/demand-research/SKILL.md',
    },
    '.claude/skills/finish-review/SKILL.md': {
      template: 'skills/finish-review/SKILL.md',
    },
    '.claude/skills/finish-review/REVIEWER.md': {
      template: 'skills/finish-review/REVIEWER.md',
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
    '.claude/skills/closeout/SKILL.md': { template: 'skills/closeout/SKILL.md' },
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
    '.claude/skills/spike/SKILL.md': { template: 'skills/spike/SKILL.md' },
    '.claude/skills/retro-filer/SKILL.md': {
      template: 'skills/retro-filer/SKILL.md',
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

    // OpenCode reads thin plural-form stubs and discovers canonical bodies via .claude/skills.
    ...OPENCODE_CATALOGUE_OWNED_FILES,

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
    // Project-root audit config is scaffolded when absent, then customer-owned.
    // Full uninstall removes it only while it still matches Safeword's template.
    '.jscpd.json': { template: '.jscpd.json' },

    // Explicit remote-test setup owns publication; ordinary reconciliation
    // catalogues these bytes without installing them.
    '.github/workflows/safeword-remote-tests.yml': {
      template: 'workflows/remote-tests.yml',
      generator: (): undefined => undefined,
      dogfoodParity: true,
    },

    // Package-owned Codex runtime adapters. Their generator intentionally
    // returns undefined: the plugin CLI executes them from the npm package,
    // never from a customer repository.
    ...CODEX_RUNTIME_ASSETS,

    // BDD acceptance lane working files (ticket 102b) — scaffolded once; the
    // customer owns them thereafter (created if missing, updated only while
    // still safeword's template content). The lane config (cucumber.mjs) is
    // safeword-owned in ownedFiles. All suppressed when the repo has its own
    // cucumber harness (56JCFZ).
    'features/safeword-lane.feature': bddLaneFile('cucumber/safeword-lane.feature'),
    'steps/world.ts': bddLaneFile('cucumber/world.ts'),
    'steps/shared.steps.ts': bddLaneFile('cucumber/shared.steps.ts'),

    // Default-off advisory PR review. Customers may customize managed workflow
    // files after setup; reconciliation updates only unchanged template content.
    '.github/workflows/safeword-pr-review.yml': prReviewWorkflowFile('workflows/pr-review.yml'),
    '.github/workflows/safeword-pr-review-publisher.yml': prReviewWorkflowFile(
      'workflows/pr-review-publisher.yml',
    ),
    '.github/workflows/safeword-pr-review-worker.yml': prReviewWorkflowFile(
      'workflows/pr-review-worker.yml',
    ),

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

    // Project principles — scaffolded once; users author the small, durable set
    // that guides product and technical decisions. Like personas, a configured
    // paths.principles override suppresses the default scaffold uniformly.
    '.safeword-project/principles.md': {
      template: 'principles-template.md',
      configKey: 'principles',
    },

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
          const withoutCurrentHooks = filterOutEquivalentSafewordHooks(eventHooks, newHooks);
          const nonSafewordHooks = filterOutSafewordHooks(
            withoutCurrentHooks,
            acceptedHistoricalHookEntries(event),
          );
          mergedHooks[event] = [...nonSafewordHooks, ...newHooks];
        }

        return { ...existing, hooks: mergedHooks };
      },
      unmerge: existing => {
        // Remove only safeword hooks, preserve custom hooks
        const existingHooks = (existing.hooks as Record<string, unknown[]>) ?? {};
        const cleanedHooks: Record<string, unknown[]> = {};

        for (const [event, eventHooks] of Object.entries(existingHooks)) {
          const withoutCurrentHooks = filterOutEquivalentSafewordHooks(
            eventHooks,
            SETTINGS_HOOKS[event as keyof typeof SETTINGS_HOOKS] ?? [],
          );
          const nonSafewordHooks = filterOutSafewordHooks(
            withoutCurrentHooks,
            acceptedHistoricalHookEntries(event),
          );
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
          const nonSafewordHooks = filterOutEquivalentSafewordHooks(eventHooks, newHooks);
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
            .map(
              ([name, eventHooks]) =>
                [
                  name,
                  filterOutEquivalentSafewordHooks(
                    eventHooks,
                    CURSOR_HOOKS[name as keyof typeof CURSOR_HOOKS] ?? [],
                  ),
                ] as const,
            )
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
      // A stable header plus rerender heals the block whenever the transient
      // path list grows and lets uninstall recognize older variants.
      rerender: true,
      // eslint-disable-next-line security/detect-non-literal-regexp -- derived only from the source-controlled constant above
      rerenderOwnedLinePattern: new RegExp(
        `^(?:${SAFEWORD_TRANSIENT_PATHS.map(path =>
          path.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`),
        ).join('|')})$`,
        'u',
      ),
      marker: '# Safeword - Local cache and transient state',
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
      replacementAfterUnpatch: ctx =>
        `\n# Project namespace exclusions (preserved after Safeword uninstall)\n${durableNamespaceDirectories(
          ctx,
        )
          .map(dir => `${dir}/`)
          .join('\n')}\n`,
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
      rerenderOwnedLinePattern:
        /^(?:\*\*\/architecture\.generated\.md|.+\/tickets\/INDEX(?:-completed)?\.md) merge=union linguist-generated=true$/u,
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
      // Cursor's stop hook imports QUALITY_REVIEW_MESSAGE. The grammar, renderer,
      // and evaluator exports keep proactive wording and Stop validation coupled;
      // requiring individual labels here would create a second grammar source.
      requires: [
        'QUALITY_REVIEW_MESSAGE',
        // prompt-questions.ts imports all three pre-response pointers; the Stop
        // header composes the bare rule inline. Removing any one forks the
        // reply-shape vocabulary back across two hooks.
        'REPLY_FORMAT_LEAD_RULE',
        'REPLY_FORMAT_LEAD',
        'REPLY_FORMAT_REMINDER',
        'DECISION_BRIEF_GRAMMAR',
        'GENERIC_REVIEW_EVIDENCE',
        'renderDecisionBriefContract',
        'renderDecisionBriefCorrection',
        'evaluateDecisionBriefCompliance',
        'getQualityEvidence',
      ],
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

export type ProjectSurface = 'core' | 'cursor' | 'opencode';

type SchemaPathCollection =
  | 'ownedDirs'
  | 'sharedDirs'
  | 'preservedDirs'
  | 'deprecatedFiles'
  | 'deprecatedDirs'
  | 'ownedFiles'
  | 'managedFiles'
  | 'jsonMerges'
  | 'textPatches'
  | 'legacyTextPatches'
  | 'contracts';

const ALL_SCHEMA_PATH_COLLECTIONS: readonly SchemaPathCollection[] = [
  'ownedDirs',
  'sharedDirs',
  'preservedDirs',
  'deprecatedFiles',
  'deprecatedDirs',
  'ownedFiles',
  'managedFiles',
  'jsonMerges',
  'textPatches',
  'legacyTextPatches',
  'contracts',
];

function filterPathEntries<T>(values: Record<string, T>, keepPath: (path: string) => boolean) {
  return Object.fromEntries(Object.entries(values).filter(([path]) => keepPath(path)));
}

function filterSelectedPathList(
  collections: ReadonlySet<SchemaPathCollection>,
  collection: SchemaPathCollection,
  values: string[],
  keepPath: (path: string) => boolean,
): string[] {
  return collections.has(collection) ? values.filter(path => keepPath(path)) : values;
}

function filterSelectedPathEntries<T>(
  collections: ReadonlySet<SchemaPathCollection>,
  collection: SchemaPathCollection,
  values: Record<string, T>,
  keepPath: (path: string) => boolean,
): Record<string, T> {
  return collections.has(collection) ? filterPathEntries(values, keepPath) : values;
}

/** Filter selected path-bearing schema collections while preserving every other contract. */
export function filterSchemaPaths(
  schema: SafewordSchema,
  keepPath: (path: string) => boolean,
  collections: readonly SchemaPathCollection[] = ALL_SCHEMA_PATH_COLLECTIONS,
): SafewordSchema {
  const filters = new Set(collections);
  return {
    ...schema,
    ownedDirs: filterSelectedPathList(filters, 'ownedDirs', schema.ownedDirs, keepPath),
    sharedDirs: filterSelectedPathList(filters, 'sharedDirs', schema.sharedDirs, keepPath),
    preservedDirs: filterSelectedPathList(filters, 'preservedDirs', schema.preservedDirs, keepPath),
    deprecatedFiles: filterSelectedPathList(
      filters,
      'deprecatedFiles',
      schema.deprecatedFiles,
      keepPath,
    ),
    deprecatedDirs: filterSelectedPathList(
      filters,
      'deprecatedDirs',
      schema.deprecatedDirs,
      keepPath,
    ),
    ownedFiles: filterSelectedPathEntries(filters, 'ownedFiles', schema.ownedFiles, keepPath),
    managedFiles: filterSelectedPathEntries(filters, 'managedFiles', schema.managedFiles, keepPath),
    jsonMerges: filterSelectedPathEntries(filters, 'jsonMerges', schema.jsonMerges, keepPath),
    textPatches: filterSelectedPathEntries(filters, 'textPatches', schema.textPatches, keepPath),
    legacyTextPatches: filterSelectedPathEntries(
      filters,
      'legacyTextPatches',
      schema.legacyTextPatches,
      keepPath,
    ),
    contracts: filterSelectedPathEntries(filters, 'contracts', schema.contracts, keepPath),
  };
}

const CURSOR_PROJECT_PATHS = new Set([
  '.safeword/hooks/lib/cursor-state.ts',
  '.safeword/hooks/session-cursor-auto-upgrade.ts',
]);

export function isCursorProjectPath(path: string): boolean {
  return (
    path === '.cursor' ||
    path.startsWith('.cursor/') ||
    path === '.safeword/hooks/cursor' ||
    path.startsWith('.safeword/hooks/cursor/') ||
    CURSOR_PROJECT_PATHS.has(path)
  );
}

export function isOpenCodeProjectPath(path: string): boolean {
  return path === '.opencode' || path.startsWith('.opencode/');
}

/** Select project-owned surfaces without scattering Cursor path filters through commands. */
export function schemaForProjectSurfaces(
  schema: SafewordSchema,
  surfaces: readonly ProjectSurface[],
): SafewordSchema {
  return filterSchemaPaths(
    schema,
    path =>
      (surfaces.includes('cursor') || !isCursorProjectPath(path)) &&
      (surfaces.includes('opencode') || !isOpenCodeProjectPath(path)),
  );
}

const SHARED_AGENT_RUNTIME_ROOTS = [
  '.safeword/hooks',
  '.safeword/skills',
  '.safeword/scripts',
  '.safeword/guides',
  '.safeword/templates',
  // Imports from .safeword/hooks/lib/* (namespace-root, re-entry) — dead
  // without the hooks tree it depends on, so it belongs in the same bucket.
  '.safeword/statusline',
];

/** `.safeword/{hooks,skills,scripts,guides,templates,statusline}` (any depth). */
export function isSharedAgentRuntimePath(path: string): boolean {
  return SHARED_AGENT_RUNTIME_ROOTS.some(root => path === root || path.startsWith(`${root}/`));
}

/**
 * Codex shells out to `.safeword/hooks/*` and `.safeword/scripts/*` directly
 * and still reads `.safeword/guides/*` and `.safeword/templates/*` from its
 * skill playbooks; legacy (pre-native-plugin) Claude delivery references all
 * five roots from its `.claude/commands|agents|skills` templates. Native
 * Claude reads its own packaged copies of every one of them instead (ticket
 * 0VG5AC), and Cursor's own subset is already carved out by
 * `schemaForProjectSurfaces`. Once none of those three still need it, this
 * whole tree is dead weight nobody upgrades — drop it rather than install
 * files nothing reads.
 */
export function schemaForSharedAgentRuntime(
  schema: SafewordSchema,
  needed: boolean,
): SafewordSchema {
  if (needed) return schema;
  return filterSchemaPaths(schema, path => !isSharedAgentRuntimePath(path));
}
