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

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import nodePath from 'node:path';

export interface SafewordCli {
  command: string;
  args: string[];
  cwd: string;
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

function isInside(projectDirectory: string, path: string): boolean {
  try {
    const relative = nodePath.relative(realpathSync(projectDirectory), realpathSync(path));
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
  return version === undefined ? [] : [{ command: 'bunx', args: [`safeword@${version}`], cwd }];
}

/** The plugin CLI a trust check refused because project code could edit it, if any. */
export function projectWritablePluginCli(
  projectDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const plugin = pluginCli(environment);
  return plugin !== undefined && isInside(projectDirectory, plugin) ? plugin : undefined;
}

/**
 * A trusted CLI script, run from its own directory with no env file: Bun reads
 * `bunfig.toml` (including `preload`) and `.env` from its working directory, so
 * running from the project would let project files answer for the CLI.
 */
function trustedBunScript(path: string): SafewordCli {
  return { command: 'bun', args: ['--no-env-file', path], cwd: nodePath.dirname(path) };
}

/** CLIs a trust check may run: none of them can be changed by the project's own files. */
export function trustedSafewordClis(
  projectDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): SafewordCli[] {
  const candidates: SafewordCli[] = [];
  const plugin = pluginCli(environment);
  if (plugin !== undefined && !isInside(projectDirectory, plugin)) {
    candidates.push(trustedBunScript(plugin));
  }
  const version = pinnedSafewordVersion(projectDirectory);
  if (version !== undefined) {
    const codexHome = environment.CODEX_HOME || nodePath.join(homedir(), '.codex');
    const codexCli = nodePath.join(
      codexHome,
      'plugins',
      'cache',
      'safeword',
      'safeword',
      version,
      'runtime',
      'cli.js',
    );
    if (existsSync(codexCli) && !isInside(projectDirectory, codexCli)) {
      candidates.push(trustedBunScript(codexCli));
    }
  }
  // `bunx` resolves the caller's node_modules first; running from the home
  // directory keeps project contents from shadowing the published package.
  return [...candidates, ...pinnedBunx(projectDirectory, homedir())];
}

/** This repo's own CLI source, only when the checkout really is the safeword package. */
function sourceCli(projectDirectory: string): string | undefined {
  const source = nodePath.join(projectDirectory, 'packages', 'cli', 'src', 'cli.ts');
  if (!existsSync(source)) return undefined;
  try {
    const manifest = JSON.parse(
      readFileSync(nodePath.join(projectDirectory, 'packages', 'cli', 'package.json'), 'utf8'),
    ) as { name?: unknown };
    return manifest.name === 'safeword' ? source : undefined;
  } catch {
    return undefined;
  }
}

/** CLIs a plain action may run, in preference order. */
export function safewordClis(
  projectDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): SafewordCli[] {
  const bunScripts = [pluginCli(environment), sourceCli(projectDirectory)].filter(
    (path): path is string => path !== undefined,
  );
  // The package manager's own entry for the project's installed safeword.
  const installed = nodePath.join(projectDirectory, 'node_modules', '.bin', 'safeword');
  return [
    ...bunScripts.map(path => ({ command: 'bun', args: [path], cwd: projectDirectory })),
    ...(existsSync(installed) ? [{ command: installed, args: [], cwd: projectDirectory }] : []),
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
