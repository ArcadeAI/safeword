/**
 * The one way Safeword hooks find the Safeword CLI (ticket 8VG20K).
 *
 * Plugin hosts (Claude Code, Codex) run their own bundled copy. Hosts without a
 * plugin (Cursor, and project-local hook delivery) run the npm package pinned to
 * the project's installed version, never an unpinned or `@latest` one.
 *
 * Two entry points:
 * - `trustedSafewordClis` for trust checks (receipt and gate verification):
 *   never a CLI the reviewed project can edit, so its output cannot be forged
 *   by project code.
 * - `safewordClis` for plain actions: also accepts this repo's source while
 *   developing Safeword and the project's installed package.
 *
 * Each returns candidates in preference order; callers use the first that runs.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import nodePath from 'node:path';

export interface SafewordCli {
  command: string;
  args: string[];
  cwd: string;
  /** Runs a package runner that may download the pinned package on first use. */
  downloads?: boolean;
}

const SEMVER =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

/** The Safeword version this project installed, from `.safeword/version`. */
export function pinnedSafewordVersion(projectDirectory: string): string | undefined {
  try {
    const version = readFileSync(
      nodePath.join(projectDirectory, '.safeword', 'version'),
      'utf8',
    ).trim();
    return SEMVER.test(version) ? version : undefined;
  } catch {
    return undefined;
  }
}

/** Whether `path` lies in the project, judged by its nearest existing ancestor's real path. */
function isInside(projectDirectory: string, path: string): boolean {
  let existing = nodePath.resolve(path);
  const rest: string[] = [];
  while (!existsSync(existing)) {
    const parent = nodePath.dirname(existing);
    if (parent === existing) return true;
    rest.unshift(nodePath.basename(existing));
    existing = parent;
  }
  try {
    const project = realpathSync(projectDirectory);
    const relative = nodePath.relative(project, nodePath.join(realpathSync(existing), ...rest));
    return (
      relative === '' ||
      (relative !== '..' &&
        !relative.startsWith(`..${nodePath.sep}`) &&
        !nodePath.isAbsolute(relative))
    );
  } catch {
    return true;
  }
}

/** The plugin's bundled CLI, from the dispatcher's explicit path or the plugin root. */
function pluginCli(environment: NodeJS.ProcessEnv): string | undefined {
  const explicit = environment.SAFEWORD_PLUGIN_CLI?.trim();
  const root = environment.CLAUDE_PLUGIN_ROOT?.trim();
  const path = explicit || (root ? nodePath.join(root, 'runtime', 'cli.js') : undefined);
  return path !== undefined && existsSync(path) ? path : undefined;
}

function pinnedBunx(projectDirectory: string, cwd: string): SafewordCli[] {
  const version = pinnedSafewordVersion(projectDirectory);
  return version === undefined
    ? []
    : [{ command: 'bunx', args: [`safeword@${version}`], cwd, downloads: true }];
}

/** The plugin CLI a trust check refused because project code could edit it, if any. */
export function projectWritablePluginCli(
  projectDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const plugin = pluginCli(environment);
  return plugin !== undefined && isInside(projectDirectory, plugin) ? plugin : undefined;
}

/** The runtime a trust check runs under: an absolute binary, never a PATH lookup. */
export interface TrustedRuntime {
  path: string;
  isBun: boolean;
}

function currentRuntime(environment: NodeJS.ProcessEnv): TrustedRuntime {
  if (process.versions.bun !== undefined) return { path: process.execPath, isBun: true };
  // Under Node (the npm-installed CLI, tests), find Bun on PATH; the caller still
  // refuses it when it resolves inside the project.
  for (const directory of (environment.PATH ?? '').split(nodePath.delimiter)) {
    const candidate = nodePath.join(directory, 'bun');
    if (directory !== '' && existsSync(candidate)) return { path: candidate, isBun: true };
  }
  return { path: process.execPath, isBun: false };
}

/**
 * CLIs a trust check may run. Nothing project files can change gets to answer:
 * - the runtime is the absolute binary already running this hook, outside the
 *   project (a PATH lookup could find a project-owned `bun` or `bunx` shim);
 * - each script is canonicalized and must resolve outside the project, then runs
 *   from its own real directory with no env file, because Bun loads `bunfig.toml`
 *   (including `preload`) and `.env` from its working directory;
 * - the published package runs as `bun x --bun safeword@<.safeword/version>` from the
 *   home directory, so project `node_modules` cannot shadow it.
 */
