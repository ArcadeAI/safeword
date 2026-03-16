/**
 * Framework detection utilities for safeword ESLint preset
 *
 * Single source of truth for package detection. Used by:
 * - Generated eslint.config.mjs at lint time
 * - CLI's project-detector at init time
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * TanStack Query package names across all supported frameworks.
 */
const TANSTACK_QUERY_PACKAGES = [
  '@tanstack/react-query',
  '@tanstack/vue-query',
  '@tanstack/solid-query',
  '@tanstack/svelte-query',
  '@tanstack/angular-query-experimental',
] as const;

/**
 * Tailwind CSS package names (v3 and v4 installation methods).
 */
const TAILWIND_PACKAGES = ['tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss'] as const;

/**
 * Playwright test package names.
 */
const PLAYWRIGHT_PACKAGES = ['@playwright/test', 'playwright'] as const;

/**
 * Non-Prettier formatter config files (Biome, dprint, Rome).
 * Used to detect if project uses an alternative formatter.
 * Prettier is safeword's default, so its presence doesn't skip config creation.
 */
const ALTERNATIVE_FORMATTER_FILES = [
  // Biome (and legacy Rome)
  'biome.json',
  'biome.jsonc',
  'rome.json',
  // dprint
  'dprint.json',
  '.dprint.json',
  'dprint.jsonc',
  '.dprint.jsonc',
] as const;

type DepsRecord = Record<string, string | undefined>;
type ScriptsRecord = Record<string, string | undefined>;

/**
 * Read dependencies from a package.json file.
 */
