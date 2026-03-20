/**
 * File system utilities for CLI operations
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import nodePath from 'node:path';

// Get the directory of this module (for locating templates)
const __dirname = import.meta.dirname;

/**
 * Get path to bundled templates directory.
 * Works in both development (src/) and production (dist/) contexts.
 *
 * Note: We check for SAFEWORD.md to distinguish from src/templates/ which
 * contains TypeScript source files (config.ts, content.ts).
 *
 * Path resolution (bundled with tsup):
 * - From dist/chunk-*.js: __dirname = packages/cli/dist/ → ../templates
 */
export function getTemplatesDirectory(): string {
  const knownTemplateFile = 'SAFEWORD.md';

  // Try different relative paths - the bundled code ends up in dist/ directly (flat)
  // while source is in src/utils/
  const candidates = [
    nodePath.join(__dirname, '..', 'templates'), // From dist/ (flat bundled)
    nodePath.join(__dirname, '..', '..', 'templates'), // From src/utils/ or dist/utils/
    nodePath.join(__dirname, 'templates'), // Direct sibling (unlikely but safe)
  ];

  for (const candidate of candidates) {
    if (existsSync(nodePath.join(candidate, knownTemplateFile))) {
      return candidate;
    }
  }

  throw new Error('Templates directory not found');
}

/**
 * Check if a path exists
 * @param path
 */
export function exists(path: string): boolean {
  return existsSync(path);
}

/**
 * Directories to exclude when scanning subdirectories for language manifests.
 * These contain vendored/generated files that would cause false positives.
 */
const SUBDIRECTORY_EXCLUDE = new Set([
  'node_modules',
  '.git',
  '.safeword',
  'vendor',
  'dist',
  'build',
  'target',
  'coverage',
  'dbt_packages',
  'out',
  '.next',
  '.nuxt',
  '.output',
  '__pycache__',
  '.venv',
  'venv',
]);

/**
 * Check if a file exists at the project root OR in any immediate subdirectory.
 * Useful for detecting language manifests in projects where a language lives
 * in a subdirectory (e.g., `dbt/pyproject.toml`).
 *
 * @param cwd - Project root directory
 * @param filename - File to search for (e.g., 'pyproject.toml')
 * @returns true if found at root or in any immediate subdirectory
 */
export function existsShallow(cwd: string, filename: string): boolean {
  return findShallow(cwd, filename) !== undefined;
}

/**
 * Find a file at the project root OR in any immediate subdirectory.
 * Returns the directory containing the file, or undefined if not found.
 *
 * @param cwd - Project root directory
 * @param filename - File to search for (e.g., 'pyproject.toml')
 * @returns Directory path where file was found, or undefined
 */
export function findShallow(cwd: string, filename: string): string | undefined {
  // Check root first
  if (existsSync(nodePath.join(cwd, filename))) {
    return cwd;
  }

  // Check immediate subdirectories
  try {
    const entries = readdirSync(cwd, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !SUBDIRECTORY_EXCLUDE.has(entry.name)
      ) {
        const subdirectory = nodePath.join(cwd, entry.name);
        if (existsSync(nodePath.join(subdirectory, filename))) {
          return subdirectory;
        }
      }
    }
  } catch {
    // Ignore permission errors
  }

  return undefined;
}

/**
 * Create directory recursively
 * @param path
 */
export function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Read file as string
 * @param path
 */
export function readFile(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * Read file as string, return null if not exists
 * @param path
 */
export function readFileSafe(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  return readFileSync(path, 'utf8');
}

/**
 * Write file, creating parent directories if needed
 * @param path
 * @param content
 */
export function writeFile(path: string, content: string): void {
  ensureDirectory(nodePath.dirname(path));
  writeFileSync(path, content);
}

/**
 * Remove file or directory recursively
 * @param path
 */
export function remove(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
}

/**
 * Remove directory only if empty, returns true if removed
 * @param path
 */
export function removeIfEmpty(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    rmdirSync(path); // Non-recursive, throws if not empty
    return true;
  } catch {
    return false;
  }
}

/**
 * Make all shell scripts in a directory executable
 * @param dirPath
 */
export function makeScriptsExecutable(dirPath: string): void {
  if (!existsSync(dirPath)) return;
  for (const file of readdirSync(dirPath)) {
    if (file.endsWith('.sh')) {
      chmodSync(nodePath.join(dirPath, file), 0o755);
    }
  }
}

/**
 * Read JSON file
 * @param path
 */
export function readJson(path: string): unknown {
  const content = readFileSafe(path);
  if (!content) return undefined;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Write JSON file with formatting
 * @param path
 * @param data
 */
export function writeJson(path: string, data: unknown): void {
  writeFile(path, `${JSON.stringify(data, undefined, 2)}\n`);
}
