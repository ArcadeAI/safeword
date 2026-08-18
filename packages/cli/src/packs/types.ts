/**
 * Language Pack Types
 *
 * Shared types used by schema.ts, pack files, and project-detector.
 * This file is the canonical home for types that both utils/ and packs/ need,
 * breaking circular dependencies between them.
 */

// ============================================================================
// Language & Project Detection Types
// ============================================================================

/**
 * Language detection result
 * @see ARCHITECTURE.md → Language Detection
 */
export interface Languages {
  javascript: boolean; // package.json exists
  python: boolean; // a supported Python manifest exists
  golang: boolean; // go.mod exists
  rust: boolean; // Cargo.toml exists
  sql: boolean; // dbt_project.yml (or other SQL tool markers) exists
}

/**
 * Which hook-manager world governs a host's git hooks (ZJMZ50, #810 child 2).
 * Detected by `utils/hook-manager.ts`; `husky` hosts get boundary-shim
 * appends, every other world gets a printed integration nudge.
 */
export type HookManagerWorld = 'husky' | 'husky-uninitialized' | 'lefthook' | 'pre-commit' | 'bare';

export interface ProjectType {
  typescript: boolean;
  react: boolean;
  nextjs: boolean;
  astro: boolean;
  vitest: boolean;
  playwright: boolean;
  tailwind: boolean;
  tanstackQuery: boolean;
  publishableLibrary: boolean;
  shell: boolean;
  /**
   * True if the repo has real JS/TS application source (not just safeword's TS
   * BDD lane scaffolding). Gates JS-app-only tooling (knip, dependency-cruiser)
   * so a pure Python/Go/Rust project doesn't receive it. (ticket BE7C7B)
   */
  hasJsSource: boolean;
  /** True if project has existing lint script or linter config */
  existingLinter: boolean;
  /** True if project has existing format script or formatter config */
  existingFormatter: boolean;
  /**
   * True if project already has its own Prettier config (`.prettierrc*`,
   * `prettier.config.*`, or a `"prettier"` key in package.json). Gates safeword's
   * own prettier-config writes so we never shadow a config we can't merge into.
   */
  existingPrettierConfig: boolean;
  /** Path to existing ESLint config if present (e.g., 'eslint.config.mjs' or '.eslintrc.json') */
  existingEslintConfig: string | undefined;
  /** True if existing ESLint config is legacy format (.eslintrc.*) requiring FlatCompat */
  legacyEslint: boolean;
  /** Path to existing ruff config ('ruff.toml' or 'pyproject.toml'), undefined if none */
  existingRuffConfig: 'ruff.toml' | 'pyproject.toml' | undefined;
  /** True if project has [tool.mypy] in pyproject.toml or mypy.ini */
  existingMypyConfig: boolean;
  /** True if project has [tool.importlinter] in pyproject.toml or .importlinter */
  existingImportLinterConfig: boolean;
  /** Path to existing golangci-lint config if present (e.g., '.golangci.yml') */
  existingGolangciConfig: string | undefined;
  /** Path to existing clippy config if present (e.g., 'clippy.toml') */
  existingClippyConfig: string | undefined;
  /** Path to existing rustfmt config if present (e.g., 'rustfmt.toml') */
  existingRustfmtConfig: string | undefined;
  /** Path to existing SQLFluff config if present (e.g., '.sqlfluff') */
  existingSqlfluffConfig: string | undefined;
  /**
   * Evidence of a cucumber harness safeword did not scaffold (e.g.
   * 'cucumber.yaml'), undefined when none. Drives the setup notice and check
   * advisories (ticket 56JCFZ, issue #645).
   */
  existingCucumberHarness: string | undefined;
  /**
   * Whether the starter BDD lane (files, deps, test:bdd) is safeword's to
   * scaffold and maintain: true when safeword's own lane is present (any
   * shipped template revision — keep maintaining it, even alongside a host
   * harness) or when no harness exists; false when a host harness is
   * detected and safeword's lane is absent (ticket 56JCFZ).
   */
  scaffoldBddLane: boolean;
}

// ============================================================================
// Pack Interface Types
// ============================================================================

export interface SetupContext {
  isGitRepo: boolean;
}

export interface SetupResult {
  files: string[];
}

/**
 * How a pack tells the harness which skills to pull.
 *
 * - `'all'` → `--skill '*'`: every skill the source publishes. Right for a
 *   single-language, single-purpose source (e.g. leonardomso's Rust pack) where
 *   everything is on-topic — and drift-free, no name list to maintain.
 * - a name list → `--skill <name...>`: a curated subset, for a multi-domain
 *   source (e.g. jeffallan's ~66-skill grab-bag, where Go/Python/TS each take one
 *   language-tier skill) where `'*'` would drag in dozens of unrelated skills. The
 *   names ARE a drift surface, justified only because the source forces it; keep
 *   the list minimal (usually one language-tier skill).
 *
 * Lives here, not in `skills/install.ts`, because packs must be able to type
 * their own manifests without importing the harness (dependency is harness →
 * pack, pull-only). `skills/install.ts` re-exports it for its own consumers.
 */
export type SkillSelection = 'all' | readonly string[];

