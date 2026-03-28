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
const SQL_EXTENSIONS = new Set(['sql']);
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
const SAFEWORD_SQLFLUFF = `${projectDir}/.safeword/sqlfluff.cfg`;
const SAFEWORD_CLIPPY = `${projectDir}/.safeword/clippy.toml`;
const SAFEWORD_RUSTFMT = `${projectDir}/.safeword/rustfmt.toml`;
const SAFEWORD_PRETTIER = `${projectDir}/.safeword/.prettierrc`;

// Track if we've already tried upgrading (avoid repeated attempts in same process)
let upgradeAttempted = false;

// Track which tools we've already warned about (once per session)
const toolWarnings = new Set<string>();

/** Result from linting a file */
export interface LintResult {
  /** Warnings for Claude (e.g., missing tool binaries) */
  warnings: string[];
}

/** Check if a command is available on PATH */
async function isCommandAvailable(command: string): Promise<boolean> {
  const result = await $`which ${command}`.nothrow().quiet();
  return result.exitCode === 0;
}

/**
 * Walk up from a file's directory looking for a marker file.
 * Stops at the project root. Returns the directory containing the marker, or undefined.
 */
function findUpward(filePath: string, markerFile: string): string | undefined {
  let currentDirectory = nodePath.dirname(filePath);
  const normalizedProjectDir = nodePath.resolve(projectDir);

  while (currentDirectory.startsWith(normalizedProjectDir)) {
    if (existsSync(nodePath.join(currentDirectory, markerFile))) {
      return currentDirectory;
    }
    const parentDirectory = nodePath.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) break;
    currentDirectory = parentDirectory;
  }
  return undefined;
}

/**
 * Detect the Python install command for a tool by checking for lockfiles
 * near the edited file. Walks up from the file to find the nearest PM marker.
 */
function getPythonInstallHint(filePath: string, tool: string): string {
  if (findUpward(filePath, 'uv.lock')) return `uv add --dev ${tool}`;
  if (findUpward(filePath, 'poetry.lock')) return `poetry add --group dev ${tool}`;
  if (findUpward(filePath, 'Pipfile')) return `pipenv install --dev ${tool}`;
  return `pip install ${tool}`;
}

/**
 * Check if a linter binary is available, warn once per session if not.
 * Returns true if available, false (with warning added) if missing.
 */
