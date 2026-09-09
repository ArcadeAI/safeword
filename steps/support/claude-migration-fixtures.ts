/**
 * Drivers for the automatic Claude migration acceptance lane.
 *
 * The Gherkin scenarios say *what* migration must do. This module says *how* to
 * make it happen, so a scenario can be exercised at the altitude its claim
 * actually lives at:
 *
 * - `runPluginHook` drives the packaged generated plugin through its
 *   `hooks.json` command at the process boundary, in a real temp project, over
 *   real legacy bytes. This
 *   is the default: most scenarios are about what happens "after the exact
 *   plugin handles a prompt", so anything below the hook would not prove it.
 * - `migrateDirectly` / `recoverDirectly` drive the migration module with an
 *   injected clock. Deadlines, deferral, and recovery-image algebra cannot be
 *   made deterministic through a subprocess, and a scenario that sleeps to
 *   observe a deadline is a scenario that flakes in CI.
 *
 * Real legacy bytes come from the release tags themselves, so a fixture can
 * never drift from what customers actually installed.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { CLAUDE_HISTORICAL_CATALOGUE } from '../../packages/cli/src/claude-plugin/historical-catalogue.generated.js';
import { historicalHookEntry } from '../../packages/cli/src/claude-plugin/historical-ownership.js';

export const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../..');
export const PLUGIN_ROOT = nodePath.join(REPO_ROOT, 'plugin');

const created: string[] = [];

function git(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Installed-path to real released content for one legacy release, resolved the
 * same way the catalogue generator resolves it (schema entry to template blob)
 * so fixture bytes hash to the digests the classifier accepts.
 *
 * Memoized: each release costs one `git show` per catalogued asset, and the
 * scenarios reuse the same three releases many times over.
 */
const releaseFileCache = new Map<string, ReadonlyMap<string, string>>();

export function legacyReleaseFiles(version: string): ReadonlyMap<string, string> {
  const cached = releaseFileCache.get(version);
  if (cached !== undefined) return cached;
  const schema = git('show', `v${version}:packages/cli/src/schema.ts`);
  const files = new Map<string, string>();
  for (const match of schema.matchAll(
    /['"](\.claude\/[^'"]+)['"]\s*:\s*\{[^}]*?template:\s*['"]([^'"]+)['"]/gu,
  )) {
    const [, installedPath, templatePath] = match;
    if (installedPath === undefined || templatePath === undefined) continue;
    files.set(installedPath, git('show', `v${version}:packages/cli/templates/${templatePath}`));
  }
  if (files.size === 0) throw new Error(`Release v${version} exposes no Claude assets.`);
  releaseFileCache.set(version, files);
  return files;
}

/**
 * Reads a hook entry directly from a release tag. This is deliberately
 * independent of the generated ownership catalogue: acceptance tests need an
 * oracle that still fails when generation silently omits released settings.
 */
