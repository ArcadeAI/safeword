// Safeword: implement-phase-stop typecheck gate (ticket SW1SE5).
//
// Pure decision: given the project dir, files changed this session, and the
// current ticket phase, decide whether to spawn `tsc --noEmit` and which
// `tsconfig.json` to use. Uses find-up from each changed TS file so monorepos
// with package-level tsconfigs (no root one) work.
//
// The actual tsc spawn + output capture lives separately (I/O); this module
// stays pure so the decision logic can be unit-tested without a temp project.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const DONE_PHASE = 'done';

export type TypecheckTarget = { run: false } | { run: true; tsconfigPath: string };

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
 * Decide whether the implement-phase stop should run `tsc --noEmit`.
 * Returns the tsconfig to use, or { run: false } to skip entirely.
 */
export function shouldRunTypecheck(input: TypecheckGateInput): TypecheckTarget {
  if (input.phase === DONE_PHASE) return { run: false };

  const tsFiles = input.changedFiles.filter(file => isTypeScriptFile(file));
  if (tsFiles.length === 0) return { run: false };

  for (const file of tsFiles) {
    const tsconfig = findTsconfigUp(input.projectDirectory, file);
    if (tsconfig !== null) return { run: true, tsconfigPath: tsconfig };
  }
  return { run: false };
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

/** Real runner: incremental `tsc --noEmit` against the given tsconfig. */
export function runIncrementalTypecheck(
  projectDirectory: string,
  tsconfigPath: string,
): TypecheckRunResult {
  const tscBin = findTscBin(projectDirectory, tsconfigPath);
  if (tscBin === null) return { available: false, ok: false, output: '' };

  const result = spawnSync(
    tscBin,
    ['--noEmit', '--incremental', '--pretty', 'false', '--project', tsconfigPath],
    { cwd: projectDirectory, encoding: 'utf8' },
  );
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
): { advice: string | null } {
  const gate = shouldRunTypecheck(input);
  if (!gate.run) return { advice: null };

  const result = runner(input.projectDirectory, gate.tsconfigPath);
  if (!result.available || result.ok) return { advice: null };
  return { advice: result.output };
}
