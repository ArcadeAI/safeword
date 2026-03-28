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
  /** True if project has existing lint script or linter config */
  existingLinter: boolean;
  /** True if project has existing format script or formatter config */
  existingFormatter: boolean;
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
}

export interface FileDefinition {
  template?: string; // Path in templates/ dir
  content?: string | (() => string); // Static content or factory
  generator?: (ctx: ProjectContext) => string | undefined; // Dynamic generator, undefined = skip file
}

// managedFiles: created if missing, updated only if content === current template output
export type ManagedFileDefinition = FileDefinition;

export interface JsonMergeDefinition {
  keys: string[]; // Dot-notation keys we manage
  conditionalKeys?: Record<string, string[]>; // Keys added based on project type
  merge: (existing: Record<string, unknown>, ctx: ProjectContext) => Record<string, unknown>;
  unmerge: (existing: Record<string, unknown>, ctx: ProjectContext) => Record<string, unknown>;
  removeFileIfEmpty?: boolean; // Delete file if our keys were the only content
  skipIfMissing?: boolean; // Don't create file if it doesn't exist (for optional integrations)
}