function readPackageDeps(pkgPath: string): DepsRecord {
  try {
    if (!existsSync(pkgPath)) return {};
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

/**
 * Get workspace patterns from root package.json.
 */
function getWorkspacePatternsFromPackage(rootPackagePath: string): string[] {
  try {
    const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
    if (Array.isArray(rootPackage.workspaces)) {
      return rootPackage.workspaces;
    }
    if (rootPackage.workspaces?.packages) {
      return rootPackage.workspaces.packages;
    }
  } catch {
    // No workspaces defined
  }
  return [];
}

/**
 * Get all monorepo workspace patterns (from package.json + common directories).
 */
function getMonorepoPatterns(rootDirectory: string): string[] {
  const rootPackagePath = path.join(rootDirectory, 'package.json');
  const workspacePatterns = getWorkspacePatternsFromPackage(rootPackagePath);
  const commonPatterns = ['apps/*', 'packages/*'];
  return [...new Set([...workspacePatterns, ...commonPatterns])];
}

/**
 * Scan a workspace directory for package.json files.
 */
function scanWorkspaceDirectory(rootDirectory: string, pattern: string): DepsRecord {
  if (!pattern.endsWith('/*')) return {};

  const baseDirectory = path.join(rootDirectory, pattern.slice(0, -2));
  if (!existsSync(baseDirectory)) return {};

  const allDeps: DepsRecord = {};
  try {
    const entries = readdirSync(baseDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        Object.assign(
          allDeps,
          readPackageDeps(path.join(baseDirectory, entry.name, 'package.json')),
        );
      }
    }
  } catch {
    // Ignore read errors
  }
  return allDeps;
}

/**
 * Collect all dependencies from root and workspace package.json files.
 * Supports npm/yarn workspaces and common monorepo patterns.
 */
function collectAllDeps(rootDirectory: string): DepsRecord {
  const rootPackagePath = path.join(rootDirectory, 'package.json');
  const allDeps = readPackageDeps(rootPackagePath);

  // Scan each workspace pattern
  for (const pattern of getMonorepoPatterns(rootDirectory)) {
    Object.assign(allDeps, scanWorkspaceDirectory(rootDirectory, pattern));
  }

  return allDeps;
}

/**
 * Check if Tailwind CSS is installed.
 */
function hasTailwind(deps: DepsRecord): boolean {
  return TAILWIND_PACKAGES.some(pkg => pkg in deps);
}

/**
 * Check if TanStack Query is installed.
 */
function hasTanstackQuery(deps: DepsRecord): boolean {
  return TANSTACK_QUERY_PACKAGES.some(pkg => pkg in deps);
}

/**
 * Check if Vitest is installed.
 */
function hasVitest(deps: DepsRecord): boolean {
  return 'vitest' in deps;
}

/**
 * Check if Playwright is installed.
 */
function hasPlaywright(deps: DepsRecord): boolean {
  return PLAYWRIGHT_PACKAGES.some(pkg => pkg in deps);
}

/**
 * Check if Turborepo is installed.
 */
function hasTurbo(deps: DepsRecord): boolean {
  return 'turbo' in deps;
}

/**
 * Detect base framework for config selection.
 * Returns the most specific framework detected.
 */
function detectFramework(
  deps: DepsRecord,
): 'next' | 'react' | 'astro' | 'typescript' | 'javascript' {
  if ('next' in deps) return 'next';
  if ('astro' in deps) return 'astro'; // Check before React (Astro+React has both)
  if ('react' in deps) return 'react';
  if ('typescript' in deps || 'typescript-eslint' in deps) return 'typescript';
  return 'javascript';
}

/**
 * Get dynamic ignores based on detected frameworks.
 */
function getIgnores(_deps: DepsRecord): string[] {
  return [
    '**/node_modules/',
    '**/dist/',
    '**/build/',
    '**/coverage/',
    // Safeword's own hook/config files (TS, not in project's tsconfig scope)
    '.safeword/**',
    // Build output directories — always ignore even if framework not currently installed
    '**/.next/',
    '**/.astro/',
    // Non-JS ecosystems that may contain JS files
    '**/.venv/',
  ];
}

/**
 * Check if project has an existing linter setup.
 * True if package.json has a "lint" script.
 */
function hasExistingLinter(scripts: ScriptsRecord): boolean {
  return 'lint' in scripts;
}

/**
 * Check if project uses an alternative formatter (Biome, dprint, Rome).
 * Returns false for Prettier since it's safeword's default.
 *
 * We don't check for "format" script because safeword adds that itself.
 */
function hasExistingFormatter(cwd: string, _scripts: ScriptsRecord): boolean {
  return ALTERNATIVE_FORMATTER_FILES.some(file => existsSync(path.join(cwd, file)));
}

/**
 * Next.js config file names to look for.
 */
const NEXT_CONFIG_FILES = ['next.config.js', 'next.config.mjs', 'next.config.ts'] as const;

/**
 * Check if a directory contains a Next.js config file.
 */
function hasNextConfig(directory: string): boolean {
  return NEXT_CONFIG_FILES.some(file => existsSync(path.join(directory, file)));
}

/**
 * Scan a workspace directory for Next.js config files.
 * Returns relative glob patterns for directories containing Next.js configs.
 */
function scanDirectoryForNextConfigs(rootDirectory: string, workspacePattern: string): string[] {
  if (!workspacePattern.endsWith('/*')) return [];

  const baseDirectory = workspacePattern.slice(0, -2); // Remove '/*'
  const fullBaseDirectory = path.join(rootDirectory, baseDirectory);

  if (!existsSync(fullBaseDirectory)) return [];

  const nextPaths: string[] = [];
  try {
    const entries = readdirSync(fullBaseDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const packageDirectory = path.join(fullBaseDirectory, entry.name);
      if (hasNextConfig(packageDirectory)) {
        nextPaths.push(`${baseDirectory}/${entry.name}/**/*.{ts,tsx}`);
      }
    }
  } catch {
    // Ignore read errors
  }
  return nextPaths;
}

/**
 * Find Next.js config paths for ESLint rule scoping in monorepos.
 *
 * Returns:
 * - `undefined` if Next.js config exists at root (single app, no scoping needed)
 * - `string[]` of glob patterns for directories containing Next.js apps
 * - Empty array if no Next.js configs found anywhere
 *
 * Used to scope Next.js-specific ESLint rules to only the packages that use Next.js,
 * allowing other packages (React, Astro, etc.) to avoid irrelevant Next.js rules.
 */
function findNextConfigPaths(rootDirectory: string): string[] | undefined {
  // Check for root Next.js config - means single app, no scoping needed
  if (hasNextConfig(rootDirectory)) {
    return undefined;
  }

  // Scan each workspace pattern for Next.js configs
  return getMonorepoPatterns(rootDirectory).flatMap(pattern =>
    scanDirectoryForNextConfigs(rootDirectory, pattern),
  );
}

/**
 * All detection utilities bundled together.
 */
export const detect = {
  // Package lists
  TAILWIND_PACKAGES,
  TANSTACK_QUERY_PACKAGES,
  PLAYWRIGHT_PACKAGES,
  ALTERNATIVE_FORMATTER_FILES,
  NEXT_CONFIG_FILES,

  // Core utilities
  collectAllDeps,
  detectFramework,
  getIgnores,

  // Feature detection
  hasTailwind,
  hasTanstackQuery,
  hasVitest,
  hasPlaywright,
  hasTurbo,

  // Monorepo detection
  findNextConfigPaths,

  // Existing tooling detection
  hasExistingLinter,
  hasExistingFormatter,
};
