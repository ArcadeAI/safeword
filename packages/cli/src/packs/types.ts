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
  python: boolean; // pyproject.toml OR requirements.txt exists
  golang: boolean; // go.mod exists
  rust: boolean; // Cargo.toml exists
  sql: boolean; // dbt_project.yml (or other SQL tool markers) exists
}

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
   * 'cucumber.yaml'), undefined when none. Suppresses the starter BDD lane —
   * files, deps, and test:bdd script — so setup adopts the host's harness
   * instead of scaffolding a second one (ticket 56JCFZ, issue #645).
   */
  existingCucumberHarness: string | undefined;
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

export interface LanguagePack {
  id: string;
  name: string;
  extensions: string[];
  detect: (cwd: string) => boolean;
  setup: (cwd: string, ctx: SetupContext) => SetupResult;
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
   * Optional logical key linking this entry to a user-configurable path
   * override in `.safeword/config.json` (`paths.<configKey>`). When the
   * override is set, reconcile suppresses this entry uniformly — install
   * skips the scaffold, uninstall-full skips the removal. The user owns
   * the file at the configured location; safeword stops treating the
   * default location as its concern.
   *
   * See ticket K7N2QM for the data-loss-prevention rationale.
   */
  configKey?: 'personas' | 'glossary' | 'surfaces' | 'architecture';
}

export interface JsonMergeDefinition {
  keys: string[]; // Dot-notation keys we manage
  conditionalKeys?: Record<string, string[]>; // Keys added based on project type
  merge: (existing: Record<string, unknown>, ctx: ProjectContext) => Record<string, unknown>;
  unmerge: (existing: Record<string, unknown>, ctx: ProjectContext) => Record<string, unknown>;
  removeFileIfEmpty?: boolean; // Delete file if our keys were the only content
  skipIfMissing?: boolean; // Don't create file if it doesn't exist (for optional integrations)
}
