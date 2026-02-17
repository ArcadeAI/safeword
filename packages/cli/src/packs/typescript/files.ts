/**
 * TypeScript/JavaScript Language Pack - Schema Definitions
 *
 * All JS/TS specific file definitions, JSON merges, and packages.
 * Imported by schema.ts and spread into SAFEWORD_SCHEMA.
 */

import { getEslintConfig, getSafewordEslintConfig } from '../../templates/config.js';
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
function addKnipIgnores(
  config: { ignore: string[]; ignoreDependencies: string[] },
  ctx: ProjectContext,
): void {
  const allDeps = ctx.developmentDeps;

  // Framework build/cache directories
  if (ctx.projectType.nextjs) config.ignore.push('.next/**');
  if (ctx.projectType.astro) config.ignore.push('.astro/**');
  if ('storybook' in allDeps || '@storybook/react' in allDeps) {
    config.ignore.push('.storybook/**', 'storybook-static/**');
  }
  if ('turbo' in allDeps) config.ignore.push('.turbo/**');

  // Electron - Knip has no Electron plugin
  if ('electron' in allDeps || 'electron' in ctx.productionDeps) {
    config.ignore.push('electron/**', 'dist-electron/**', 'out/**');
  }
}

/**
 * Add framework-specific ignoreDependencies to Knip config.
 */
function addKnipIgnoreDependencies(
  config: { ignore: string[]; ignoreDependencies: string[] },
  ctx: ProjectContext,
): void {
  const allDeps = ctx.developmentDeps;

  // Dependencies used via config files, not imports
  if (ctx.projectType.tailwind) {
    config.ignoreDependencies.push('tailwindcss', '@tailwindcss/typography', '@tailwindcss/forms');
  }
  if (ctx.projectType.playwright) config.ignoreDependencies.push('@playwright/test');
  if ('husky' in allDeps) config.ignoreDependencies.push('husky');
  if ('lint-staged' in allDeps) config.ignoreDependencies.push('lint-staged');

  // Electron ecosystem packages
  if ('electron' in allDeps || 'electron' in ctx.productionDeps) {
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
  const config = {
    ignore: ['.safeword/**', '.safeword-project/**'],
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
  merge: existing => {
    const files = (existing.files as Record<string, unknown>) ?? {};
    const existingIncludes = Array.isArray(files.includes) ? files.includes : [];

    // Add safeword exclusions (! prefix) if not already present
    // Note: Biome v2.2.0+ doesn't need /** for folders
    const safewordExcludes = ['!eslint.config.mjs', '!.safeword'];
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
  unmerge: (existing, _ctx) => {
    const files = (existing.files as Record<string, unknown>) ?? {};
    const existingIncludes = Array.isArray(files.includes) ? files.includes : [];

    // Remove safeword exclusions from includes list
    const safewordExcludes = new Set(['!eslint.config.mjs', '!.safeword', '!.safeword/**']);
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
    // Rule conflict: unicorn/no-useless-undefined removes explicit undefined, sonarjs/no-inconsistent-returns wants it
    // eslint-disable-next-line sonarjs/no-inconsistent-returns
    generator: ctx => {
      // Skip for non-JS projects or projects with existing formatter (they use Biome, etc.)
      if (!ctx.languages?.javascript || ctx.projectType.existingFormatter) {
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
    // Rule conflict: unicorn/no-useless-undefined removes explicit undefined, sonarjs/no-inconsistent-returns wants it
    // eslint-disable-next-line sonarjs/no-inconsistent-returns
    generator: ctx => {
      // Skip if project already has ESLint config (safeword will use .safeword/eslint.config.mjs)
      if (ctx.projectType.existingEslintConfig) return;
      if (!ctx.languages?.javascript) return;
      return getEslintConfig(ctx.projectType.existingFormatter);
    },
  },
  // Minimal tsconfig for ESLint type-checked linting (only if missing)
  'tsconfig.json': {
    // Rule conflict: unicorn/no-useless-undefined removes explicit undefined, sonarjs/no-inconsistent-returns wants it
    // eslint-disable-next-line sonarjs/no-inconsistent-returns
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
      ctx.languages?.javascript ? JSON.stringify(getKnipConfig(ctx), undefined, 2) : undefined,
  },
  // Project-level Prettier config (created only if no existing formatter)
  '.prettierrc': {
    // Rule conflict: unicorn/no-useless-undefined removes explicit undefined, sonarjs/no-inconsistent-returns wants it
    // eslint-disable-next-line sonarjs/no-inconsistent-returns
    generator: ctx => {
      // Skip for non-JS projects or projects with existing formatter
      if (!ctx.languages?.javascript) return;
      if (ctx.projectType.existingFormatter) return;
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
  if (!scripts[name]) scripts[name] = command;
}

/**
 * Merge lint scripts based on project type.
 */
function mergeLintScripts(
  scripts: Record<string, string>,
  projectType: { existingLinter: boolean },
): void {
  if (projectType.existingLinter) {
    // Project with existing linter: add lint:eslint for safeword-specific rules
    addScriptIfMissing(scripts, 'lint:eslint', 'eslint .');
  } else {
    // No existing linter: ESLint is the primary linter
    addScriptIfMissing(scripts, 'lint', 'eslint .');
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
    keys: ['scripts.lint', 'scripts.format', 'scripts.format:check', 'scripts.knip'],
    skipIfMissing: true, // Don't create for Python-only projects (no JS tooling)
    conditionalKeys: {
      existingLinter: ['scripts.lint:eslint'], // Projects with existing linter get separate ESLint script
      publishableLibrary: ['scripts.publint'],
      shell: ['scripts.lint:sh'],
    },
    merge: (existing, ctx) => {
      const scripts = { ...(existing.scripts as Record<string, string>) };
      const result = { ...existing };

      mergeLintScripts(scripts, ctx.projectType);
      mergeFormatScripts(scripts, ctx.projectType);
      addScriptIfMissing(scripts, 'knip', 'knip');

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

      if (Object.keys(scripts).length > 0) {
        result.scripts = scripts;
      } else {
        delete result.scripts;
      }

      return result;
    },
  },

  // Prettier config - add defaults while preserving user customizations
  '.prettierrc': {
    keys: ['plugins'],
    skipIfMissing: true,
    merge: (existing, ctx) => {
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
};

// ============================================================================
// Packages
// ============================================================================

export const typescriptPackages = {
  base: [
    // Core tools (always needed for JS/TS)
    // Pin to v9 until ESLint plugin ecosystem supports v10 (released Feb 2026)
    'eslint@^9',
    // Safeword (bundles eslint-config-prettier + all ESLint plugins)
    'safeword',
    // Architecture and dead code tools (used by /audit)
    'dependency-cruiser',
    'knip',
  ],
  conditional: {
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
  },
};
