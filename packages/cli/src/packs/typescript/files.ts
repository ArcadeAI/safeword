/**
 * TypeScript/JavaScript Language Pack - Schema Definitions
 *
 * All JS/TS specific file definitions, JSON merges, and packages.
 * Imported by schema.ts and spread into SAFEWORD_SCHEMA.
 *
 * Note: Generator functions return `string | undefined` by design (undefined = skip file).
 * This conflicts with sonarjs/no-inconsistent-returns vs unicorn/no-useless-undefined (#1199).
 * Inline disables target only generator arrow functions, not regular functions in this file.
 */

import {
  dirGlobExcludeMerge,
  resolvedIgnoreDirectories,
  resolvedNamespaceDirectory,
} from '../../owned-paths.js';
import { getEslintConfig, getSafewordEslintConfig } from '../../templates/config.js';
import { assignOrPrune } from '../../utils/json-merge.js';
import type {
  FileDefinition,
  JsonMergeDefinition,
  ManagedFileDefinition,
  ProjectContext,
} from '../types.js';

// ============================================================================
// Shared Definitions
// ============================================================================

/**
 * Add framework-specific ignores to Knip config.
 */
function addKnipIgnores(config: { ignore: string[] }, ctx: ProjectContext): void {
  const allDependencies = ctx.developmentDeps;

  // Framework build/cache directories
  if (ctx.projectType.nextjs) config.ignore.push('.next/**');
  if (ctx.projectType.astro) config.ignore.push('.astro/**');
  if ('storybook' in allDependencies || '@storybook/react' in allDependencies) {
    config.ignore.push('.storybook/**', 'storybook-static/**');
  }
  if ('turbo' in allDependencies) config.ignore.push('.turbo/**');

  // Electron - Knip has no Electron plugin
  if ('electron' in allDependencies || 'electron' in ctx.productionDeps) {
    config.ignore.push('electron/**', 'dist-electron/**', 'out/**');
  }
}

/**
 * Add framework-specific ignoreDependencies to Knip config.
 */
function addKnipIgnoreDependencies(
  config: { ignoreDependencies: string[] },
  ctx: ProjectContext,
): void {
  const allDependencies = ctx.developmentDeps;

  // Dependencies used via config files, not imports
  if (ctx.projectType.tailwind) {
    config.ignoreDependencies.push('tailwindcss', '@tailwindcss/typography', '@tailwindcss/forms');
  }
  if (ctx.projectType.playwright) config.ignoreDependencies.push('@playwright/test');
  if ('husky' in allDependencies) config.ignoreDependencies.push('husky');
  if ('lint-staged' in allDependencies) config.ignoreDependencies.push('lint-staged');

  // Electron ecosystem packages
  if ('electron' in allDependencies || 'electron' in ctx.productionDeps) {
    config.ignoreDependencies.push(
      'electron',
      'electron-builder',
      'electron-updater',
      'electron-devtools-installer',
      'electron-is-dev',
      'electron-store',
    );
  }
}

/**
 * Generate Knip config based on project type.
 * Adds framework-specific ignores and ignoreDependencies.
 * Knip plugins auto-enable based on deps, so we just configure ignore patterns.
 */
function getKnipConfig(ctx: ProjectContext): object {
  // A custom paths.projectRoot is added alongside the two well-known roots so
  // Knip doesn't scan (and false-positive on) the custom namespace dir (#273).
  // NB: Knip's ignore is intentionally just the namespace roots, not the full
  // safewordIgnoreDirectories/resolvedIgnoreDirectories list — so resolve the
  // custom root directly here rather than reusing that composer.
  const customRoot = resolvedNamespaceDirectory(ctx);
  const config = {
    ignore: [
      '.safeword/**',
      '.project/**',
      '.safeword-project/**',
      ...(customRoot === undefined ? [] : [`${customRoot}/**`]),
    ],
    ignoreDependencies: ['safeword', 'dependency-cruiser'],
  };

  addKnipIgnores(config, ctx);
  addKnipIgnoreDependencies(config, ctx);

  return config;
}

/**
 * Prettier styling defaults - shared between .safeword/.prettierrc and root .prettierrc
 */
const PRETTIER_DEFAULTS = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  printWidth: 100,
  endOfLine: 'lf',
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'avoid',
} as const;

