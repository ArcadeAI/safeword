// Shared linting logic for Claude Code and Cursor hooks
// Used by: post-tool-lint.ts, cursor/after-file-edit.ts
//
// Uses explicit --config flags pointing to .safeword/ configs for LLM enforcement.
// This allows stricter rules for LLMs while humans use their normal project configs.
//
// Auto-upgrades safeword if a language pack is missing.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import { $ } from 'bun';

import {
  hostFormatsSqlWithPrettier,
  projectOwnsAlternativeFormatter,
  sqlFixOptedIn,
} from './lint-config.js';

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
const FEATURE_EXTENSIONS = new Set(['feature']);
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
const configuredProjectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const projectDir = existsSync(configuredProjectDir)
  ? realpathSync(configuredProjectDir)
  : configuredProjectDir;
const SAFEWORD_ESLINT = `${projectDir}/.safeword/eslint.config.mjs`;
const SAFEWORD_RUFF = `${projectDir}/.safeword/ruff.toml`;
const SAFEWORD_GOLANGCI = `${projectDir}/.safeword/.golangci.yml`;
const SAFEWORD_SQLFLUFF = `${projectDir}/.safeword/sqlfluff.cfg`;
const SAFEWORD_CLIPPY = `${projectDir}/.safeword/clippy.toml`;
const SAFEWORD_RUSTFMT = `${projectDir}/.safeword/rustfmt.toml`;
const SAFEWORD_PRETTIER = `${projectDir}/.safeword/.prettierrc`;

// Whether this repo is owned by a non-Prettier formatter (Biome, dprint, oxfmt,
// deno). Computed once from the project root; when true the hook skips Prettier
// so it never restyles the customer's files into a competing style (ticket
// V7GGJZ). ESLint still runs (security/complexity) — see lintFile.
const REPO_OWNS_ALTERNATIVE_FORMATTER = projectOwnsAlternativeFormatter(projectDir);

// Track if we've already tried upgrading (avoid repeated attempts in same process)
let upgradeAttempted = false;

// Track which tools we've already warned about (once per session)
const toolWarnings = new Set<string>();

