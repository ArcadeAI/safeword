// Shared linting logic for Claude Code and Cursor hooks
// Used by: post-tool-lint.ts, cursor/after-file-edit.ts
//
// Uses explicit --config flags pointing to .safeword/ configs for LLM enforcement.
// This allows stricter rules for LLMs while humans use their normal project configs.
//
// Auto-upgrades safeword if a language pack is missing.

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { $ } from 'bun';

// File extensions for different linting strategies
const JS_EXTENSIONS = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'mts',
  'cjs',
  'cts',
  'vue',
  'svelte',
  'astro',
]);
const PYTHON_EXTENSIONS = new Set(['py', 'pyi']);
const GO_EXTENSIONS = new Set(['go']);
const RUST_EXTENSIONS = new Set(['rs']);
const SHELL_EXTENSIONS = new Set(['sh']);
const PRETTIER_EXTENSIONS = new Set([
  'md',
  'json',
  'css',
  'scss',
  'html',
  'yaml',
  'yml',
  'graphql',
]);

// Cache safeword config paths
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const SAFEWORD_ESLINT = `${projectDir}/.safeword/eslint.config.mjs`;
const SAFEWORD_RUFF = `${projectDir}/.safeword/ruff.toml`;
const SAFEWORD_GOLANGCI = `${projectDir}/.safeword/.golangci.yml`;
const SAFEWORD_CLIPPY = `${projectDir}/.safeword/clippy.toml`;
const SAFEWORD_RUSTFMT = `${projectDir}/.safeword/rustfmt.toml`;
const SAFEWORD_PRETTIER = `${projectDir}/.safeword/.prettierrc`;

// Track if we've already tried upgrading (avoid repeated attempts in same process)
let upgradeAttempted = false;

/** Check config exists, dynamically (not cached) */
function hasConfig(path: string): boolean {
  return existsSync(path);
}

/**
 * Regex to extract package name from Cargo.toml.
 * Matches: [package] ... name = "package-name"
 * Captures the package name in group 1.
 *
 * Note: This is intentionally duplicated from src/packs/rust/setup.ts because
 * this lint.ts template is copied to user projects and cannot import from safeword.
 */
const CARGO_PACKAGE_NAME_REGEX = /\[package\][^[]*name\s*=\s*"([^"]+)"/;

/**
 * Detect the Rust package name for a file by walking up directories.
 * Finds the nearest Cargo.toml with a [package] section and extracts the name.
 * Returns undefined for virtual workspace roots or files outside any package.
 */
function detectRustPackage(filePath: string): string | undefined {
  let currentDirectory = nodePath.dirname(filePath);
  const normalizedProjectDir = nodePath.resolve(projectDir);

  while (currentDirectory.startsWith(normalizedProjectDir)) {
    const cargoPath = nodePath.join(currentDirectory, 'Cargo.toml');
    if (existsSync(cargoPath)) {
      const content = readFileSync(cargoPath, 'utf8');
      // Only return package name if this Cargo.toml has a [package] section
      if (content.includes('[package]')) {
        const nameMatch = CARGO_PACKAGE_NAME_REGEX.exec(content);
        return nameMatch?.[1];
      }
    }
    const parentDirectory = nodePath.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) break;
    currentDirectory = parentDirectory;
  }
  return undefined;
}

/**
 * Run safeword upgrade and auto-commit .safeword/ changes.
 * Only runs once per process to avoid repeated slow upgrades.
 */
async function ensurePackInstalled(packName: string, configPath: string): Promise<boolean> {
  // Already have config
  if (hasConfig(configPath)) return true;

  // Already tried upgrading this session
  if (upgradeAttempted) return false;
  upgradeAttempted = true;

  console.log(`SAFEWORD: ${packName} pack missing, running upgrade...`);

  const result = await $`bunx safeword@latest upgrade --yes`.nothrow().quiet();
  if (result.exitCode !== 0) {
    console.error('SAFEWORD: Upgrade failed. Run manually: bunx safeword upgrade');
    return false;
  }

  // Auto-commit .safeword/ (excluding learnings/ and logs/)
  // Use -- .safeword/ to only commit safeword files, not other staged changes
  await $`git add .safeword/ ':!.safeword/learnings/' ':!.safeword/logs/'`.nothrow().quiet();
  const commitResult =
    await $`git commit -m "chore: safeword auto-upgrade (${packName} pack)" -- .safeword/`
      .nothrow()
      .quiet();
  if (commitResult.exitCode !== 0) {
    console.log(
      'SAFEWORD: Could not auto-commit .safeword/ changes (not a git repo or no changes)',
    );
  } else {
    console.log('SAFEWORD: Upgrade complete and committed');
  }

  return hasConfig(configPath);
}

/** Run prettier with safeword config if available */
async function runPrettier(file: string): Promise<void> {
  if (hasConfig(SAFEWORD_PRETTIER)) {
    await $`bunx prettier --config ${SAFEWORD_PRETTIER} --write ${file}`.nothrow().quiet();
  } else {
    await $`bunx prettier --write ${file}`.nothrow().quiet();
  }
}