/**
 * Get Prettier plugins based on project type.
 * Tailwind plugin must be last for proper class sorting.
 */
function getPrettierPlugins(projectType: {
  astro?: boolean;
  shell?: boolean;
  tailwind?: boolean;
}): string[] {
  const plugins: string[] = [];
  if (projectType.astro) plugins.push('prettier-plugin-astro');
  if (projectType.shell) plugins.push('prettier-plugin-sh');
  if (projectType.tailwind) plugins.push('prettier-plugin-tailwindcss');
  return plugins;
}

/**
 * Biome config merge - adds safeword files to excludes list.
 * Biome v2 uses `includes` with `!` prefix for exclusions.
 */
const BIOME_JSON_MERGE: JsonMergeDefinition = {
  keys: ['files.includes'],
  skipIfMissing: true, // Only modify if project already uses Biome
  merge: (existing, ctx) => {
    const files = (existing.files as Record<string, unknown>) ?? {};
    const existingIncludes = Array.isArray(files.includes) ? files.includes : [];

    // Add safeword exclusions (! prefix) if not already present, sourced from
    // the single SAFEWORD_IGNORE_DIRS list (ticket EYRK34) so Biome skips every
    // safeword-owned dir, not just .safeword/ — including a custom paths.projectRoot
    // (issue #273). Biome v2.2.0+ doesn't need /**.
    const safewordExcludes = [
      '!eslint.config.mjs',
      ...resolvedIgnoreDirectories(ctx).map(dir => `!${dir}`),
    ];
    const newIncludes = [...existingIncludes];
    for (const exclude of safewordExcludes) {
      if (!newIncludes.includes(exclude)) {
        newIncludes.push(exclude);
      }
    }

    return {
      ...existing,
      files: {
        ...files,
        includes: newIncludes,
      },
    };
  },
  unmerge: (existing, ctx) => {
    const files = (existing.files as Record<string, unknown>) ?? {};
    const existingIncludes = Array.isArray(files.includes) ? files.includes : [];

    // Remove safeword exclusions from includes list (current set + the legacy
    // '!.safeword/**' folder form, cleaned up on unmerge). Mirrors merge, so a
    // custom paths.projectRoot exclusion is also removed (issue #273).
    const safewordExcludes = new Set([
      '!eslint.config.mjs',
      '!.safeword/**',
      ...resolvedIgnoreDirectories(ctx).map(dir => `!${dir}`),
    ]);
    const cleanedIncludes = existingIncludes.filter(
      (entry: string) => !safewordExcludes.has(entry),
    );

    // Build cleaned files object
    const cleanedFiles = { ...files };
    if (cleanedIncludes.length > 0) {
      cleanedFiles.includes = cleanedIncludes;
    } else {
      delete cleanedFiles.includes;
    }

    // Remove files key entirely if empty
    if (Object.keys(cleanedFiles).length === 0) {
      const result = { ...existing };
      delete result.files;
      return result;
    }

    return { ...existing, files: cleanedFiles };
  },
};

// dprint's `excludes` and oxfmt's `ignorePatterns` both take a glob list (EYRK34).
const DPRINT_JSON_MERGE = dirGlobExcludeMerge('excludes');
const OXFMT_JSON_MERGE = dirGlobExcludeMerge('ignorePatterns');

// ============================================================================
// Owned Files (overwritten on upgrade)
// ============================================================================

export const typescriptOwnedFiles: Record<string, FileDefinition> = {
  // Language-specific safeword configs for hooks (extend project configs if they exist)
  // These configs are used by hooks for LLM enforcement with stricter rules
  '.safeword/eslint.config.mjs': {
    generator: ctx =>
      ctx.languages?.javascript
        ? getSafewordEslintConfig(
            ctx.projectType.existingEslintConfig,
            ctx.projectType.existingFormatter,
          )
        : undefined,
  },

  '.safeword/.prettierrc': {
    // eslint-disable-next-line sonarjs/no-inconsistent-returns -- generator returns undefined to skip file
    generator: ctx => {
      // Skip for non-JS projects, projects with an alternative formatter (Biome,
      // etc.), or projects that already have their own prettier config — writing
      // our own would shadow a config we can't merge into.
      if (
        !ctx.languages?.javascript ||
        ctx.projectType.existingFormatter ||
        ctx.projectType.existingPrettierConfig
      ) {
        return;
      }
      // Add plugins based on project type
      const plugins = getPrettierPlugins(ctx.projectType);
      const config = plugins.length > 0 ? { ...PRETTIER_DEFAULTS, plugins } : PRETTIER_DEFAULTS;
      return JSON.stringify(config, undefined, 2);
    },
  },
};

