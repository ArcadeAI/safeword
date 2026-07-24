// Safeword: implement-phase-stop typecheck gate (ticket SW1SE5).
//
// Pure decision: given the project dir, files changed this session, and the
// current ticket phase, decide whether to spawn `tsc --noEmit` and which
// `tsconfig.json` files to use. Uses find-up from each changed TS file so
// monorepos with package-level tsconfigs (no root one) work.
//
// Find-up alone is proximity, not relevance — the nearest config may include a
// different tree entirely. Coverage is therefore checked separately, behind the
// `ConfigCoverageResolver` seam, by asking tsc which files a config resolves to.
//
// The actual tsc spawn + output capture lives separately (I/O); this module
// stays pure so the decision logic can be unit-tested without a temp project.

import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

/** Hard cap on a single tsc run so a pathological project can't hang the stop. */
const TYPECHECK_TIMEOUT_MS = 60_000;

/**
 * Total budget for typechecking across every config in one stop, divided among
 * them. A per-spawn cap alone turns N configs into N × the cap, and the Stop
 * hook declares no timeout of its own — so the harness default would kill the
 * whole hook rather than just the typecheck step.
 */
export const TYPECHECK_BUDGET_MS = 60_000;

/** Floor so a wide change still gives each config a usable slice. */
const MIN_CONFIG_TIMEOUT_MS = 5_000;

/**
 * `--showConfig` output runs ~52 bytes per file; the 1 MB spawnSync default
 * overflows near 19k files, which is exactly where the per-config cost is
 * worst. Overflow degrades to "unknown", so the filter would go inert on the
 * largest configs without this.
 */
const SHOW_CONFIG_MAX_BUFFER = 64 * 1024 * 1024;

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const DONE_PHASE = 'done';

export interface TypecheckConfigTarget {
  tsconfigPath: string;
  /** The changed files that selected this config via find-up. */
  selectingFiles: string[];
}

export type TypecheckTarget = { run: false } | { run: true; targets: TypecheckConfigTarget[] };

export interface TypecheckGateInput {
  /** Absolute project root (where to start find-up bounds). */
  projectDirectory: string;
  /** Files changed this session, relative to `projectDirectory`. */
  changedFiles: string[];
  /** Current ticket phase (`undefined` if no active ticket). The gate is
   *  suppressed at `done` — the done-phase evidence gate handles that path. */
  phase: string | undefined;
}

/**
 * A `node_modules` path is a dependency's code, never the developer's change.
 * A project whose `.gitignore` misses `node_modules` reports vendored files as
 * changed; find-up from one lands on that dependency's own `tsconfig.json`, and
 * typechecking that reports errors the developer does not own and cannot fix
 * (missing peer `@types`, unresolved `extends`).
 */
function isVendored(file: string): boolean {
  return file.split(/[/\\]/u).includes('node_modules');
}

/**
 * Decide whether the implement-phase stop should run `tsc --noEmit`.
 * Returns every distinct tsconfig the changed files resolve to — each paired
 * with the files that selected it — or { run: false } to skip entirely.
 *
 * Every config, not the first: returning on the first match meant a change
 * spanning two packages only ever typechecked one of them, and the other's
 * silence read as "clean".
 *
 * Each config carries its own selecting files because relevance is per-config.
 * Asking "does this config cover anything that changed anywhere" let a root
 * config ride in on a file that had already selected a nearer config, which is
 * how the original symptom (errors in an untouched tree) survived the fix.
 */
export function shouldRunTypecheck(input: TypecheckGateInput): TypecheckTarget {
  if (input.phase === DONE_PHASE) return { run: false };

  const tsFiles = input.changedFiles.filter(file => isTypeScriptFile(file) && !isVendored(file));
  if (tsFiles.length === 0) return { run: false };

  const targets = new Map<string, string[]>();
  for (const file of tsFiles) {
    const tsconfig = findTsconfigUp(input.projectDirectory, file);
    if (tsconfig === null) continue;
    const selecting = targets.get(tsconfig);
    if (selecting === undefined) targets.set(tsconfig, [file]);
    else selecting.push(file);
  }
  if (targets.size === 0) return { run: false };

  return {
    run: true,
    targets: [...targets].map(([tsconfigPath, selectingFiles]) => ({
      tsconfigPath,
      selectingFiles,
    })),
  };
}

function isTypeScriptFile(file: string): boolean {
  return TS_EXTENSIONS.has(nodePath.extname(file));
}

/**
 * Walk up from the changed file's directory toward `projectDirectory`, return the
 * first `tsconfig.json` found at or above. Bounded by `projectDirectory` (won't
 * escape). Null if no tsconfig exists within the project bounds.
 */
