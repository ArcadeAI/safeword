// Shared linting logic for Claude Code and Cursor hooks
// Used by: post-tool-lint.ts, cursor/after-file-edit.ts
//
// Uses explicit --config flags pointing to .safeword/ configs for LLM enforcement.
// This allows stricter rules for LLMs while humans use their normal project configs.
//
// Missing language-pack configs never trigger upgrade, staging, or commit side
// effects from linting. Version upgrades run at session start; pack repair is
// manual, so fallback linting reports the missing config once per session.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

import { $ } from 'bun';

import { resolveHostToolchain, runHostToolchain } from './host-toolchain.js';
import { safewordCli } from './safeword-cli.js';
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

/**
 * Safeword config paths for the project a file is linted in (#5467). Built per
 * `lintFile` call from the project the caller resolved — never fixed at import
 * time from CLAUDE_PROJECT_DIR, which stays at the launch checkout when a
 * session works in a worktree.
 */
interface ProjectLintConfig {
  root: string;
  eslint: string;
  ruff: string;
  sqlfluff: string;
  clippy: string;
  rustfmt: string;
  prettier: string;
  /**
   * Whether this repo is owned by a non-Prettier formatter (Biome, dprint,
   * oxfmt, deno); when true the hook skips Prettier so it never restyles the
   * customer's files into a competing style (ticket V7GGJZ). ESLint still runs
   * (security/complexity) — see lintFile.
   */
  ownsAlternativeFormatter: boolean;
}

function projectLintConfig(projectDirectory: string): ProjectLintConfig {
  const root = normalizeExistingDirectory(projectDirectory);
  const config = (name: string) => `${root}/.safeword/${name}`;
  return {
    root,
    eslint: config('eslint.config.mjs'),
    ruff: config('ruff.toml'),
    sqlfluff: config('sqlfluff.cfg'),
    clippy: config('clippy.toml'),
    rustfmt: config('rustfmt.toml'),
    prettier: config('.prettierrc'),
    ownsAlternativeFormatter: projectOwnsAlternativeFormatter(root),
  };
}

// Track which tools we've already warned about (once per session)
const toolWarnings = new Set<string>();