export function legacyReleaseHookEntry(version: string, event: string): unknown {
  const temporary = mkdtempSync(nodePath.join(tmpdir(), 'safeword-released-hooks-'));
  const modulePath = nodePath.join(temporary, 'config.ts');
  const probePath = nodePath.join(temporary, 'probe.ts');
  try {
    writeFileSync(modulePath, git('show', `v${version}:packages/cli/src/templates/config.ts`));
    writeFileSync(
      probePath,
      `import { SETTINGS_HOOKS } from './config.ts';\nprocess.stdout.write(JSON.stringify(SETTINGS_HOOKS[${JSON.stringify(event)}]?.[0]));\n`,
    );
    const serialized = execFileSync('bun', [probePath], { encoding: 'utf8' });
    if (!serialized.trim()) throw new Error(`Release v${version} has no ${event} hook.`);
    return JSON.parse(serialized) as unknown;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

/** An exact released settings hook entry, for planting accepted legacy hooks. */
export function acceptedHookEntry(version: string, event: string): unknown {
  const release = CLAUDE_HISTORICAL_CATALOGUE.releases[
    version as keyof typeof CLAUDE_HISTORICAL_CATALOGUE.releases
  ] as { hooks: Record<string, readonly string[]> } | undefined;
  const fingerprint = release?.hooks[event]?.[0];
  if (fingerprint === undefined) {
    throw new Error(`Release v${version} has no accepted ${event} hook.`);
  }
  return historicalHookEntry(fingerprint);
}

export interface LegacyProject {
  /** The project a Claude session would be running in. */
  readonly root: string;
  /** The plugin cache Claude would have installed, outside the project. */
  readonly plugin: string;
  /** Claude's per-plugin data directory, where execution proof lands. */
  readonly data: string;
  /** Claude's user-scope config directory. */
  readonly config: string;
  /** Every legacy asset written into the project, as project-relative paths. */
  readonly installed: readonly string[];
}

export interface LegacyProjectOptions {
  /** Release whose exact bytes to install; omit for a project with no legacy delivery. */
  readonly release?: string;
  /** Install only this many catalogued assets — keeps focused scenarios cheap. */
  readonly assetLimit?: number;
  /** Project-relative extra files to write verbatim. */
  readonly extraFiles?: Readonly<Record<string, string>>;
  /** Value for `.claude/settings.json`; written as formatted JSON. */
  readonly settings?: unknown;
  /** Raw `.claude/settings.json` text, for comment and whitespace fidelity. */
  readonly rawSettings?: string;
  /** Value for the user-scope `settings.json`. */
  readonly userSettings?: unknown;
}

/** Builds a temp project holding the exact bytes a legacy release installed. */
export function createLegacyProject(options: LegacyProjectOptions = {}): LegacyProject {
  const base = mkdtempSync(nodePath.join(tmpdir(), 'safeword-claude-migration-'));
  created.push(base);
  const root = nodePath.join(base, 'project');
  const plugin = nodePath.join(base, 'cache', 'safeword');
  const config = nodePath.join(base, 'config');
  // Claude nests per-plugin data under the config directory; the CLI resolves
  // execution proof from there, so a flat fixture would make the hook's proof
  // invisible to `safeword claude status`.
  const data = nodePath.join(config, 'plugins/data/safeword-safeword');
  for (const directory of [root, data, config]) mkdirSync(directory, { recursive: true });
  adoptFixtureEnvironment(config);
  cpSync(PLUGIN_ROOT, plugin, { recursive: true });

  const installed: string[] = [];
  if (options.release !== undefined) {
    const files = [...legacyReleaseFiles(options.release)];
    const selected = options.assetLimit === undefined ? files : files.slice(0, options.assetLimit);
    for (const [relative, content] of selected) {
      writeProjectFile(root, relative, content);
      installed.push(relative);
    }
  }
  for (const [relative, content] of Object.entries(options.extraFiles ?? {})) {
    writeProjectFile(root, relative, content);
  }
  if (options.rawSettings !== undefined) {
    writeProjectFile(root, '.claude/settings.json', options.rawSettings);
  } else if (options.settings !== undefined) {
    writeProjectFile(
      root,
      '.claude/settings.json',
      `${JSON.stringify(options.settings, undefined, 2)}\n`,
    );
  }
  if (options.userSettings !== undefined) {
    writeFileSync(
      nodePath.join(config, 'settings.json'),
      `${JSON.stringify(options.userSettings, undefined, 2)}\n`,
    );
  }
  return { root, plugin, data, config, installed };
}

export function writeProjectFile(root: string, relative: string, content: string): void {
  const target = nodePath.join(root, relative);
  mkdirSync(nodePath.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

export function readProjectFile(root: string, relative: string): string {
  return readFileSync(nodePath.join(root, relative), 'utf8');
}

export interface HookRun {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
  /** Advisory text Claude would surface to the user, or '' when silent. */
  readonly advisory: string;
}

/**
 * Runs the real generated plugin hook exactly as Claude runs it: the command
 * string comes out of the generated `hooks.json`, not out of this file, so a
 * broken wiring change fails the scenario instead of being papered over.
 */
export function runPluginHook(
  project: LegacyProject,
  options: {
    readonly event?: string;
    readonly sessionId?: string;
    readonly extraEnvironment?: Readonly<Record<string, string>>;
    readonly projectDirectory?: string;
    /**
     * Replaces the event-group body with this functional command. A hook whose
     * sibling exits non-zero is not otherwise reachable without breaking a real
     * safeword hook, and the dispatcher treats both paths identically.
     */
    readonly functionalCommand?: string;
  } = {},
): HookRun {
  const event = options.event ?? 'UserPromptSubmit';
  const manifest = JSON.parse(
    readFileSync(nodePath.join(project.plugin, 'hooks', 'hooks.json'), 'utf8'),
  ) as Record<string, Record<string, { hooks?: { command?: string }[] }[]>>;
  const generated = manifest.hooks?.[event]?.[0]?.hooks?.[0]?.command;
  if (generated === undefined) throw new Error(`Generated plugin has no ${event} hook command.`);
  const command =
    options.functionalCommand === undefined
      ? generated
      : generated.replace('--event-group', `-- ${options.functionalCommand}`);
  const result = spawnSync('bash', ['-lc', command], {
    cwd: project.root,
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: project.config,
      CLAUDE_PLUGIN_DATA: project.data,
      CLAUDE_PLUGIN_ROOT: project.plugin,
      CLAUDE_PROJECT_DIR: options.projectDirectory ?? project.root,
      ...options.extraEnvironment,
    },
    input: `${JSON.stringify({
      cwd: project.root,
      hook_event_name: event,
      prompt: 'prove the plugin and retire the old integration',
      session_id: options.sessionId ?? 'automatic-migration-session',
    })}\n`,
  });
  const stdout = result.stdout ?? '';
  return {
    status: result.status ?? 1,
    stdout,
    stderr: result.stderr ?? '',
    advisory: advisoryFrom(stdout),
  };
}

export interface CommandRun {
  readonly status: number;
  readonly output: string;
}

/**
 * A stand-in for the Claude host binary at the process boundary — the only
 * boundary a test may legitimately stub, because `claude plugin list` reports
 * what the real host installed and no fixture can install into it.
 *
 * It answers exactly the two commands `safeword claude status` issues, from a
 * declaration the scenario controls.
 */
export function installFakeClaudeHost(
  project: LegacyProject,
  installations: readonly Record<string, unknown>[],
): string {
  const binary = nodePath.join(project.config, 'bin');
  mkdirSync(binary, { recursive: true });
  const executable = nodePath.join(binary, 'claude');
  writeFileSync(
    executable,
    `#!/usr/bin/env node
const operation = process.argv.slice(2).join(' ');
if (operation === '--version') { console.log('2.4.0 (Claude Code)'); process.exit(0); }
if (operation === 'plugin list --json') {
  console.log(${JSON.stringify(JSON.stringify(installations))});
  process.exit(0);
}
if (operation === 'plugin marketplace list --json') { console.log('[]'); process.exit(0); }
console.error('unexpected claude command: ' + operation);
process.exit(64);
`,
  );
  chmodSync(executable, 0o755);
  return binary;
}

/** Runs the real `safeword claude <...>` CLI against a fixture project. */
export function runSafewordClaude(project: LegacyProject, ...args: string[]): CommandRun {
  const fakeBinary = nodePath.join(project.config, 'bin');
  const result = spawnSync(
    'bun',
    [
      nodePath.join(REPO_ROOT, 'packages/cli/src/cli.ts'),
      'claude',
      ...args,
      '--json',
      '--no-input',
      '--cwd',
      project.root,
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: project.config,
        CLAUDE_PLUGIN_ROOT: project.plugin,
        CLAUDE_PROJECT_DIR: project.root,
        PATH: `${fakeBinary}:${process.env.PATH ?? ''}`,
      },
    },
  );
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

/**
 * Runs a real release-contract script from `packages/cli`. The SWM1.R2
 * scenarios are about the contract itself, so they run the contract rather
 * than a reimplementation of it.
 */
export function runReleaseContract(
  script: string,
  extraEnvironment: Record<string, string> = {},
): CommandRun {
  const result = spawnSync('bun', ['run', script], {
    cwd: nodePath.join(REPO_ROOT, 'packages/cli'),
    encoding: 'utf8',
    env: { ...process.env, ...extraEnvironment },
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

/** Extracts the user-visible advisory from a hook response. */
export function advisoryFrom(stdout: string): string {
  const trimmed = stdout.trim();
  if (trimmed === '') return '';
  try {
    const parsed = JSON.parse(trimmed) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    return parsed.hookSpecificOutput?.additionalContext ?? '';
  } catch {
    return trimmed;
  }
}

/**
 * How many times `needle` occurs in `haystack`. "One plain-language advisory"
 * is a claim about non-duplication, so a scenario has to be able to count.
 */
export function occurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;
  return haystack.split(needle).length - 1;
}

export interface TreeSnapshot {
  readonly files: ReadonlyMap<string, string>;
}

/** Byte-level image of a tree, so "every byte unchanged" can actually be asserted. */
export function snapshotTree(root: string, skip: readonly string[] = []): TreeSnapshot {
  const files = new Map<string, string>();
  const visit = (directory: string, relative: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const child = nodePath.join(directory, entry.name);
      const childRelative = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (skip.some(prefix => childRelative.startsWith(prefix))) continue;
      if (entry.isDirectory()) {
        visit(child, childRelative);
        continue;
      }
      files.set(
        childRelative,
        entry.isSymbolicLink()
          ? `symlink:${nodePath.join(directory, entry.name)}`
          : createHash('sha256').update(readFileSync(child)).digest('hex'),
      );
    }
  };
  visit(root, '');
  return { files };
}

/** Paths whose bytes differ between two snapshots, in either direction. */
export function changedPaths(before: TreeSnapshot, after: TreeSnapshot): string[] {
  const paths = new Set([...before.files.keys(), ...after.files.keys()]);
  return [...paths]
    .filter(path => before.files.get(path) !== after.files.get(path))
    .toSorted((left, right) => left.localeCompare(right));
}

/**
 * Recomputes a plugin copy's inventory and identity digests so the package is
 * internally consistent again after a deliberate edit. Without this, every
 * damaged-plugin scenario stops at the tamper check and never reaches the
 * behaviour it means to test.
 */
export function resealPlugin(root: string): void {
  const inventoryPath = nodePath.join(root, 'inventory.json');
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
    assets: { path: string; sha256: string }[];
  };
  for (const asset of inventory.assets) {
    asset.sha256 = createHash('sha256')
      .update(readFileSync(nodePath.join(root, asset.path)))
      .digest('hex');
  }
  const serialized = `${JSON.stringify(inventory, undefined, 2)}\n`;
  writeFileSync(inventoryPath, serialized);
  const identityPath = nodePath.join(root, 'identity.json');
  const identity = JSON.parse(readFileSync(identityPath, 'utf8')) as Record<string, unknown>;
  identity.inventory_sha256 = createHash('sha256').update(serialized).digest('hex');
  writeFileSync(identityPath, `${JSON.stringify(identity, undefined, 2)}\n`);
}

/**
 * Plugin state lives under `${CLAUDE_PLUGIN_DATA}` rather than in the project
 * (#3787), so steps that drive the migration module in-process — rather than
 * through the hook's process boundary, where the fixture already sets these —
 * would otherwise read and write the developer's real `~/.claude`.
 *
 * Only `CLAUDE_CONFIG_DIR` is set: letting the module derive the data directory
 * from it is what proves the CLI reconstructs the same path the hook is handed
 * in `CLAUDE_PLUGIN_DATA`.
 */
const CLAUDE_FIXTURE_VARIABLES = [
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_PLUGIN_DATA',
  'CLAUDE_PROJECT_DIR',
] as const;
let hostEnvironment: Record<string, string | undefined> | undefined;

function adoptFixtureEnvironment(config: string): void {
  hostEnvironment ??= Object.fromEntries(
    CLAUDE_FIXTURE_VARIABLES.map(name => [name, process.env[name]]),
  );
  for (const name of CLAUDE_FIXTURE_VARIABLES) delete process.env[name];
  process.env.CLAUDE_CONFIG_DIR = config;
}

function restoreFixtureEnvironment(): void {
  if (hostEnvironment === undefined) return;
  for (const name of CLAUDE_FIXTURE_VARIABLES) {
    const value = hostEnvironment[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  hostEnvironment = undefined;
}

export function removeCreatedProjects(): void {
  for (const root of created) rmSync(root, { recursive: true, force: true });
  created.length = 0;
  restoreFixtureEnvironment();
}