export function trustedSafewordClis(
  projectDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
  runtime: TrustedRuntime = currentRuntime(environment),
): SafewordCli[] {
  let runtimePath: string;
  try {
    runtimePath = realpathSync(runtime.path);
  } catch {
    return [];
  }
  if (isInside(projectDirectory, runtimePath)) return [];

  const scripts: string[] = [];
  const plugin = pluginCli(environment);
  if (plugin !== undefined) scripts.push(plugin);
  const version = pinnedSafewordVersion(projectDirectory);
  if (version !== undefined) {
    const codexHome = environment.CODEX_HOME || nodePath.join(homedir(), '.codex');
    scripts.push(
      nodePath.join(
        codexHome,
        'plugins',
        'cache',
        'safeword',
        'safeword',
        version,
        'runtime',
        'cli.js',
      ),
    );
  }

  const candidates: SafewordCli[] = [];
  for (const script of scripts) {
    let real: string;
    try {
      real = realpathSync(script);
    } catch {
      continue;
    }
    if (isInside(projectDirectory, real)) continue;
    candidates.push({
      command: runtimePath,
      args: runtime.isBun ? ['--no-env-file', real] : [real],
      cwd: nodePath.dirname(real),
    });
  }
  // Bun also reads bunfig.toml from the package runner's working directory, so it
  // must sit outside the project too (a project can be the home directory).
  const runnerDirectory = [homedir(), tmpdir(), nodePath.parse(homedir()).root].find(
    directory => !isInside(projectDirectory, directory),
  );
  if (version !== undefined && runtime.isBun && runnerDirectory !== undefined) {
    // `--bun` runs the package under this Bun even though its bin has a Node
    // shebang; otherwise `bun x` would look `node` up on PATH.
    candidates.push({
      command: runtimePath,
      args: ['x', '--bun', `safeword@${version}`],
      cwd: runnerDirectory,
      downloads: true,
    });
  }
  return candidates;
}

/** Settings that name a directory the trusted CLI or Bun reads from or writes to. */
const TRUSTED_PATH_SETTINGS = [
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'XDG_STATE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'CODEX_HOME',
  'SAFEWORD_REVIEW_KEY_ROOT',
  'BUN_INSTALL_CACHE_DIR',
  'TMPDIR',
].map(name => name.toUpperCase());

/** Everything a trusted CLI may inherit: the directories above plus these. */
const TRUSTED_ENVIRONMENT = new Set([
  ...TRUSTED_PATH_SETTINGS,
  ...[
    'PATH',
    'SystemRoot',
    'NODE_ENV',
    // `bun x safeword@<version>` needs the host's registry and proxy settings.
    'BUN_CONFIG_REGISTRY',
    'NPM_CONFIG_REGISTRY',
    'HTTPS_PROXY',
    'HTTP_PROXY',
    'NO_PROXY',
  ].map(name => name.toUpperCase()),
]);

/**
 * The environment a trust check passes to its CLI: host paths, state, and
 * registry settings only. Runtime option variables (BUN_OPTIONS, NODE_OPTIONS)
 * can preload arbitrary scripts, so nothing outside this list is inherited, and
 * a directory setting that resolves inside the project (where project code could
 * plant a cached package or state) is dropped.
 */
export function trustedEnvironment(
  projectDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(environment).filter(([name, value]) => {
      const key = name.toUpperCase();
      if (!TRUSTED_ENVIRONMENT.has(key)) return false;
      return !TRUSTED_PATH_SETTINGS.includes(key) || !isInside(projectDirectory, value ?? '');
    }),
  );
}

/** What the trusted CLIs said to one gate question. */
export type TrustedAnswer<T> =
  | { kind: 'refused' }
  | { kind: 'missing' }
  | { kind: 'answered'; value: T }
  | { kind: 'unanswered'; tried: string };

/**
 * Ask the trusted CLIs one JSON question, in preference order, until one gives a valid
 * answer. `interpret` returns undefined for a run that gave no valid result.
 * Refuses outright when the configured plugin CLI is inside the project.
 */
export function askTrustedSafeword<T>(
  projectDirectory: string,
  question: readonly string[],
  interpret: (run: { status: number | null; stdout: string }) => T | undefined,
): TrustedAnswer<T> {
  if (projectWritablePluginCli(projectDirectory) !== undefined) return { kind: 'refused' };
  const candidates = trustedSafewordClis(projectDirectory);
  if (candidates.length === 0) return { kind: 'missing' };
  for (const cli of candidates) {
    const run = spawnSync(
      cli.command,
      [...cli.args, '--json', '--no-input', '--cwd', projectDirectory, ...question],
      {
        cwd: cli.cwd,
        env: trustedEnvironment(projectDirectory),
        encoding: 'utf8',
        // A first `bun x` run may download the pinned package.
        timeout: cli.downloads === true ? 30_000 : 5000,
      },
    );
    const value = interpret({ status: run.status, stdout: run.stdout ?? '' });
    if (value !== undefined) return { kind: 'answered', value };
  }
  const tried = candidates.map(cli => [cli.command, ...cli.args].join(' ')).join(', ');
  return { kind: 'unanswered', tried };
}