// ============================================================================
// Managed Files (create if missing, update if matches template)
// ============================================================================

export const typescriptManagedFiles: Record<string, ManagedFileDefinition> = {
  // Project-level ESLint config (created only if no existing ESLint config)
  'eslint.config.mjs': {
    // eslint-disable-next-line sonarjs/no-inconsistent-returns -- generator returns undefined to skip file
    generator: ctx => {
      // Skip if project already has ESLint config (safeword will use .safeword/eslint.config.mjs)
      if (ctx.projectType.existingEslintConfig) return;
      if (!ctx.languages?.javascript) return;
      return getEslintConfig(ctx.projectType.existingFormatter);
    },
  },
  // Minimal tsconfig for ESLint type-checked linting (only if missing)
  'tsconfig.json': {
    // eslint-disable-next-line sonarjs/no-inconsistent-returns -- generator returns undefined to skip file
    generator: ctx => {
      // Skip for non-JS projects (Python-only)
      if (!ctx.languages?.javascript) return;
      // Only create for TypeScript projects
      if (!ctx.developmentDeps.typescript && !ctx.developmentDeps['typescript-eslint']) {
        return;
      }
      return JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            noEmit: true,
          },
          include: ['**/*.ts', '**/*.tsx'],
          exclude: ['node_modules', 'dist', 'build'],
        },
        undefined,
        2,
      );
    },
  },
  // Knip config for dead code detection (used by /audit)
  // Plugins auto-enable based on deps, we just configure ignore patterns
  'knip.json': {
    generator: ctx =>
      ctx.projectType?.hasJsSource ? JSON.stringify(getKnipConfig(ctx), undefined, 2) : undefined,
  },
  // Project-level Prettier config (created only if no existing formatter)
  '.prettierrc': {
    // eslint-disable-next-line sonarjs/no-inconsistent-returns -- generator returns undefined to skip file
    generator: ctx => {
      // Skip for non-JS projects, projects with an alternative formatter, or
      // projects that already have their own prettier config — a new .prettierrc
      // resolves ahead of prettier.config.* and would silently shadow it.
      if (!ctx.languages?.javascript) return;
      if (ctx.projectType.existingFormatter) return;
      if (ctx.projectType.existingPrettierConfig) return;
      // Create base config with styling defaults (no plugins - those are in .safeword/.prettierrc)
      return JSON.stringify(PRETTIER_DEFAULTS, undefined, 2);
    },
  },
};

// ============================================================================
// JSON Merges
// ============================================================================

/**
 * Add a script if it doesn't exist.
 */
function addScriptIfMissing(scripts: Record<string, string>, name: string, command: string): void {
  const existing = scripts[name];
  if (!existing) scripts[name] = command;
}

const GHERKIN_LINT_SCRIPT = 'safeword lint-gherkin';

/**
 * Merge lint scripts based on project type.
 */
function mergeLintScripts(
  scripts: Record<string, string>,
  projectType: { existingLinter: boolean },
): void {
  addScriptIfMissing(scripts, 'lint:gherkin', GHERKIN_LINT_SCRIPT);
  if (projectType.existingLinter) {
    // Project with existing linter: add lint:eslint for safeword-specific rules
    addScriptIfMissing(scripts, 'lint:eslint', 'eslint .');
  } else {
    // No existing linter: ESLint is the primary linter
    addScriptIfMissing(scripts, 'lint', 'eslint . && bun run lint:gherkin');
  }
}

/**
 * Merge format scripts if no existing formatter.
 */
function mergeFormatScripts(
  scripts: Record<string, string>,
  projectType: { existingFormatter: boolean },
): void {
  if (projectType.existingFormatter) return;
  addScriptIfMissing(scripts, 'format', 'prettier --write .');
  addScriptIfMissing(scripts, 'format:check', 'prettier --check .');
}