/** Result from linting a file */
export interface LintResult {
  /** Warnings for Claude (e.g., missing tool binaries) */
  warnings: string[];
  /** Remaining lint errors after auto-fix (surfaced to Claude via additionalContext) */
  errors?: string;
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
  const normalizedProjectDir = normalizeExistingDirectory(projectDir);

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

function safewordCliCommand(): string[] {
  const installedCli = `${projectDir}/node_modules/safeword/dist/cli.js`;
  if (existsSync(installedCli)) return ['bun', installedCli];
  const sourceCli = `${projectDir}/packages/cli/src/cli.ts`;
  if (existsSync(sourceCli)) return ['bun', sourceCli];
  return ['bunx', 'safeword'];
}

function normalizeExistingDirectory(directory: string): string {
  return existsSync(directory) ? realpathSync(directory) : nodePath.resolve(directory);
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
  const normalizedProjectDir = normalizeExistingDirectory(projectDir);

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

  console.error(`${packName} pack missing, running upgrade...`);

  const result = await $`bunx safeword@latest upgrade`.nothrow().quiet();
  if (result.exitCode !== 0) {
    console.error('Upgrade failed. Run manually: bunx safeword upgrade');
    return false;
  }

  // If upgrade succeeded but config still missing, the language may be in
  // a location safeword can't auto-detect.
  if (!hasConfig(configPath)) {
    console.error(
      `${packName} config not created after upgrade. ` +
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
    console.error('Could not auto-commit .safeword/ changes (not a git repo or no changes)');
  } else {
    console.error('Upgrade complete and committed');
  }

  return hasConfig(configPath);
}

/** Run a linter in check-only mode and capture remaining errors after auto-fix.
 *  When a linter crashes (non-zero exit, empty stdout, stderr present), pushes
 *  an infrastructure warning instead of returning lint errors. */
async function captureRemainingErrors(
  command: string[],
  warnings?: string[],
  options: { stderrIsLintOutput?: boolean } = {},
): Promise<string | undefined> {
  const result = await $`${command}`.nothrow().quiet();
  if (result.exitCode === 0) return undefined;
  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString().trim();
  if (options.stderrIsLintOutput) return stdout || stderr || undefined;
  // Infra failure: linter crashed, not a lint error in the user's code
  if (!stdout && stderr && warnings) {
    warnings.push(`${command[0]} failed: ${stderr.split('\n')[0]}`);
    return undefined;
  }
  return stdout || undefined;
}

/** Build --config args if safeword config exists. */
function configArgs(configPath: string, hasConfig_: boolean): string[] {
  return hasConfig_ ? ['--config', configPath] : [];
}

/** Run prettier with safeword config if available */
async function runPrettier(file: string): Promise<void> {
  // A non-Prettier formatter owns this repo — defer to it, don't restyle (V7GGJZ).
  if (REPO_OWNS_ALTERNATIVE_FORMATTER) return;
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
  const normalizedFile = existsSync(file) ? realpathSync(file) : file;
  const extension = normalizedFile.split('.').pop()?.toLowerCase() ?? '';
  const warnings: string[] = [];

  // JS/TS and framework files - ESLint first (fix code), then Prettier (format)
  // Auto-upgrades safeword if TypeScript pack is missing
  if (JS_EXTENSIONS.has(extension)) {
    const hasEslint = await ensurePackInstalled('TypeScript', SAFEWORD_ESLINT);
    const cfg = configArgs(SAFEWORD_ESLINT, hasEslint);
    await $`bunx eslint ${cfg} --fix ${normalizedFile}`.nothrow().quiet();
    await runPrettier(normalizedFile);
    const errors = await captureRemainingErrors(
      ['bunx', 'eslint', ...cfg, normalizedFile],
      warnings,
    );
    return { warnings, ...(errors && { errors }) };
  }

  // Python files - Ruff check (fix code), then Ruff format
  // Auto-upgrades safeword if Python pack is missing
  if (PYTHON_EXTENSIONS.has(extension)) {
    if (
      !(await checkToolAvailable(
        'ruff',
        'Python',
        getPythonInstallHint(normalizedFile, 'ruff'),
        warnings,
      ))
    ) {
      return { warnings };
    }
    const hasRuff = await ensurePackInstalled('Python', SAFEWORD_RUFF);
    const cfg = configArgs(SAFEWORD_RUFF, hasRuff);
    await $`ruff check ${cfg} --fix ${normalizedFile}`.nothrow().quiet();
    await $`ruff format ${cfg} ${normalizedFile}`.nothrow().quiet();
    const errors = await captureRemainingErrors(
      ['ruff', 'check', ...cfg, normalizedFile],
      warnings,
    );
    return { warnings, ...(errors && { errors }) };
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
    // Safeword config requires golangci-lint v2+ (released March 2025)
    if (toolWarnings.has('golangci-lint-v1')) {
      return { warnings };
    }
    if (!toolWarnings.has('golangci-lint-v2-ok')) {
      const versionResult = await $`golangci-lint version --short`.nothrow().quiet();
      const version = versionResult.stdout.toString().trim().replace(/^v/, '');
      if (version && version.startsWith('1.')) {
        toolWarnings.add('golangci-lint-v1');
        warnings.push(
          `golangci-lint v${version} detected — safeword requires v2+. ` +
            `Upgrade: curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b $(go env GOPATH)/bin`,
        );
        return { warnings };
      }
      toolWarnings.add('golangci-lint-v2-ok');
    }
    const hasGolangci = await ensurePackInstalled('Go', SAFEWORD_GOLANGCI);
    const cfg = configArgs(SAFEWORD_GOLANGCI, hasGolangci);
    await $`golangci-lint run ${cfg} --fix ${normalizedFile}`.nothrow().quiet();
    await $`golangci-lint fmt ${cfg} ${normalizedFile}`.nothrow().quiet();
    const errors = await captureRemainingErrors(
      ['golangci-lint', 'run', ...cfg, normalizedFile],
      warnings,
    );
    return { warnings, ...(errors && { errors }) };
  }

  // Rust files - clippy for linting (package-level), rustfmt for formatting (file-level)
  // Auto-upgrades safeword if Rust pack is missing
  if (RUST_EXTENSIONS.has(extension)) {
    const hasRustConfig = await ensurePackInstalled('Rust', SAFEWORD_RUSTFMT);

    // Run clippy with package targeting for workspaces
    const packageName = detectRustPackage(normalizedFile);
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
        await $`rustfmt --config-path ${SAFEWORD_RUSTFMT} ${normalizedFile}`.nothrow().quiet();
      } else {
        await $`rustfmt ${normalizedFile}`.nothrow().quiet();
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

  // SQL files - host prettier when the host owns SQL formatting, else sqlfluff
  // (only for SQL-focused projects).
  // Only warn about missing sqlfluff if the sql pack is installed,
  // since .sql files exist in many non-SQL-focused contexts.
  if (SQL_EXTENSIONS.has(extension)) {
    // Host formats SQL via prettier-plugin-sql (#636/#638): run the HOST's
    // prettier — no --config override, so the host config (which declares the
    // plugin) and its .prettierignore carve-outs (frozen DDL migrations) apply.
    // Prettier's ignore resolution is cwd-relative; hooks run with cwd =
    // project root, which is what makes those carve-outs hold. This bypasses
    // runPrettier's V7GGJZ guard deliberately: plugin presence means the host
    // formats SQL with prettier even when Biome/dprint owns its JS/TS style.
    if (hostFormatsSqlWithPrettier(projectDir)) {
      const result = await $`bunx prettier --write ${normalizedFile}`.nothrow().quiet();
      if (result.exitCode === 0) return { warnings };
      // Non-zero: the plugin is undeclared in the host config, or the edit
      // itself doesn't parse. Only fall through to sqlfluff when its config
      // already exists — in a host-owned repo it's absent by design, and
      // falling through would fire ensurePackInstalled's network upgrade on
      // every failing edit. Surface prettier's stderr so the agent sees the
      // parse error instead of silence.
      if (!hasConfig(SAFEWORD_SQLFLUFF)) {
        const stderr = result.stderr.toString().trim();
        return { warnings, ...(stderr && { errors: stderr }) };
      }
    }
    const hasSqlfluff = await ensurePackInstalled('sql', SAFEWORD_SQLFLUFF);
    if (hasSqlfluff) {
      if (
        !(await checkToolAvailable(
          'sqlfluff',
          'SQL/dbt',
          getPythonInstallHint(normalizedFile, "'sqlfluff>=4.2.0'"),
          warnings,
        ))
      ) {
        return { warnings };
      }
      // Lint-and-report by default, like the ESLint/ruff branches; in-place
      // rewriting (`sqlfluff fix`) mutates the file beyond the agent's
      // intended edit, so it's opt-in via `sql.fix` (#638). Opted-in hosts
      // carve out frozen files with .sqlfluffignore, which sqlfluff honors
      // even for explicitly passed paths.
      if (sqlFixOptedIn(projectDir)) {
        await $`sqlfluff fix --config ${SAFEWORD_SQLFLUFF} ${normalizedFile}`.nothrow().quiet();
      }
      const errors = await captureRemainingErrors(
        ['sqlfluff', 'lint', '--config', SAFEWORD_SQLFLUFF, normalizedFile],
        warnings,
      );
      return { warnings, ...(errors && { errors }) };
    }
    return { warnings };
  }

  // Gherkin feature files - syntax/style lint, no auto-fix available
  if (FEATURE_EXTENSIONS.has(extension)) {
    const errors = await captureRemainingErrors(
      [...safewordCliCommand(), 'lint-gherkin', normalizedFile],
      warnings,
      { stderrIsLintOutput: true },
    );
    return { warnings, ...(errors && { errors }) };
  }

  // Other supported formats - prettier only
  if (PRETTIER_EXTENSIONS.has(extension)) {
    await runPrettier(normalizedFile);
    return { warnings };
  }

  // Shell scripts - shellcheck (if available), then Prettier (if plugin installed)
  if (SHELL_EXTENSIONS.has(extension)) {
    let shellErrors = '';
    if (await isCommandAvailable('shellcheck')) {
      const shellcheckResult = await $`shellcheck ${normalizedFile}`.nothrow().quiet();
      shellErrors =
        shellcheckResult.exitCode !== 0 ? shellcheckResult.stdout.toString().trim() : '';
    } else if (!toolWarnings.has('shellcheck')) {
      toolWarnings.add('shellcheck');
      warnings.push(
        'ShellCheck is not installed — shell scripts are not being linted. ' +
          'Install it with your system package manager, for example: brew install shellcheck',
      );
    }
    if (
      hasConfig(SAFEWORD_PRETTIER) ||
      existsSync(`${projectDir}/node_modules/prettier-plugin-sh`)
    ) {
      await runPrettier(normalizedFile);
    }
    return { warnings, ...(shellErrors && { errors: shellErrors }) };
  }

  return { warnings };
}