/** Recheck the signed branch result immediately before a feature is marked done. */
export function branchReviewCompletionProblem(
  projectDirectory: string,
  ticketFolder: string,
  ticketPath: string,
): string | undefined {
  const ticketId = ticketFolder.split('-')[0];
  if (!ticketId || !/^[A-Za-z0-9]+$/u.test(ticketId))
    return 'The active ticket has no valid ID for branch review.';
  // A feature already in verification before branch reviews existed has no
  // marker or local job. Its prior completion route remains available.
  try {
    const jobs = nodePath.join(projectDirectory, '.safeword', 'state', 'reviews', 'branch');
    const hasMarker = /^branch_review_exit_id:/mu.test(readFileSync(ticketPath, 'utf8'));
    if (!hasMarker && (!existsSync(jobs) || readdirSync(jobs).length === 0)) return undefined;
  } catch {
    // Unreadable local state still needs the trusted checker.
  }
  const answer = askTrustedSafeword(
    projectDirectory,
    ['review', 'branch-check', ticketId, 'verify'],
    run => {
      try {
        const result = JSON.parse(run.stdout) as {
          data?: { command?: unknown; ticket_id?: unknown; phase?: unknown; may_advance?: unknown };
          findings?: Array<{ message?: unknown }>;
        };
        if (
          result.data?.command !== 'review branch-check' ||
          result.data.ticket_id !== ticketId ||
          result.data.phase !== 'verify' ||
          typeof result.data.may_advance !== 'boolean'
        )
          return undefined;
        return run.status === 0 && result.data.may_advance
          ? { problem: undefined }
          : { problem: String(result.findings?.[0]?.message ?? 'The branch review is stale.') };
      } catch {
        return undefined;
      }
    },
  );
  return answer.kind === 'answered'
    ? answer.value.problem
    : 'The trusted branch-review checker could not confirm a current review.';
}

/** A package.json's name and version, or an empty record when it is missing or malformed. */
function readManifest(path: string): { name?: unknown; version?: unknown } {
  try {
    const manifest: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return typeof manifest === 'object' && manifest !== null ? manifest : {};
  } catch {
    return {};
  }
}

/** This repo's own CLI source, only when the checkout really is the safeword package. */
function sourceCli(projectDirectory: string): string | undefined {
  const source = nodePath.join(projectDirectory, 'packages', 'cli', 'src', 'cli.ts');
  if (!existsSync(source)) return undefined;
  const manifest = readManifest(nodePath.join(projectDirectory, 'packages', 'cli', 'package.json'));
  return manifest.name === 'safeword' ? source : undefined;
}

/**
 * The package manager's entry for the project's own safeword, only when that
 * package is the version `.safeword/version` pins: a dependency update that runs
 * ahead of the installed hooks must not change which CLI they run.
 */
function installedCli(projectDirectory: string): string | undefined {
  const bin = nodePath.join(projectDirectory, 'node_modules', '.bin', 'safeword');
  const pinned = pinnedSafewordVersion(projectDirectory);
  if (pinned === undefined || !existsSync(bin)) return undefined;
  const manifest = readManifest(
    nodePath.join(projectDirectory, 'node_modules', 'safeword', 'package.json'),
  );
  return manifest.version === pinned ? bin : undefined;
}

/** CLIs a plain action may run, in preference order. */
export function safewordClis(
  projectDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): SafewordCli[] {
  const bunScripts = [sourceCli(projectDirectory), pluginCli(environment)].filter(
    (path): path is string => path !== undefined,
  );
  const installed = installedCli(projectDirectory);
  return [
    ...bunScripts.map(path => ({ command: 'bun', args: [path], cwd: projectDirectory })),
    ...(installed === undefined ? [] : [{ command: installed, args: [], cwd: projectDirectory }]),
    ...pinnedBunx(projectDirectory, projectDirectory),
  ];
}

/** The preferred CLI for a plain action, or undefined when the project has none. */
export function safewordCli(
  projectDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): SafewordCli | undefined {
  return safewordClis(projectDirectory, environment)[0];
}
