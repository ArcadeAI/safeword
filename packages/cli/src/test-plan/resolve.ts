/**
 * test-plan resolver (ticket BKTTZA).
 *
 * Given a repo root, emit the test/build command for EVERY language present —
 * polyglot, no first-match. Pure except for an injectable `isToolAvailable`
 * probe, so runner selection is unit-testable without real toolchains. Plan-only:
 * each entry carries the command it WOULD run; callers execute.
 *
 * Reaches the consumers (verify/audit/test-runner) via the `safeword test-plan`
 * CLI — shipped hooks cannot import safeword code, so the CLI is the seam.
 *
 * Manifest discovery is a single tree walk (`indexFilesInTree`) shared by every
 * language resolver, so a complex/deep monorepo costs one traversal, not one per
 * probe.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { indexFilesInTree } from '../utils/fs.js';
import { detectPackageManager } from '../utils/install.js';

export type PlanKind = 'test' | 'build' | 'verify' | 'typecheck';
export type Language = 'javascript' | 'python' | 'go' | 'rust';

export interface PlanEntry {
  language: Language;
  /** Directory the command runs in (the discovered manifest's directory). */
  cwd: string;
  /** The command string to run. Plan-only — never executed here. */
  command: string;
  /** The detected runner (e.g. pytest, tox, unittest, nextest, cargo, go, pnpm). */
  runner: string;
  /** Whether the runner's toolchain is installed. Unavailable entries are kept (visible), never dropped. */
  available: boolean;
}

export interface ResolveOptions {
  kind?: PlanKind;
  /** Injected for tests; defaults to a real `command -v` probe. */
  isToolAvailable?: (tool: string) => boolean;
}

type ToolProbe = (tool: string) => boolean;
/** filename → directory of its shallowest occurrence (from one tree walk). */
type ManifestIndex = ReadonlyMap<string, string>;

const PYTHON_MANIFESTS = ['pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg', 'tox.ini'];

/** Every manifest probed via the tree (root-only files like package.json/go.work are checked directly). */
const TREE_MANIFESTS = new Set<string>([
  ...PYTHON_MANIFESTS,
  'pytest.ini',
  '.pytest.ini',
  'uv.lock',
  'poetry.lock',
  'go.mod',
  'Cargo.toml',
]);

/**
 * Parse the `SAFEWORD_FAKE_TOOLS` test seam (same spirit as `SAFEWORD_SKIP_INSTALL`):
 * `all` → everything installed; `only:a,b` → allowlist; `none:a,b` → denylist.
 * Lets the BDD acceptance lane drive the real CLI deterministically without
 * depending on the host's actual toolchains.
 */
function fakeToolProbe(spec: string): (tool: string) => boolean {
  if (spec.startsWith('only:')) {
    const set = parseToolList(spec, 'only:');
    return tool => set.has(tool);
  }
  if (spec.startsWith('none:')) {
    const set = parseToolList(spec, 'none:');
    return tool => !set.has(tool);
  }
  return allToolsAvailable; // 'all' or empty
}

/** Parse the comma-separated tool list after a `only:` / `none:` prefix. */
function parseToolList(spec: string, prefix: string): Set<string> {
  return new Set(spec.slice(prefix.length).split(',').filter(Boolean));
}

function allToolsAvailable(): boolean {
  return true;
}

function defaultIsToolAvailable(tool: string): boolean {
  const fake = process.env.SAFEWORD_FAKE_TOOLS;
  if (fake !== undefined) return fakeToolProbe(fake)(tool);
  return spawnSync('command', ['-v', tool], { shell: true, stdio: 'ignore' }).status === 0;
}

function entry(
  language: Language,
  cwd: string,
  command: string,
  runner: string,
  available: boolean,
): PlanEntry {
  return { language, cwd, command, runner, available };
}