async function checkToolAvailable(
  tool: string,
  language: string,
  installHint: string,
  warnings: string[],
): Promise<boolean> {
  if (toolWarnings.has(tool)) return false;
  const available = await isCommandAvailable(tool);
  if (!available) {
    toolWarnings.add(tool);
    warnings.push(
      `${language} linter "${tool}" is not installed — ${language} files are not being linted. ` +
        `Ask the user if they'd like you to install it by running: ${installHint}`,
    );
  }
  return available;
}

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

  console.error(`SAFEWORD: ${packName} pack missing, running upgrade...`);

  const result = await $`bunx safeword@latest upgrade --yes`.nothrow().quiet();
  if (result.exitCode !== 0) {
    console.error('SAFEWORD: Upgrade failed. Run manually: bunx safeword upgrade');
    return false;
  }

  // If upgrade succeeded but config still missing, the language may be in
  // a location safeword can't auto-detect.
  if (!hasConfig(configPath)) {
    console.error(
      `SAFEWORD: ${packName} config not created after upgrade. ` +
        `Linting with ${packName} defaults (no strict safeword rules).`,
    );
  }

  // Auto-commit .safeword/ (excluding learnings/ and logs/)
  // Use -- .safeword/ to only commit safeword files, not other staged changes
  await $`git add .safeword/ ':!.safeword/learnings/' ':!.safeword/logs/'`.nothrow().quiet();
  const commitResult =
    await $`git commit -m "chore: safeword auto-upgrade (${packName} pack)" -- .safeword/`
      .nothrow()
      .quiet();
  if (commitResult.exitCode !== 0) {
    console.error(
      'SAFEWORD: Could not auto-commit .safeword/ changes (not a git repo or no changes)',
    );
  } else {
    console.error('SAFEWORD: Upgrade complete and committed');
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
export async function lintFile(file: string, _projectDir: string): Promise<LintResult> {
  const extension = file.split('.').pop()?.toLowerCase() ?? '';
  const warnings: string[] = [];

  // JS/TS and framework files - ESLint first (fix code), then Prettier (format)
  // Auto-upgrades safeword if TypeScript pack is missing
  if (JS_EXTENSIONS.has(extension)) {
    const hasEslint = await ensurePackInstalled('TypeScript', SAFEWORD_ESLINT);
    const eslintResult = hasEslint
      ? await $`bunx eslint --config ${SAFEWORD_ESLINT} --fix ${file}`.nothrow().quiet()
      : await $`bunx eslint --fix ${file}`.nothrow().quiet();

    if (eslintResult.exitCode !== 0 && eslintResult.stderr.length > 0) {
      console.error(eslintResult.stderr.toString());
    }
    await runPrettier(file);
    return { warnings };
  }

  // Python files - Ruff check (fix code), then Ruff format
  // Auto-upgrades safeword if Python pack is missing
  if (PYTHON_EXTENSIONS.has(extension)) {
    if (
      !(await checkToolAvailable('ruff', 'Python', getPythonInstallHint(file, 'ruff'), warnings))
    ) {
      return { warnings };
    }
    const hasRuff = await ensurePackInstalled('Python', SAFEWORD_RUFF);
    if (hasRuff) {
      await $`ruff check --config ${SAFEWORD_RUFF} --fix ${file}`.nothrow().quiet();
      await $`ruff format --config ${SAFEWORD_RUFF} ${file}`.nothrow().quiet();
    } else {
      await $`ruff check --fix ${file}`.nothrow().quiet();
      await $`ruff format ${file}`.nothrow().quiet();
    }
    return { warnings };
  }

  // Go files - golangci-lint run (fix code), then golangci-lint fmt (format)
  // Auto-upgrades safeword if Go pack is missing
  if (GO_EXTENSIONS.has(extension)) {
    if (
      !(await checkToolAvailable(
        'golangci-lint',
        'Go',
        'curl -sSfL https://golangci-lint.run/install.sh | sh',
        warnings,
      ))
    ) {
      return { warnings };
    }
    const hasGolangci = await ensurePackInstalled('Go', SAFEWORD_GOLANGCI);
    if (hasGolangci) {
      await $`golangci-lint run --config ${SAFEWORD_GOLANGCI} --fix ${file}`.nothrow().quiet();
      await $`golangci-lint fmt --config ${SAFEWORD_GOLANGCI} ${file}`.nothrow().quiet();
    } else {
      await $`golangci-lint run --fix ${file}`.nothrow().quiet();
      await $`golangci-lint fmt ${file}`.nothrow().quiet();
    }
    return { warnings };
  }

  // Rust files - clippy for linting (package-level), rustfmt for formatting (file-level)
  // Auto-upgrades safeword if Rust pack is missing
  if (RUST_EXTENSIONS.has(extension)) {
    const hasRustConfig = await ensurePackInstalled('Rust', SAFEWORD_RUSTFMT);

    // Run clippy with package targeting for workspaces
    const packageName = detectRustPackage(file);
    if (packageName && (await isCommandAvailable('cargo'))) {
      const clippyEnv = hasConfig(SAFEWORD_CLIPPY)
        ? { CLIPPY_CONF_DIR: nodePath.dirname(SAFEWORD_CLIPPY) }
        : {};

      await $`cargo clippy -p ${packageName} --fix --allow-dirty --allow-staged`
        .env(clippyEnv)
        .nothrow()
        .quiet();
    }

    // Run rustfmt for file-level formatting
    if (await isCommandAvailable('rustfmt')) {
      if (hasRustConfig) {
        await $`rustfmt --config-path ${SAFEWORD_RUSTFMT} ${file}`.nothrow().quiet();
      } else {
        await $`rustfmt ${file}`.nothrow().quiet();
      }
    } else if (!toolWarnings.has('rustfmt')) {
      toolWarnings.add('rustfmt');
      warnings.push(
        'Rust formatter "rustfmt" is not installed — Rust files are not being formatted. ' +
          "Ask the user if they'd like you to install it by running: rustup component add rustfmt",
      );
    }
    return { warnings };
  }

  // SQL files - sqlfluff (only for SQL-focused projects)
  // Only warn about missing sqlfluff if the sql pack is installed,
  // since .sql files exist in many non-SQL-focused contexts.
  if (SQL_EXTENSIONS.has(extension)) {
    const hasSqlfluff = await ensurePackInstalled('sql', SAFEWORD_SQLFLUFF);
    if (hasSqlfluff) {
      if (
        !(await checkToolAvailable(
          'sqlfluff',
          'SQL/dbt',
          getPythonInstallHint(file, 'sqlfluff'),
          warnings,
        ))
      ) {
        return { warnings };
      }
      await $`sqlfluff fix --config ${SAFEWORD_SQLFLUFF} ${file}`.nothrow().quiet();
    }
    return { warnings };
  }

  // Other supported formats - prettier only
  if (PRETTIER_EXTENSIONS.has(extension)) {
    await runPrettier(file);
    return { warnings };
  }

  // Shell scripts - shellcheck (if available), then Prettier (if plugin installed)
  if (SHELL_EXTENSIONS.has(extension)) {
    const shellcheckResult = await $`bunx shellcheck ${file}`.nothrow().quiet();
    if (shellcheckResult.exitCode !== 0 && shellcheckResult.stderr.length > 0) {
      console.error(shellcheckResult.stderr.toString());
    }
    if (
      hasConfig(SAFEWORD_PRETTIER) ||
      existsSync(`${projectDir}/node_modules/prettier-plugin-sh`)
    ) {
      await runPrettier(file);
    }
  }

  return { warnings };
}