/** Result from linting a file */
export interface LintResult {
  /** Warnings for Claude (e.g., missing tool binaries) */
  warnings: string[];
  /** Lint diagnostics (surfaced to Claude via additionalContext). */
  errors?: string;
  /** Go uses package scope and does not apply linter autofixes. */
  diagnosticContext?: string;
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
function findUpward(filePath: string, markerFile: string, root: string): string | undefined {
  let currentDirectory = nodePath.dirname(filePath);
  const normalizedProjectDir = normalizeExistingDirectory(root);

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
function getPythonInstallHint(filePath: string, tool: string, root: string): string {
  if (findUpward(filePath, 'uv.lock', root)) return `uv add --dev ${tool}`;
  if (findUpward(filePath, 'poetry.lock', root)) return `poetry add --group dev ${tool}`;
  if (findUpward(filePath, 'Pipfile', root)) return `pipenv install --dev ${tool}`;
  return `pip install ${tool}`;
}

// `homedir()` reads the passwd entry rather than $HOME, so consult the
// environment first — a hook inherits whatever HOME its host session was given.
const MISE_SHIMS = nodePath.join(
  process.env.MISE_DATA_DIR ||
    nodePath.join(
      process.env.XDG_DATA_HOME || nodePath.join(process.env.HOME || homedir(), '.local/share'),
      'mise',
    ),
  'shims',
);

const MISE_CONFIG_FILES = [
  'mise.toml',
  '.mise.toml',
  'mise.local.toml',
  '.config/mise/config.toml',
];

/**
 * Remedy text for a tool this hook can't reach. Hooks run non-interactively, so
 * a host whose shell rc runs `mise activate` gets no shims on PATH here even
 * though the tool works in their terminal. Telling them to install it again
 * plants a second copy that shadows their pinned version — and two versions of a
 * formatter disagree, which shows up as churn in their diffs. mise's own answer
 * for non-interactive callers is the shims directory, so hand that back instead.
 */
function installGuidance(tool: string, fallback: string, root: string): string {
  const reachShims = `add ${MISE_SHIMS} to their login PATH, which reaches every mise-managed tool at once`;
  if (existsSync(nodePath.join(MISE_SHIMS, tool))) {
    return `The user already manages "${tool}" with mise; this hook's PATH just can't see it. Ask them to ${reachShims}.`;
  }
  if (!MISE_CONFIG_FILES.some(file => existsSync(nodePath.join(root, file)))) return fallback;
  // Installing through mise only helps once the shims directory is reachable.
  const lead = "This project's toolchain is managed by mise. Ask the user if they'd like you to";
  return (process.env.PATH ?? '').split(nodePath.delimiter).includes(MISE_SHIMS)
    ? `${lead} install it by running: mise use ${tool}`
    : `${lead} ${reachShims}, then install it by running: mise use ${tool}`;
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
  root: string,
): Promise<boolean> {
  if (toolWarnings.has(tool)) return false;
  const available = await isCommandAvailable(tool);
  if (!available) {
    toolWarnings.add(tool);
    warnings.push(
      `${language} linter "${tool}" is not available — ${language} files are not being linted. ` +
        installGuidance(
          tool,
          `Ask the user if they'd like you to install it by running: ${installHint}`,
          root,
        ),
    );
  }
  return available;
}

/** Check config exists, dynamically (not cached) */
function hasConfig(path: string): boolean {
  return existsSync(path);
}

function safewordCliCommand(root: string): string[] | undefined {
  const cli = safewordCli(root);
  return cli === undefined ? undefined : [cli.command, ...cli.args];
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
function detectRustPackage(filePath: string, root: string): string | undefined {
  let currentDirectory = nodePath.dirname(filePath);
  const normalizedProjectDir = normalizeExistingDirectory(root);

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
  if (options.stderrIsLintOutput) return [stdout, stderr].filter(Boolean).join('\n') || undefined;
  // Infra failure: linter crashed, not a lint error in the user's code
  if (!stdout && stderr && warnings) {
    warnings.push(`${command[0]} failed: ${stderr.split('\n')[0]}`);
    return undefined;
  }
  return stdout || undefined;
}

/** Build --config args if safeword config exists. */
function configArgs(configPath: string): string[] {
  return hasConfig(configPath) ? ['--config', configPath] : [];
}

/** Warn once per session when fallback linting cannot enforce Safeword rules. */
function warnMissingSafewordConfig(
  packName: string,
  tool: string,
  configPath: string,
  warnings: string[],
): void {
  if (hasConfig(configPath)) return;
  const warningKey = `pack:${packName}`;
  if (toolWarnings.has(warningKey)) return;
  toolWarnings.add(warningKey);
  warnings.push(
    `${packName} Safeword config is missing — linting with ${tool} defaults, not Safeword rules. ` +
      'Run `safeword install` to install it.',
  );
}

/** Run prettier with safeword config if available */
async function runPrettier(
  project: ProjectLintConfig,
  file: string,
  fix = true,
): Promise<string | undefined> {
  // A non-Prettier formatter owns this repo — defer to it, don't restyle (V7GGJZ).
  if (project.ownsAlternativeFormatter) return;
  if (!fix) {
    return captureRemainingErrors(
      ['bunx', 'prettier', ...configArgs(project.prettier), '--check', '--ignore-unknown', file],
      undefined,
      { stderrIsLintOutput: true },
    );
  }
  if (hasConfig(project.prettier)) {
    await $`bunx prettier --config ${project.prettier} --write ${file}`.nothrow().quiet();
  } else {
    await $`bunx prettier --write ${file}`.nothrow().quiet();
  }
}

/** Invoke the bundled Go helper and validate its JSON response. */
function runGoLintHelper(file: string, projectRoot: string, fix = true): LintResult {
  const cli = safewordCli(projectRoot);
  if (!cli)
    return {
      warnings: [
        'Go lint helper is unavailable; run `safeword install` to align hooks and runtime.',
      ],
    };
  const result = spawnSync(
    cli.command,
    [
      ...cli.args,
      'hook',
      'go-lint',
      '--file',
      file,
      '--project-root',
      projectRoot,
      '--original-cwd',
      process.cwd(),
      ...(fix ? [] : ['--no-fix']),
    ],
    { cwd: cli.cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.status !== 0 || result.error) {
    return {
      warnings: [
        `Go lint helper failed; update Safeword to align hooks and runtime: ${result.error?.message ?? result.stderr.trim()}`,
      ],
    };
  }
  try {
    const answer: unknown = JSON.parse(result.stdout);
    if (
      typeof answer !== 'object' ||
      answer === null ||
      !('warnings' in answer) ||
      !Array.isArray(answer.warnings) ||
      !answer.warnings.every(entry => typeof entry === 'string') ||
      ('errors' in answer && typeof answer.errors !== 'string') ||
      ('diagnosticContext' in answer && typeof answer.diagnosticContext !== 'string')
    ) {
      throw new Error('invalid helper result');
    }
    return answer as LintResult;
  } catch (error) {
    return { warnings: [`Go lint helper returned an invalid result: ${String(error)}`] };
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
 * @param projectDirectory - The project the file is linted in; its `.safeword` configs apply
 * @param options - Set fix to false for observational checks between edits.
 */
export async function lintFile(
  file: string,
  projectDirectory: string,
  options: { fix?: boolean } = {},
): Promise<LintResult> {
  const project = projectLintConfig(projectDirectory);
  const normalizedFile = existsSync(file) ? realpathSync(file) : file;
  const extension = normalizedFile.split('.').pop()?.toLowerCase() ?? '';
  const warnings: string[] = [];

  // JS/TS and framework files - ESLint first (fix code), then Prettier (format)
  if (JS_EXTENSIONS.has(extension)) {
    const canonicalRoot = project.root;
    const safewordDirectory = nodePath.join(canonicalRoot, '.safeword');
    if (
      normalizedFile === safewordDirectory ||
      normalizedFile.startsWith(`${safewordDirectory}/`)
    ) {
      return { warnings };
    }
    const host = resolveHostToolchain(normalizedFile, projectDirectory);
    if (host?.kind === 'unavailable') {
      return {
        warnings: [
          `The ${host.owner} toolchain for ${normalizedFile} has no project-local executable. ` +
            'Install it in this workspace or its Safeword project root; Safeword will not use PATH or download a replacement.',
        ],
      };
    }
    if (host?.kind === 'outside-root') {
      return {
        warnings: [
          `Edited file ${host.file} resolves outside the Safeword project root ${host.root}. ` +
            'Safeword will not run a host toolchain or generic JavaScript formatter for this path.',
        ],
      };
    }
    if (host) return runHostToolchain(host, options.fix !== false);
    warnMissingSafewordConfig('TypeScript', 'ESLint', project.eslint, warnings);
    const configArguments = configArgs(project.eslint);
    // An edit may be one step of a larger change. Never remove imports or
    // rewrite untouched lines while the agent is still composing that change.
    if (options.fix !== false) {
      await $`bunx eslint ${configArguments} --fix ${normalizedFile}`.nothrow().quiet();
      await runPrettier(project, normalizedFile);
    }
    const errors = await captureRemainingErrors(
      ['bunx', 'eslint', ...configArguments, normalizedFile],
      warnings,
    );
    return { warnings, ...(errors && { errors }) };
  }

  // Python files - Ruff check (fix code), then Ruff format
  if (PYTHON_EXTENSIONS.has(extension)) {
    if (
      !(await checkToolAvailable(
        'ruff',
        'Python',
        getPythonInstallHint(normalizedFile, 'ruff', project.root),
        warnings,
        project.root,
      ))
    ) {
      return { warnings };
    }
    warnMissingSafewordConfig('Python', 'Ruff', project.ruff, warnings);
    const configArguments = configArgs(project.ruff);
    if (options.fix === false) {
      const lintErrors = await captureRemainingErrors(
        ['ruff', 'check', ...configArguments, '--no-fix', '--no-fix-only', normalizedFile],
        warnings,
      );
      const formatErrors = await captureRemainingErrors(
        ['ruff', 'format', ...configArguments, '--check', normalizedFile],
        warnings,
        { stderrIsLintOutput: true },
      );
      const errors = [lintErrors, formatErrors].filter(Boolean).join('\n');
      return { warnings, ...(errors && { errors }) };
    }
    await $`ruff check ${configArguments} --fix ${normalizedFile}`.nothrow().quiet();
    await $`ruff format ${configArguments} ${normalizedFile}`.nothrow().quiet();
    const errors = await captureRemainingErrors(
      ['ruff', 'check', ...configArguments, normalizedFile],
      warnings,
    );
    return { warnings, ...(errors && { errors }) };
  }

  // Go preserves package configuration paths and checks the complete package.
  // Check-only mode reports formatting diffs and overrides configured autofixes.
  if (GO_EXTENSIONS.has(extension)) {
    const root = project.root;
    const relative = nodePath.relative(root, normalizedFile);
    if (
      relative === '..' ||
      relative.startsWith(`..${nodePath.sep}`) ||
      nodePath.isAbsolute(relative)
    ) {
      return {
        warnings: [
          `Edited file ${normalizedFile} resolves outside the Safeword project root ${root}; Go lint and formatting were skipped.`,
        ],
      };
    }
    if (
      !(await checkToolAvailable(
        'golangci-lint',
        'Go',
        'curl -sSfL https://golangci-lint.run/install.sh | sh',
        warnings,
        project.root,
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
    const lintResult = runGoLintHelper(normalizedFile, projectDirectory, options.fix !== false);
    lintResult.warnings = lintResult.warnings.filter(warning => {
      if (!warning.startsWith('Go Safeword config is missing')) return true;
      if (toolWarnings.has('pack:Go')) return false;
      toolWarnings.add('pack:Go');
      return true;
    });
    return lintResult;
  }

  // Rust files - clippy for linting (package-level), rustfmt for formatting (file-level)
  if (RUST_EXTENSIONS.has(extension)) {
    const diagnostics: string[] = [];
    const hasRustConfig = hasConfig(project.rustfmt);
    warnMissingSafewordConfig('Rust', 'rustfmt', project.rustfmt, warnings);

    // Run clippy with package targeting for workspaces
    const packageName = detectRustPackage(normalizedFile, project.root);
    if (packageName && (await isCommandAvailable('cargo'))) {
      const clippyEnv = hasConfig(project.clippy)
        ? { CLIPPY_CONF_DIR: nodePath.dirname(project.clippy) }
        : {};

      if (options.fix === false) {
        // Quiet suppresses build progress, while keeping warnings (including
        // those returned with exit 0) and compiler errors available to the agent.
        const result = await $`cargo clippy --quiet -p ${packageName}`
          .env(clippyEnv)
          .nothrow()
          .quiet();
        const output = [result.stdout.toString().trim(), result.stderr.toString().trim()]
          .filter(Boolean)
          .join('\n');
        if (output) diagnostics.push(output);
        else if (result.exitCode !== 0)
          warnings.push(`cargo clippy exited ${result.exitCode} without diagnostics.`);
      } else {
        await $`cargo clippy -p ${packageName} --fix --allow-dirty --allow-staged`
          .env(clippyEnv)
          .nothrow()
          .quiet();
      }
    }

    // Run rustfmt for file-level formatting
    if (await isCommandAvailable('rustfmt')) {
      if (options.fix === false) {
        const errors = await captureRemainingErrors(
          [
            'rustfmt',
            ...(hasRustConfig ? ['--config-path', project.rustfmt] : []),
            '--check',
            normalizedFile,
          ],
          warnings,
          { stderrIsLintOutput: true },
        );
        if (errors) diagnostics.push(errors);
      } else if (hasRustConfig) {
        await $`rustfmt --config-path ${project.rustfmt} ${normalizedFile}`.nothrow().quiet();
      } else {
        await $`rustfmt ${normalizedFile}`.nothrow().quiet();
      }
    } else if (!toolWarnings.has('rustfmt')) {
      toolWarnings.add('rustfmt');
      warnings.push(
        'Rust formatter "rustfmt" is not available — Rust files are not being formatted. ' +
          installGuidance(
            'rustfmt',
            "Ask the user if they'd like you to install it by running: rustup component add rustfmt",
            project.root,
          ),
      );
    }
    const errors = diagnostics.join('\n');
    return { warnings, ...(errors && { errors }) };
  }

  // SQL files - host prettier when the host owns SQL formatting, else sqlfluff
  // (only for SQL-focused projects).
  // Only warn about missing sqlfluff if the sql pack is installed,
  // since .sql files exist in many non-SQL-focused contexts.
  if (SQL_EXTENSIONS.has(extension)) {
    let formattingErrors: string | undefined;
    // Host formats SQL via prettier-plugin-sql (#636/#638): run the HOST's
    // prettier — no --config override, so the host config (which declares the
    // plugin) and its .prettierignore carve-outs (frozen DDL migrations) apply.
    // Prettier's ignore resolution is cwd-relative; hooks run with cwd =
    // project root, which is what makes those carve-outs hold. This bypasses
    // runPrettier's V7GGJZ guard deliberately: plugin presence means the host
    // formats SQL with prettier even when Biome/dprint owns its JS/TS style.
    if (hostFormatsSqlWithPrettier(project.root)) {
      const mode = options.fix === false ? '--check' : '--write';
      const result = await $`bunx prettier ${mode} ${normalizedFile}`.nothrow().quiet();
      if (result.exitCode === 0) return { warnings };
      const output = [result.stdout.toString().trim(), result.stderr.toString().trim()]
        .filter(Boolean)
        .join('\n');
      if (options.fix === false) formattingErrors = output;
      // Non-zero: the plugin is undeclared in the host config, or the edit
      // itself doesn't parse. Only fall through to sqlfluff when its config
      // already exists — in a host-owned repo it's absent by design. Surface
      // prettier's stderr so the agent sees the parse error instead of silence.
      if (!hasConfig(project.sqlfluff)) {
        const errors = formattingErrors ?? result.stderr.toString().trim();
        return { warnings, ...(errors && { errors }) };
      }
    }
    const hasSqlfluff = hasConfig(project.sqlfluff);
    if (hasSqlfluff) {
      if (
        !(await checkToolAvailable(
          'sqlfluff',
          'SQL/dbt',
          getPythonInstallHint(normalizedFile, "'sqlfluff>=4.2.0'", project.root),
          warnings,
          project.root,
        ))
      ) {
        return { warnings, ...(formattingErrors && { errors: formattingErrors }) };
      }
      // SQL fixes require both explicit fix mode and the legacy sql.fix opt-in.
      // Post-edit checks preserve source even when that opt-in is configured.
      if (options.fix !== false && sqlFixOptedIn(project.root)) {
        await $`sqlfluff fix --config ${project.sqlfluff} ${normalizedFile}`.nothrow().quiet();
      }
      const lintErrors = await captureRemainingErrors(
        ['sqlfluff', 'lint', '--config', project.sqlfluff, normalizedFile],
        warnings,
      );
      const errors = [formattingErrors, lintErrors].filter(Boolean).join('\n');
      return { warnings, ...(errors && { errors }) };
    }
    return { warnings };
  }

  // Gherkin feature files - syntax/style lint, no auto-fix available
  const cli = FEATURE_EXTENSIONS.has(extension) ? safewordCliCommand(project.root) : undefined;
  if (cli !== undefined) {
    const errors = await captureRemainingErrors(
      [...cli, 'lint-gherkin', normalizedFile],
      warnings,
      { stderrIsLintOutput: true },
    );
    return { warnings, ...(errors && { errors }) };
  }

  // Other supported formats - prettier only
  if (PRETTIER_EXTENSIONS.has(extension)) {
    const errors = await runPrettier(project, normalizedFile, options.fix !== false);
    return { warnings, ...(errors && { errors }) };
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
        'ShellCheck is not available — shell scripts are not being linted. ' +
          installGuidance(
            'shellcheck',
            'Install it with your system package manager, for example: brew install shellcheck',
            project.root,
          ),
      );
    }
    if (
      hasConfig(project.prettier) ||
      existsSync(`${project.root}/node_modules/prettier-plugin-sh`)
    ) {
      const formattingErrors = await runPrettier(project, normalizedFile, options.fix !== false);
      shellErrors = [shellErrors, formattingErrors].filter(Boolean).join('\n');
    }
    return { warnings, ...(shellErrors && { errors: shellErrors }) };
  }

  return { warnings };
}