export const typescriptJsonMerges: Record<string, JsonMergeDefinition> = {
  'package.json': {
    keys: [
      'scripts.lint',
      'scripts.lint:gherkin',
      'scripts.format',
      'scripts.format:check',
      'scripts.test:bdd',
    ],
    skipIfMissing: true, // Setup creates package.json first (ensurePackageJson), so this only skips outside setup
    conditionalKeys: {
      existingLinter: ['scripts.lint:eslint'], // Projects with existing linter get separate ESLint script
      publishableLibrary: ['scripts.publint'],
      shell: ['scripts.lint:sh'],
      hasJsSource: ['scripts.knip'], // knip script only added for repos with real JS source (BE7C7B)
    },
    merge: (existing, ctx) => {
      const scripts = { ...(existing.scripts as Record<string, string>) };
      const result = { ...existing };

      mergeLintScripts(scripts, ctx.projectType);
      mergeFormatScripts(scripts, ctx.projectType);
      // knip is JS-app dead-code detection — only for repos with real JS source (BE7C7B).
      if (ctx.projectType.hasJsSource) addScriptIfMissing(scripts, 'knip', 'knip');
      // BDD acceptance lane (ticket 102b) — add-if-absent: an existing
      // customer test:bdd script always wins. Suppressed entirely when the
      // repo has its own cucumber harness (56JCFZ).
      if (!ctx.projectType.existingCucumberHarness) {
        addScriptIfMissing(scripts, 'test:bdd', 'cucumber-js');
      }

      // Conditional scripts based on project type
      if (ctx.projectType.publishableLibrary) {
        addScriptIfMissing(scripts, 'publint', 'publint');
      }
      if (ctx.projectType.shell) {
        addScriptIfMissing(scripts, 'lint:sh', 'shellcheck **/*.sh');
      }

      result.scripts = scripts;
      return result;
    },
    unmerge: (existing, _ctx) => {
      const result = { ...existing };
      const scripts = { ...(existing.scripts as Record<string, string>) };

      // Remove safeword-specific scripts but preserve lint/format (useful standalone)
      delete scripts['lint:eslint']; // Biome hybrid mode
      delete scripts['lint:sh'];
      delete scripts['format:check'];
      delete scripts.knip;
      delete scripts.publint;
      delete scripts['test:bdd'];

      assignOrPrune(result, 'scripts', scripts);
      return result;
    },
  },

  // Prettier config — adds safeword's plugins (and, greenfield only, its style
  // defaults) to safeword's OWN `.prettierrc`. A customer who already owns a
  // prettier config is left untouched — see the existingPrettierConfig gate below.
  '.prettierrc': {
    keys: ['plugins'],
    skipIfMissing: true,
    merge: (existing, ctx) => {
      // A customer who already owns a prettier config keeps it exactly as-is:
      // filling in safeword's style defaults or injecting plugins changes the
      // resolved style and churns their files on the next prettier run (ticket
      // 9C2CFX — revisits 8BNSTE's "the additive merge is safe" call). Only a
      // greenfield install, where safeword wrote this `.prettierrc` itself and
      // existingPrettierConfig is false, gets safeword's plugins.
      if (ctx.projectType.existingPrettierConfig) return existing;

      const result = { ...existing } as Record<string, unknown>;

      // Add defaults for missing styling options (preserves user customizations)
      for (const [key, value] of Object.entries(PRETTIER_DEFAULTS)) {
        if (result[key] === undefined) {
          result[key] = value;
        }
      }

      // Merge plugins: preserve user's plugins + add safeword's
      const safewordPlugins = getPrettierPlugins(ctx.projectType);
      const existingPlugins = Array.isArray(result.plugins) ? (result.plugins as string[]) : [];

      // Combine existing + safeword plugins (deduplicated)
      const allPlugins = [...existingPlugins];
      for (const plugin of safewordPlugins) {
        if (!allPlugins.includes(plugin)) {
          allPlugins.push(plugin);
        }
      }

      // Ensure tailwind plugin is always last (required for proper class sorting)
      const tailwindIndex = allPlugins.indexOf('prettier-plugin-tailwindcss');
      if (tailwindIndex !== -1 && tailwindIndex !== allPlugins.length - 1) {
        allPlugins.splice(tailwindIndex, 1);
        allPlugins.push('prettier-plugin-tailwindcss');
      }

      if (allPlugins.length > 0) {
        result.plugins = allPlugins;
      } else {
        delete result.plugins;
      }

      return result;
    },
    unmerge: (existing, ctx) => {
      const result = { ...existing } as Record<string, unknown>;
      // Only remove safeword's plugins, preserve user's custom plugins
      const safewordPlugins = new Set(getPrettierPlugins(ctx.projectType));
      if (Array.isArray(result.plugins)) {
        const remaining = (result.plugins as string[]).filter(p => !safewordPlugins.has(p));
        if (remaining.length > 0) {
          result.plugins = remaining;
        } else {
          delete result.plugins;
        }
      }
      return result;
    },
  },

  // Biome excludes - add safeword files so they don't get linted by Biome/Ultracite
  // Biome v2 uses `includes` with `!` prefix for exclusions (not a separate `ignore` key)
  // Support both biome.json and biome.jsonc
  'biome.json': BIOME_JSON_MERGE,
  'biome.jsonc': BIOME_JSON_MERGE,

  // dprint excludes - add safeword-owned dirs so a customer's dprint fmt skips them.
  'dprint.json': DPRINT_JSON_MERGE,
  '.dprint.json': DPRINT_JSON_MERGE,
  'dprint.jsonc': DPRINT_JSON_MERGE,
  '.dprint.jsonc': DPRINT_JSON_MERGE,

  // oxfmt ignorePatterns - JSON config forms only (oxfmt.config.* modules can't be
  // merged, like prettier.config.*); customers on those add the excludes themselves.
  '.oxfmtrc.json': OXFMT_JSON_MERGE,
  '.oxfmtrc.jsonc': OXFMT_JSON_MERGE,
};

