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

import { findFileMatchingInTree, indexFilesInTree } from '../utils/fs.js';
import { detectPackageManager } from '../utils/install.js';

export type PlanKind = 'test' | 'build' | 'verify' | 'typecheck' | 'deps' | 'bdd';
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
  // Standalone-BDD (behave) and opt-in typecheck (mypy/pyright) config markers —
  // the signals that gate the python `bdd`/`typecheck` lanes below.
  'behave.ini',
  '.behaverc',
  'mypy.ini',
  '.mypy.ini',
  'pyrightconfig.json',
  'go.mod',
  'Cargo.toml',
]);

/**
 * Kinds each non-Rust resolver opts out of, so a new PlanKind fails safe (the
 * language emits nothing) instead of falling through to a wrong command. `deps`
 * (supply-chain) is Rust-only for now. `typecheck` emits for JS/TS (`typecheck`
 * script), Python (mypy/pyright when configured), and Rust (clippy, in
 * resolveRust); Go's compiler covers it. `bdd` (Gherkin acceptance) emits for JS
 * (cucumber-js) and Python (behave); Go's godog and Rust's cucumber-rs fold into
 * the native test lane, so those skip it. Frozen sets mirror the manifest-set
 * idiom above and keep the guards uniform.
 */
const JS_SKIP_KINDS: ReadonlySet<PlanKind> = new Set<PlanKind>(['deps']);
const PYTHON_SKIP_KINDS: ReadonlySet<PlanKind> = new Set<PlanKind>(['build', 'deps']);
const GO_SKIP_KINDS: ReadonlySet<PlanKind> = new Set<PlanKind>(['typecheck', 'deps', 'bdd']);

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

/**
 * Kinds that map 1:1 to a project's own package.json script: `bdd` → the separate
 * cucumber-js `test:bdd` lane (`npm test` doesn't run it); `typecheck` → the
 * `tsc --noEmit` CI-lint signal a green test run can hide (#436); `build` → the
 * build script. Each emits only when the script exists.
 */
const JS_DIRECT_SCRIPT: Partial<Record<PlanKind, string>> = {
  bdd: 'test:bdd',
  typecheck: 'typecheck',
  build: 'build',
};