function findTsconfigUp(projectDirectory: string, relativeFile: string): string | null {
  const absoluteFile = nodePath.resolve(projectDirectory, relativeFile);
  const root = nodePath.resolve(projectDirectory);
  let directory = nodePath.dirname(absoluteFile);
  while (directory.startsWith(root)) {
    const candidate = nodePath.join(directory, 'tsconfig.json');
    if (existsSync(candidate)) return candidate;
    const parent = nodePath.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Runner + composition (the I/O half). Kept behind a `TypecheckRunner` seam so
// the gate-plus-surfacing logic is unit-testable without spawning real tsc.
// ---------------------------------------------------------------------------

export interface TypecheckRunResult {
  /** Was a `tsc` binary found? If not, the gate stays silent (can't check). */
  available: boolean;
  /** Did `tsc --noEmit` exit 0? */
  ok: boolean;
  /** Captured tsc output (errors) when `!ok`. */
  output: string;
}

export type TypecheckRunner = (
  projectDirectory: string,
  tsconfigPath: string,
  timeoutMs?: number,
) => TypecheckRunResult;

/** Locate a `tsc` binary by walking up from the tsconfig's dir to projectDirectory. */
function findTscBin(projectDirectory: string, tsconfigPath: string): string | null {
  const root = nodePath.resolve(projectDirectory);
  let directory = nodePath.dirname(nodePath.resolve(tsconfigPath));
  while (directory.startsWith(root)) {
    const candidate = nodePath.join(directory, 'node_modules', '.bin', 'tsc');
    if (existsSync(candidate)) return candidate;
    const parent = nodePath.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

/**
 * Does this tsconfig's resolved file set contain any of the changed files?
 * `undefined` when that cannot be determined.
 *
 * Proximity is not coverage: find-up returns the nearest config, which may
 * `include` a completely different tree. A change under `.safeword/hooks/`
 * resolves to the repo-root config whose include is `packages/*&#47;src/**`,
 * so typechecking it reported errors in ~30 untouched files while checking
 * none of the changed ones.
 */
export type ConfigCoverageResolver = (
  projectDirectory: string,
  tsconfigPath: string,
  changedFiles: string[],
) => boolean | undefined;

/**
 * Real resolver: ask tsc itself. `--showConfig` resolves `extends`, `include`,
 * `exclude`, and the default-extension rules as a real run would, so coverage
 * never depends on us reimplementing tsconfig glob semantics.
 *
 * Two shapes return `undefined` rather than an answer, and both degrade to
 * running the check:
 *
 * - Configs that resolve to no `files` key — `${configDir}` templates and bases
 *   pulled from `node_modules` (astro, `@tsconfig/*`, expo) emit absolute
 *   include specs instead. Such projects get no benefit from this filter.
 * - Changed files that no longer exist on disk. `--showConfig` lists what is
 *   there, so a deletion could never be "covered" — and deleting an exported
 *   module is exactly when its consumers break.
 */
export function resolveConfigCoverage(
  projectDirectory: string,
  tsconfigPath: string,
  changedFiles: string[],
): boolean | undefined {
  const tscBin = findTscBin(projectDirectory, tsconfigPath);
  if (tscBin === null) return undefined;

  // A deleted file can never appear in the resolved set; judging coverage on
  // what remains would turn a deletion into silence.
  const presentFiles = changedFiles.filter(file =>
    existsSync(nodePath.resolve(projectDirectory, file)),
  );
  if (presentFiles.length === 0) return undefined;

  const result = spawnSync(tscBin, ['--showConfig', '--project', tsconfigPath], {
    cwd: projectDirectory,
    encoding: 'utf8',
    timeout: TYPECHECK_TIMEOUT_MS,
    maxBuffer: SHOW_CONFIG_MAX_BUFFER,
  });
  if (result.error || result.status !== 0) return undefined;

  let files: unknown;
  try {
    files = (JSON.parse(result.stdout) as { files?: unknown }).files;
  } catch {
    return undefined;
  }
  if (!Array.isArray(files)) return undefined;

  // `--showConfig` emits paths relative to the tsconfig's own directory, which
  // is not necessarily the project root — resolve both sides before comparing.
  const configDirectory = nodePath.dirname(nodePath.resolve(tsconfigPath));
  const covered = new Set(
    files
      .filter((file): file is string => typeof file === 'string')
      .map(file => nodePath.resolve(configDirectory, file)),
  );
  return presentFiles.some(file => covered.has(nodePath.resolve(projectDirectory, file)));
}

/**
 * Incremental-cache path in the OS temp dir, keyed by the tsconfig's absolute
 * path. Keeps the `.tsbuildinfo` OUT of the user's repo (no stray artifact, no
 * gitignore management) while staying warm across stops within a session.
 */
function tsBuildInfoPath(tsconfigPath: string): string {
  const key = createHash('sha1').update(nodePath.resolve(tsconfigPath)).digest('hex').slice(0, 16);
  const cacheDirectory = nodePath.join(tmpdir(), 'safeword-typecheck');
  mkdirSync(cacheDirectory, { recursive: true });
  return nodePath.join(cacheDirectory, `${key}.tsbuildinfo`);
}

/** Real runner: incremental `tsc --noEmit` against the given tsconfig. */
export function runIncrementalTypecheck(
  projectDirectory: string,
  tsconfigPath: string,
  timeoutMs: number = TYPECHECK_TIMEOUT_MS,
): TypecheckRunResult {
  const tscBin = findTscBin(projectDirectory, tsconfigPath);
  if (tscBin === null) return { available: false, ok: false, output: '' };

  const result = spawnSync(
    tscBin,
    [
      '--noEmit',
      '--incremental',
      '--tsBuildInfoFile',
      tsBuildInfoPath(tsconfigPath),
      '--pretty',
      'false',
      '--project',
      tsconfigPath,
    ],
    { cwd: projectDirectory, encoding: 'utf8', timeout: timeoutMs },
  );

  // Timed out or failed to spawn → stay silent (can't trust partial output).
  if (result.error || result.status === null) return { available: false, ok: false, output: '' };

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return { available: true, ok: result.status === 0, output };
}

/**
 * Compose the gate + runner for an implement-phase stop. Returns advice text
 * (tsc errors) to surface, or `null` to stay silent — when the gate skips, no
 * tsc binary is found, or the types are clean. Never throws or blocks; the
 * caller surfaces the advice via the soft (non-blocking) stop path.
 */
export function evaluateImplementStopTypecheck(
  input: TypecheckGateInput,
  runner: TypecheckRunner = runIncrementalTypecheck,
  coversChangedFiles: ConfigCoverageResolver = resolveConfigCoverage,
): { advice: string | null } {
  const gate = shouldRunTypecheck(input);
  if (!gate.run) return { advice: null };

  const timeoutMs = Math.max(
    MIN_CONFIG_TIMEOUT_MS,
    Math.floor(TYPECHECK_BUDGET_MS / gate.targets.length),
  );

  const advice: string[] = [];
  for (const { tsconfigPath, selectingFiles } of gate.targets) {
    // Coverage is judged against this config's own selecting files, never the
    // whole changed set — otherwise a config runs on the strength of a file
    // that already had a nearer config of its own.
    //
    // Skip only on a definite "covers nothing you touched". Unknown coverage
    // degrades to the previous behaviour and still runs: this filter is the new
    // part, so when it cannot do its job it must not hide what tsc already found.
    if (coversChangedFiles(input.projectDirectory, tsconfigPath, selectingFiles) === false) {
      continue;
    }

    const result = runner(input.projectDirectory, tsconfigPath, timeoutMs);
    if (!result.available || result.ok) continue;
    // Only surface real type errors in code (`file(line,col): error TS…`). tsc can
    // also fail for config reasons (e.g. TS18003 "no inputs found") with no file
    // diagnostic — that's not a type error in the change, so stay silent.
    if (!hasFileLevelTypeError(result.output)) continue;
    advice.push(`${describeConfig(input.projectDirectory, tsconfigPath)}\n${result.output}`);
  }

  return { advice: advice.length > 0 ? advice.join('\n\n') : null };
}

/**
 * Label a config's diagnostics. Overlapping configs can report the same file
 * with different `module`/`lib`, so an unlabelled block leaves no way to tell
 * why the same line appears twice.
 */
function describeConfig(projectDirectory: string, tsconfigPath: string): string {
  const relative = nodePath.relative(nodePath.resolve(projectDirectory), tsconfigPath);
  return `[${relative === '' ? tsconfigPath : relative}]`;
}

/** True iff tsc output has a file-level diagnostic, not just a config-level error. */
function hasFileLevelTypeError(output: string): boolean {
  return /\(\d+,\d+\): error TS\d+/.test(output);
}

/**
 * Files changed since HEAD — modified-tracked + untracked (gitignore-respecting),
 * relative to projectDirectory. This is the "changed this session" signal for
 * the implement-stop typecheck. Empty list outside a git repo or on any git
 * error (degrades, never throws).
 */
export function changedFilesSinceHead(projectDirectory: string): string[] {
  const run = (command: string): string => {
    try {
      return execSync(command, {
        cwd: projectDirectory,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return '';
    }
  };
  const tracked = run('git diff --name-only HEAD');
  const untracked = run('git ls-files --others --exclude-standard');
  return [...tracked.split('\n'), ...untracked.split('\n')]
    .map(line => line.trim())
    .filter(line => line.length > 0);
}