function readInstalledPacks(root: string): Set<string> | undefined {
  const configPath = nodePath.join(root, '.safeword', 'config.json');
  if (!existsSync(configPath)) return undefined;

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as { installedPacks?: unknown };
    if (!Array.isArray(parsed.installedPacks)) return undefined;
    return new Set(
      parsed.installedPacks.filter((pack): pack is string => typeof pack === 'string'),
    );
  } catch {
    return undefined;
  }
}

function isLanguageEnabled(language: Language, installedPacks: Set<string> | undefined): boolean {
  if (installedPacks === undefined) return true;

  if (language === 'javascript') {
    return installedPacks.has('typescript') || installedPacks.has('javascript');
  }
  if (language === 'go') {
    return installedPacks.has('golang') || installedPacks.has('go');
  }
  return installedPacks.has(language);
}

/** Directory of the first listed manifest present in the index, or root if none. */
function firstDirectory(root: string, index: ManifestIndex, names: readonly string[]): string {
  for (const name of names) {
    const dir = index.get(name);
    if (dir !== undefined) return dir;
  }
  return root;
}

/** Root package.json scripts, or undefined when absent/unparseable (so a malformed manifest never aborts the plan). */
function readRootScripts(root: string): Record<string, string> | undefined {
  try {
    const pkg = JSON.parse(readFileSync(nodePath.join(root, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    return pkg.scripts ?? {};
  } catch {
    return undefined;
  }
}

function resolveJs(
  root: string,
  _index: ManifestIndex,
  kind: PlanKind,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  // JS is detected root-only: subdirectory package.json is too common to treat as a project root.
  const scripts = readRootScripts(root);
  if (!scripts) return undefined;
  const pm = detectPackageManager(root);
  if (kind === 'typecheck') {
    // The same signal CI's lint job runs (#436): a targeted-test-only pass must
    // not read as ready when `tsc --noEmit` would fail. Honors an explicit
    // `typecheck` script (the project's own, possibly package-scoped command).
    return scripts.typecheck
      ? entry('javascript', root, `${pm} run typecheck`, pm, isAvailable(pm))
      : undefined;
  }
  if (kind === 'build') {
    return scripts.build
      ? entry('javascript', root, `${pm} run build`, pm, isAvailable(pm))
      : undefined;
  }
  const pickScript = kind === 'verify' ? pickVerifyScript : pickTestScript;
  const script = pickScript(scripts);
  return script ? entry('javascript', root, `${pm} run ${script}`, pm, isAvailable(pm)) : undefined;
}

/** Returns the first script name in `priority` that exists in `scripts`, or undefined. */
function firstScript(
  scripts: Record<string, string>,
  priority: readonly string[],
): string | undefined {
  return priority.find(name => Object.hasOwn(scripts, name));
}

/** Prefer a gate-tuned `test:done` subset, else `test`; undefined when neither exists. */
function pickTestScript(scripts: Record<string, string>): string | undefined {
  return firstScript(scripts, ['test:done', 'test']);
}

/** For done-gate verification: prefer the authoritative full suite over fast subsets. */
function pickVerifyScript(scripts: Record<string, string>): string | undefined {
  return firstScript(scripts, ['test:ci', 'test', 'test:done']);
}

/** True when an indexed `file` contains `marker`. */
function configContains(index: ManifestIndex, file: string, marker: string): boolean {
  const dir = index.get(file);
  if (dir === undefined) return false;
  try {
    return readFileSync(nodePath.join(dir, file), 'utf8').includes(marker);
  } catch {
    return false;
  }
}

function pytestConfigured(index: ManifestIndex): boolean {
  if (index.has('pytest.ini') || index.has('.pytest.ini')) return true;
  if (configContains(index, 'pyproject.toml', '[tool.pytest.ini_options]')) return true;
  return configContains(index, 'setup.cfg', '[tool:pytest]');
}

/** Package-manager-aware pytest invocation; returns the command and the tool whose presence gates availability. */
function pytestInvocation(
  index: ManifestIndex,
  isAvailable: ToolProbe,
): { command: string; tool: string } {
  if (index.has('uv.lock') && isAvailable('uv')) return { command: 'uv run pytest', tool: 'uv' };
  if (index.has('poetry.lock') && isAvailable('poetry'))
    return { command: 'poetry run pytest', tool: 'poetry' };
  return { command: 'pytest', tool: 'pytest' };
}

function resolvePython(
  root: string,
  index: ManifestIndex,
  kind: PlanKind,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  if (kind === 'build' || kind === 'typecheck') return undefined; // no standard Python build/typecheck step
  if (PYTHON_MANIFESTS.every(manifest => !index.has(manifest))) return undefined;
  const cwd = firstDirectory(root, index, PYTHON_MANIFESTS);
  if (index.has('tox.ini')) return entry('python', cwd, 'tox', 'tox', isAvailable('tox'));
  if (pytestConfigured(index) || isAvailable('pytest')) {
    const { command, tool } = pytestInvocation(index, isAvailable);
    return entry('python', cwd, command, 'pytest', isAvailable(tool));
  }
  // Prefer python3 (the only `python` on macOS/modern distros), fall back to python.
  const pythonBin = isAvailable('python3') ? 'python3' : 'python';
  return entry(
    'python',
    cwd,
    `${pythonBin} -m unittest discover`,
    'unittest',
    isAvailable(pythonBin),
  );
}

function resolveGo(
  root: string,
  index: ManifestIndex,
  kind: PlanKind,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  if (kind === 'typecheck') return undefined; // typecheck is a JS/TS concern; `go build` covers Go
  if (!index.has('go.mod')) return undefined;
  const verb = kind === 'build' ? 'build' : 'test';
  // A root go.work tests every workspace module — run the expansion from root.
  // Otherwise run `./...` in the module's own directory (supports nested modules).
  if (existsSync(nodePath.join(root, 'go.work'))) {
    const command = `go ${verb} $(go list -f '{{.Dir}}/...' -m | xargs)`;
    return entry('go', root, command, 'go', isAvailable('go'));
  }
  const cwd = index.get('go.mod') ?? root;
  return entry('go', cwd, `go ${verb} ./...`, 'go', isAvailable('go'));
}

function resolveRust(
  root: string,
  index: ManifestIndex,
  kind: PlanKind,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  if (kind === 'typecheck') return undefined; // typecheck is a JS/TS concern; `cargo build` covers Rust
  if (!index.has('Cargo.toml')) return undefined;
  const cwd = index.get('Cargo.toml') ?? root;
  if (kind === 'build')
    return entry('rust', cwd, 'cargo build --workspace', 'cargo', isAvailable('cargo'));
  if (isAvailable('cargo-nextest'))
    // nextest doesn't run doctests — append `cargo test --doc` so they aren't silently skipped.
    return entry(
      'rust',
      cwd,
      'cargo nextest run --workspace && cargo test --doc',
      'nextest',
      isAvailable('cargo'),
    );
  return entry('rust', cwd, 'cargo test --workspace', 'cargo', isAvailable('cargo'));
}

/**
 * Resolve the test (or build) plan for a repo: one entry per detected language.
 * Languages whose toolchain is missing are still listed (`available:false`).
 */
export function resolveTestPlan(root: string, options: ResolveOptions = {}): PlanEntry[] {
  const kind = options.kind ?? 'test';
  const isAvailable = options.isToolAvailable ?? defaultIsToolAvailable;
  const index = indexFilesInTree(root, TREE_MANIFESTS);
  const installedPacks = readInstalledPacks(root);
  const resolvers = [resolveJs, resolvePython, resolveGo, resolveRust];
  return resolvers
    .map(resolve => resolve(root, index, kind, isAvailable))
    .filter(
      (planEntry): planEntry is PlanEntry =>
        planEntry !== undefined && isLanguageEnabled(planEntry.language, installedPacks),
    );
}