function resolveJs(
  root: string,
  _index: ManifestIndex,
  kind: PlanKind,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  if (JS_SKIP_KINDS.has(kind)) return undefined;
  // JS is detected root-only: subdirectory package.json is too common to treat as a project root.
  const scripts = readRootScripts(root);
  if (!scripts) return undefined;
  const pm = detectPackageManager(root);
  const directScript = JS_DIRECT_SCRIPT[kind];
  if (directScript !== undefined) {
    const command = scripts[directScript];
    return command
      ? entry('javascript', root, `${pm} run ${directScript}`, pm, isAvailable(pm))
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

/**
 * behave is the one Python Gherkin runner that does NOT fold into pytest — it has
 * its own `behave` command. pytest-bdd (the other option) is collected by pytest
 * and already runs in the test lane, so the `bdd` kind gates strictly on behave
 * config to avoid double-running its scenarios.
 *
 * `tox.ini [behave]` is deliberately NOT a signal: when a tox.ini exists, the
 * test/verify lane already runs `tox` (the umbrella runner, which typically drives
 * behave), so keying the bdd lane on it too would double-run the same scenarios.
 */
function behaveConfigured(index: ManifestIndex): boolean {
  if (index.has('behave.ini') || index.has('.behaverc')) return true;
  if (configContains(index, 'pyproject.toml', '[tool.behave]')) return true;
  return configContains(index, 'setup.cfg', '[behave]');
}

/** mypy config markers — the opt-in signal for the python `typecheck` lane. */
function mypyConfigured(index: ManifestIndex): boolean {
  if (index.has('mypy.ini') || index.has('.mypy.ini')) return true;
  if (configContains(index, 'pyproject.toml', '[tool.mypy]')) return true;
  return configContains(index, 'setup.cfg', '[mypy]');
}

/** pyright config markers — the fallback opt-in signal for the python `typecheck` lane. */
function pyrightConfigured(index: ManifestIndex): boolean {
  if (index.has('pyrightconfig.json')) return true;
  return configContains(index, 'pyproject.toml', '[tool.pyright]');
}

function isPythonTestFile(filename: string): boolean {
  return (
    filename.endsWith('.py') &&
    (filename.startsWith('test_') ||
      filename.endsWith('_test.py') ||
      filename.endsWith('_tests.py'))
  );
}

/**
 * Package-manager-aware invocation for a Python tool (pytest, behave, mypy, …).
 * Returns the command plus the binary whose presence gates `available`: the package
 * manager when the project is uv/poetry-locked, else the tool itself.
 */
function pythonInvocation(
  index: ManifestIndex,
  isAvailable: ToolProbe,
  binary: string,
  args = '',
): { command: string; gate: string } {
  const suffix = args ? ` ${args}` : '';
  if (index.has('uv.lock') && isAvailable('uv'))
    return { command: `uv run ${binary}${suffix}`, gate: 'uv' };
  if (index.has('poetry.lock') && isAvailable('poetry'))
    return { command: `poetry run ${binary}${suffix}`, gate: 'poetry' };
  return { command: `${binary}${suffix}`, gate: binary };
}

/**
 * Python static type-check lane. Opt-in only: Python is dynamically typed and tests
 * never check types, so this emits a command ONLY when the project configures mypy
 * or pyright — the same shape as the JS `typecheck` script gate (#436).
 */
function resolvePythonTypecheck(
  index: ManifestIndex,
  cwd: string,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  if (mypyConfigured(index)) {
    const { command, gate } = pythonInvocation(index, isAvailable, 'mypy', '.');
    return entry('python', cwd, command, 'mypy', isAvailable(gate));
  }
  if (pyrightConfigured(index)) {
    const { command, gate } = pythonInvocation(index, isAvailable, 'pyright');
    return entry('python', cwd, command, 'pyright', isAvailable(gate));
  }
  return undefined;
}

/** Python standalone-BDD lane — behave only (pytest-bdd already runs in the test lane). */
function resolvePythonBdd(
  index: ManifestIndex,
  cwd: string,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  if (!behaveConfigured(index)) return undefined;
  const { command, gate } = pythonInvocation(index, isAvailable, 'behave');
  return entry('python', cwd, command, 'behave', isAvailable(gate));
}

/** Python unit-test lane (kind: test | verify) — tox, then pytest, then unittest. */
function resolvePythonTest(
  index: ManifestIndex,
  cwd: string,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  if (index.has('tox.ini')) return entry('python', cwd, 'tox', 'tox', isAvailable('tox'));
  const hasPythonTests = findFileMatchingInTree(cwd, isPythonTestFile) !== undefined;
  if (pytestConfigured(index) || (hasPythonTests && isAvailable('pytest'))) {
    const { command, gate } = pythonInvocation(index, isAvailable, 'pytest');
    return entry('python', cwd, command, 'pytest', isAvailable(gate));
  }
  if (!hasPythonTests) return undefined;
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

function resolvePython(
  root: string,
  index: ManifestIndex,
  kind: PlanKind,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  if (PYTHON_SKIP_KINDS.has(kind)) return undefined; // build/deps: no standard Python lane
  // typecheck/bdd detect Python via their OWN config markers (mypy/pyright/behave
  // configs are Python-only), so they don't require a packaging manifest — a repo
  // carrying just `mypy.ini` or `behave.ini` still gets its lane, run in the dir the
  // config lives in. The test lane keeps the manifest gate so a non-Python directory
  // never yields a phantom pytest lane.
  if (kind === 'typecheck') {
    const cwd = firstDirectory(root, index, [
      'mypy.ini',
      '.mypy.ini',
      'pyrightconfig.json',
      'pyproject.toml',
      'setup.cfg',
    ]);
    return resolvePythonTypecheck(index, cwd, isAvailable);
  }
  if (kind === 'bdd') {
    const cwd = firstDirectory(root, index, [
      'behave.ini',
      '.behaverc',
      'pyproject.toml',
      'setup.cfg',
    ]);
    return resolvePythonBdd(index, cwd, isAvailable);
  }
  if (PYTHON_MANIFESTS.every(manifest => !index.has(manifest))) return undefined;
  return resolvePythonTest(index, firstDirectory(root, index, PYTHON_MANIFESTS), isAvailable);
}

function resolveGo(
  root: string,
  index: ManifestIndex,
  kind: PlanKind,
  isAvailable: ToolProbe,
): PlanEntry | undefined {
  // Go skips typecheck/deps/bdd (GO_SKIP_KINDS): the compiler is the type checker,
  // godog runs as `go test` subtests, and supply-chain is Rust-only for now.
  if (GO_SKIP_KINDS.has(kind)) return undefined;
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
  // bdd folds into the native Rust lane: cucumber-rs runs under `cargo test` (a
  // harness=false test target), so no separate lane. (typecheck IS handled below —
  // clippy is the strict CI-lint gate, #436 — and deps runs cargo-deny.)
  if (kind === 'bdd') return undefined;
  if (!index.has('Cargo.toml')) return undefined;
  const cwd = index.get('Cargo.toml') ?? root;
  if (kind === 'deps')
    // Supply-chain gate: `cargo deny check advisories` scans the RustSec DB (the
    // cargo-audit replacement) — the universal, ~zero-false-positive security
    // signal. Scoped to advisories on purpose: this runs at a BLOCKING done-gate
    // over the whole dep tree, so licenses/sources (policy checks that false-red
    // on missing license metadata or intentional git deps) stay configured in
    // deny.toml but opt-in, not a default that blocks unrelated changes.
    // Visible-but-unavailable when cargo-deny is absent (surfaces the install).
    return entry(
      'rust',
      cwd,
      'cargo deny check advisories',
      'cargo-deny',
      isAvailable('cargo-deny'),
    );
  if (kind === 'typecheck')
    // The typecheck kind is the strict CI-lint signal a green targeted-test run
    // can hide (#436). Clippy is a rustc driver — it wraps `cargo check`, so this
    // subsumes a plain compile check and adds lint enforcement. `--all-targets
    // --all-features` reaches test/bench targets and feature-gated code the
    // per-file `clippy -p <pkg> --fix` hook cannot see; `-D warnings` makes it a
    // gate. Reads the project's own Cargo.toml `[lints]` + clippy.toml.
    return entry(
      'rust',
      cwd,
      'cargo clippy --workspace --all-targets --all-features -- -D warnings',
      'clippy',
      isAvailable('cargo-clippy'),
    );
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