// ============================================================================
// Packages
// ============================================================================

// Default new installs to ESLint 10 — safeword's peer range is `^9.22.0 || ^10.0.0`
// since v0.52.0, and the plugin-ecosystem blocker that pinned this to v9 is resolved.
// Existing customers are NOT bumped: reconcile skips packages already installed, so
// this only affects fresh setups. v10 keeps the `eslint/config` defineConfig helper
// used in generated configs.
export const ESLINT_PACKAGE = 'eslint@^10.0.0';
export const JITI_PACKAGE = 'jiti@^2.2.0';

export const typescriptPackages = {
  base: [
    // Core tools (always needed for JS/TS — eslint/prettier also lint the BDD lane's .ts step files)
    ESLINT_PACKAGE,
    // Safeword (bundles eslint-config-prettier + all ESLint plugins)
    'safeword',
    // Generated .safeword/eslint.config.mjs uses jiti to load eslint.config.ts.
    JITI_PACKAGE,
  ],
  conditional: {
    // BDD acceptance lane (ticket 102b) — cucumber-js runs the scaffolded
    // .feature files; tsx transpiles the TypeScript step definitions, and
    // @types/node lets the scaffolded steps (node: imports) pass typechecks.
    // Suppressed when the repo already has its own cucumber harness (56JCFZ);
    // "bddLane" = !existingCucumberHarness, special-cased in reconcile.
    bddLane: ['@cucumber/cucumber', 'tsx', '@types/node'],
    // Prettier (only for projects without existing formatter)
    standard: ['prettier'], // "standard" = !existingFormatter
    // Prettier plugins (only for projects without existing formatter that need them)
    astro: ['prettier-plugin-astro'],
    tailwind: ['prettier-plugin-tailwindcss'],
    shell: ['prettier-plugin-sh'],
    // Non-ESLint tools
    publishableLibrary: ['publint'],
    shellcheck: ['shellcheck'], // Renamed from shell to avoid conflict with prettier-plugin-sh
    // Legacy ESLint config compat (needed when extending .eslintrc.* configs)
    legacyEslint: ['@eslint/eslintrc'],
    // Architecture + dead-code tools (used by /audit) — these scan JS APPLICATION
    // code/deps, so only for repos with real JS source, not a non-JS repo carrying
    // just the TS BDD lane (BE7C7B).
    hasJsSource: ['dependency-cruiser', 'knip'],
  },
};
