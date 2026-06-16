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
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { existsInTree, findInTree } from '../utils/fs.js';
import { detectPackageManager } from '../utils/install.js';

export type PlanKind = 'test' | 'build';
export type Language = 'javascript' | 'python' | 'go' | 'rust';

export interface PlanEntry {
  language: Language;
  /** Directory the command runs in (repo root for v1). */
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

const PYTHON_MANIFESTS = ['pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg', 'tox.ini'];

/**
 * Parse the `SAFEWORD_FAKE_TOOLS` test seam (same spirit as `SAFEWORD_SKIP_INSTALL`):
 * `all` → everything installed; `only:a,b` → allowlist; `none:a,b` → denylist.
 * Lets the BDD acceptance lane drive the real CLI deterministically without
 * depending on the host's actual toolchains.
 */
function fakeToolProbe(spec: string): (tool: string) => boolean {
  if (spec.startsWith('only:')) {
    const set = new Set(spec.slice(5).split(',').filter(Boolean));
    return tool => set.has(tool);
  }
  if (spec.startsWith('none:')) {
    const set = new Set(spec.slice(5).split(',').filter(Boolean));
    return tool => !set.has(tool);
  }
  return allToolsAvailable; // 'all' or empty
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

function resolveJs(root: string, kind: PlanKind, isAvailable: ToolProbe): PlanEntry | undefined {
  const scripts = readRootScripts(root);
  if (!scripts) return undefined;
  const pm = detectPackageManager(root);
  if (kind === 'build') {
    return scripts.build
      ? entry('javascript', root, `${pm} run build`, pm, isAvailable(pm))
      : undefined;
  }
  const script = pickTestScript(scripts);
  return script ? entry('javascript', root, `${pm} run ${script}`, pm, isAvailable(pm)) : undefined;
}

/** Prefer a gate-tuned `test:done` subset, else `test`; undefined when neither exists. */
function pickTestScript(scripts: Record<string, string>): string | undefined {
  if (scripts['test:done']) return 'test:done';
  if (scripts.test) return 'test';
  return undefined;
}

function pytestConfigured(root: string): boolean {
  if (existsInTree(root, 'pytest.ini')) return true;
  const dir = findInTree(root, 'pyproject.toml');
  if (dir === undefined) return false;
  try {
    return readFileSync(nodePath.join(dir, 'pyproject.toml'), 'utf8').includes(
      '[tool.pytest.ini_options]',
    );
  } catch {
    return false;
  }
}

/** Package-manager-aware pytest invocation; returns the command, runner, and the tool whose presence gates availability. */
function pytestInvocation(root: string, isAvailable: ToolProbe): { command: string; tool: string } {
  if (existsInTree(root, 'uv.lock') && isAvailable('uv'))
    return { command: 'uv run pytest', tool: 'uv' };
  if (existsInTree(root, 'poetry.lock') && isAvailable('poetry'))
    return { command: 'poetry run pytest', tool: 'poetry' };
  return { command: 'pytest', tool: 'pytest' };
}

function resolvePython(
  root: string,
  kind: PlanKind,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  if (kind === 'build') return undefined; // no standard Python build step
  if (!PYTHON_MANIFESTS.some(manifest => existsInTree(root, manifest))) return undefined;
  if (existsInTree(root, 'tox.ini')) return entry('python', root, 'tox', 'tox', isAvailable('tox'));
  if (pytestConfigured(root) || isAvailable('pytest')) {
    const { command, tool } = pytestInvocation(root, isAvailable);
    return entry('python', root, command, 'pytest', isAvailable(tool));
  }
  return entry('python', root, 'python -m unittest discover', 'unittest', isAvailable('python'));
}

function goCommand(root: string, kind: PlanKind): string {
  const verb = kind === 'build' ? 'build' : 'test';
  if (existsSync(nodePath.join(root, 'go.work'))) {
    return `go ${verb} $(go list -f '{{.Dir}}/...' -m | xargs)`;
  }
  return `go ${verb} ./...`;
}

function resolveGo(root: string, kind: PlanKind, isAvailable: ToolProbe): PlanEntry | undefined {
  if (!existsInTree(root, 'go.mod')) return undefined;
  return entry('go', root, goCommand(root, kind), 'go', isAvailable('go'));
}

function resolveRust(root: string, kind: PlanKind, isAvailable: ToolProbe): PlanEntry | undefined {
  if (!existsInTree(root, 'Cargo.toml')) return undefined;
  if (kind === 'build')
    return entry('rust', root, 'cargo build --workspace', 'cargo', isAvailable('cargo'));
  if (isAvailable('cargo-nextest'))
    return entry('rust', root, 'cargo nextest run --workspace', 'nextest', isAvailable('cargo'));
  return entry('rust', root, 'cargo test --workspace', 'cargo', isAvailable('cargo'));
}

/**
 * Resolve the test (or build) plan for a repo: one entry per detected language.
 * Languages whose toolchain is missing are still listed (`available:false`).
 */
export function resolveTestPlan(root: string, options: ResolveOptions = {}): PlanEntry[] {
  const kind = options.kind ?? 'test';
  const isAvailable = options.isToolAvailable ?? defaultIsToolAvailable;
  const resolvers = [resolveJs, resolvePython, resolveGo, resolveRust];
  return resolvers
    .map(resolve => resolve(root, kind, isAvailable))
    .filter((planEntry): planEntry is PlanEntry => planEntry !== undefined);
}