/**
 * Lint a file based on its extension.
 * Uses safeword configs (.safeword/) for stricter LLM enforcement when available.
 *
 * - JS/TS: ESLint (--config if safeword config exists) + Prettier
 * - Python: Ruff check + Ruff format (--config if safeword config exists)
 * - Go: golangci-lint (--config if safeword config exists)
 * - Shell: shellcheck + Prettier
 * - Other: Prettier only
 *
 * @param file - Path to the file to lint
 * @param _projectDir - Project root directory (cached at module init, kept for backward compat)
 */
export async function lintFile(file: string, _projectDir: string): Promise<void> {
  const extension = file.split('.').pop()?.toLowerCase() ?? '';

  // JS/TS and framework files - ESLint first (fix code), then Prettier (format)
  // Auto-upgrades safeword if TypeScript pack is missing
  if (JS_EXTENSIONS.has(extension)) {
    const hasEslint = await ensurePackInstalled('TypeScript', SAFEWORD_ESLINT);
    const eslintResult = hasEslint
      ? await $`bunx eslint --config ${SAFEWORD_ESLINT} --fix ${file}`.nothrow().quiet()
      : await $`bunx eslint --fix ${file}`.nothrow().quiet();

    if (eslintResult.exitCode !== 0 && eslintResult.stderr.length > 0) {
      console.log(eslintResult.stderr.toString());
    }
    await runPrettier(file);
    return;
  }

  // Python files - Ruff check (fix code), then Ruff format
  // Auto-upgrades safeword if Python pack is missing
  if (PYTHON_EXTENSIONS.has(extension)) {
    const hasRuff = await ensurePackInstalled('Python', SAFEWORD_RUFF);
    if (hasRuff) {
      await $`ruff check --config ${SAFEWORD_RUFF} --fix ${file}`.nothrow().quiet();
      await $`ruff format --config ${SAFEWORD_RUFF} ${file}`.nothrow().quiet();
    } else {
      // Fallback: run without safeword config
      await $`ruff check --fix ${file}`.nothrow().quiet();
      await $`ruff format ${file}`.nothrow().quiet();
    }
    return;
  }

  // Go files - golangci-lint run (fix code), then golangci-lint fmt (format)
  // Auto-upgrades safeword if Go pack is missing
  if (GO_EXTENSIONS.has(extension)) {
    const hasGolangci = await ensurePackInstalled('Go', SAFEWORD_GOLANGCI);
    if (hasGolangci) {
      await $`golangci-lint run --config ${SAFEWORD_GOLANGCI} --fix ${file}`.nothrow().quiet();
      await $`golangci-lint fmt --config ${SAFEWORD_GOLANGCI} ${file}`.nothrow().quiet();
    } else {
      // Fallback: run without safeword config
      await $`golangci-lint run --fix ${file}`.nothrow().quiet();
      await $`golangci-lint fmt ${file}`.nothrow().quiet();
    }
    return;
  }

  // Rust files - clippy for linting (package-level), rustfmt for formatting (file-level)
  // Auto-upgrades safeword if Rust pack is missing
  if (RUST_EXTENSIONS.has(extension)) {
    const hasRustConfig = await ensurePackInstalled('Rust', SAFEWORD_RUSTFMT);

    // Run clippy with package targeting for workspaces
    // Detect which package this file belongs to
    const packageName = detectRustPackage(file);
    if (packageName) {
      // Use CLIPPY_CONF_DIR to point clippy to safeword config
      const clippyEnv = hasConfig(SAFEWORD_CLIPPY)
        ? { CLIPPY_CONF_DIR: nodePath.dirname(SAFEWORD_CLIPPY) }
        : {};

      await $`cargo clippy -p ${packageName} --fix --allow-dirty --allow-staged`
        .env(clippyEnv)
        .nothrow()
        .quiet();
    }

    // Run rustfmt for file-level formatting
    if (hasRustConfig) {
      await $`rustfmt --config-path ${SAFEWORD_RUSTFMT} ${file}`.nothrow().quiet();
    } else {
      // Fallback: run without safeword config
      await $`rustfmt ${file}`.nothrow().quiet();
    }
    return;
  }

  // Other supported formats - prettier only
  if (PRETTIER_EXTENSIONS.has(extension)) {
    await runPrettier(file);
    return;
  }

  // Shell scripts - shellcheck (if available), then Prettier (if plugin installed)
  if (SHELL_EXTENSIONS.has(extension)) {
    const shellcheckResult = await $`bunx shellcheck ${file}`.nothrow().quiet();
    if (shellcheckResult.exitCode !== 0 && shellcheckResult.stderr.length > 0) {
      console.log(shellcheckResult.stderr.toString());
    }
    // Run prettier if safeword config exists (has plugin configured) or plugin is installed
    if (
      hasConfig(SAFEWORD_PRETTIER) ||
      existsSync(`${projectDir}/node_modules/prettier-plugin-sh`)
    ) {
      await runPrettier(file);
    }
  }
}