/**
 * A pack's coding-skill declaration: pure data, no I/O and no knowledge of how
 * skills get installed. The harness (`skills/languages.ts`) reads it off the
 * pack and performs delivery — packs never import the harness.
 *
 * A pack omits `skills` entirely when it ships no coding skills (e.g. SQL).
 */
export interface PackSkillManifest {
  /** Skill source repo, e.g. `github.com/jeffallan/claude-skills`. */
  source: string;
  /** Selection policy: `'all'`, or the named subset to pull. */
  selection: SkillSelection;
  /**
   * On-disk directory-name shape the installed skills follow (e.g. `/^golang-pro$/`).
   * The harness uses it to detect an existing install (presence-gated upgrades).
   */
  dirPattern: RegExp;
}

export interface LanguagePack {
  id: string;
  name: string;
  extensions: string[];
  detect: (cwd: string) => boolean;
  setup: (cwd: string, ctx: SetupContext) => SetupResult;
  /**
   * Coding skills this pack ships, or undefined when it ships none. Declaring it
   * here makes a pack self-describing: the harness registry is DERIVED from the
   * pack registry, so adding a language is one registry row, not a row plus a
   * hand-written manifest that re-states the pack's own id and name.
   */
  skills?: PackSkillManifest;
}

// ============================================================================
// Schema Types (shared with schema.ts)
// ============================================================================

export interface ProjectContext {
  cwd: string;
  projectType: ProjectType;
  developmentDeps: Record<string, string>;
  productionDeps: Record<string, string>;
  isGitRepo: boolean;
  /** Languages detected in project (for conditional file generation) */
  languages?: Languages;
  /**
   * Absolute resolved namespace root (see `resolveNamespaceRoot`, ticket
   * AQJ95G). Reconcile translates the schema's legacy-prefixed namespace
   * paths onto this root at planning time. Optional for older callers —
   * reconcile resolves from `cwd` when absent.
   */
  namespaceRoot?: string;
  /**
   * Which hook-manager world governs the host's git hooks (ZJMZ50). Gates the
   * boundary-shim textPatches: `husky` appends, every other world nudges.
   * Optional for older callers — absent reads as unknown, and gated patches
   * do not apply.
   */
  hookManager?: HookManagerWorld;
}

export interface FileDefinition {
  template?: string; // Path in templates/ dir
  content?: string | (() => string); // Static content or factory
  // Dynamic generator, undefined = skip file. Takes precedence over template/
  // content, so an entry may declare `template` for the schema↔templates
  // contract while the generator gates on project context (56JCFZ).
  generator?: (ctx: ProjectContext) => string | undefined;
}

// managedFiles: created if missing, updated only if content === current template output
export interface ManagedFileDefinition extends FileDefinition {
  /**
   * Keep a package-owned runtime template byte-identical to its dogfood mirror.
   * Managed files normally have no mirror because customers may own their
   * content; this opt-in is for runtime assets the package executes directly.
   */
  dogfoodParity?: boolean;

  /**
   * Optional logical key linking this entry to a user-configurable path
   * override in `.safeword/config.json` (`paths.<configKey>`). When the
   * override is set, install skips the default scaffold. The key also marks
   * the managed default as project-owned knowledge, so reset --full preserves
   * it whether or not an override is active. Safeword must not delete authored
   * knowledge while removing its own configuration.
   *
   * See tickets K7N2QM and KD4C2A for the data-loss-prevention rationale.
   */
  configKey?: 'principles' | 'personas' | 'glossary' | 'surfaces' | 'architecture';

  /**
   * Opt-in conditional removal on DEFAULT reset (ticket V4MATC): uninstall
   * removes the file iff its on-disk content byte-equals this function's
   * output — an unmodified safeword scaffold. A user-extended or user-authored
   * file never matches and survives.
   *
   * Deliberately separate from `generator`: generators gate on existing-config
   * detection, and at reset time the scaffold itself trips that gate — so this
   * function regenerates the expected content gate-free. Returning undefined
   * means "cannot determine the expected scaffold here" → never remove.
   */
  removeIfUnmodified?: (ctx: ProjectContext) => string | undefined;

  /**
   * Optional canonicalization applied to both the installed file and expected
   * scaffold before the unmodified comparison. Use only for framework-owned
   * substitutions whose old rendered values remain safe to remove, such as a
   * version pin from an earlier Safeword release.
   */
  normalizeForUnmodifiedComparison?: (content: string) => string;

  /**
   * Remove an unmodified managed file during upgrade when its generator now
   * returns undefined. This is the opt-out counterpart to a conditional
   * scaffold: turning the feature off removes Safeword's exact bytes, while a
   * customized file survives. Requires `removeIfUnmodified` so omission can
   * never authorize a blind delete.
   */
  removeWhenGeneratorOmitted?: boolean;
}

export interface JsonMergeDefinition {
  keys: string[]; // Dot-notation keys we manage
  conditionalKeys?: Record<string, string[]>; // Keys added based on project type
  merge: (existing: Record<string, unknown>, ctx: ProjectContext) => Record<string, unknown>;
  unmerge: (existing: Record<string, unknown>, ctx: ProjectContext) => Record<string, unknown>;
  removeFileIfEmpty?: boolean; // Delete file if our keys were the only content
  skipIfMissing?: boolean; // Don't create file if it doesn't exist (for optional integrations)
}
