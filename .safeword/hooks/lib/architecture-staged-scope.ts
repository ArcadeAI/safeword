// Safeword: scope the commit-time `architecture --stage` auto-fix to commits that
// actually move the architecture shape (#425). The shape fingerprint excludes
// versions and tracks module names, dependency *names*, boundary config, and
// schema files — so a routine commit (a version bump, a docs edit) must NOT get a
// regenerated architecture.generated.md injected into it. This gate mirrors those
// inputs and is biased toward NOT regenerating: a false skip only leaves the doc
// transiently stale (CI `architecture --check` catches it), whereas a false
// trigger reintroduces the leak.

import { execFileSync } from 'node:child_process';

/** package.json sections whose keys are dependency names (feed the fingerprint). */
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/** Basenames that always change the architecture shape when staged. */
const STRUCTURAL_BASENAMES = new Set([
  '.dependency-cruiser.cjs',
  '.dependency-cruiser.js',
  '.dependency-cruiser.mjs',
  '.dependency-cruiser.json',
  'pnpm-workspace.yaml',
  'go.work',
  'go.mod',
  'Cargo.toml',
]);

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // Outside a git repo, or git unavailable: nothing staged, never trigger.
    return '';
  }
}

export function stagedFiles(cwd: string): string[] {
  return runGit(cwd, ['diff', '--cached', '--name-only'])
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

function basename(file: string): string {
  const segments = file.split('/');
  return segments[segments.length - 1] ?? '';
}

function isStructuralPath(file: string): boolean {
  if (file.split('/').includes('src')) return true; // a module-structure change
  if (STRUCTURAL_BASENAMES.has(basename(file))) return true;
  return file.endsWith('.sql') || file.endsWith('.prisma');
}

function readManifest(cwd: string, ref: string, file: string): Record<string, unknown> {
  // ref '' → the staged (index) blob via `git show :file`.
  const raw = runGit(cwd, ['show', ref === '' ? `:${file}` : `${ref}:${file}`]);
  if (raw === '') return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function dependencyNames(manifest: Record<string, unknown>): string[] {
  const names = new Set<string>();
  for (const section of DEPENDENCY_SECTIONS) {
    const entry = manifest[section];
    if (entry !== null && typeof entry === 'object') {
      for (const name of Object.keys(entry)) names.add(name);
    }
  }
  return [...names].toSorted();
}

function workspacePatterns(manifest: Record<string, unknown>): string[] {
  const field = manifest.workspaces;
  const list = Array.isArray(field)
    ? field
    : field !== null &&
        typeof field === 'object' &&
        Array.isArray((field as { packages?: unknown }).packages)
      ? (field as { packages: unknown[] }).packages
      : [];
  return list.filter((item): item is string => typeof item === 'string').toSorted();
}

/** The architecture-relevant inputs a package.json contributes (NOT name/version). */
function manifestArchInputs(manifest: Record<string, unknown>): string {
  return JSON.stringify({
    deps: dependencyNames(manifest),
    workspaces: workspacePatterns(manifest),
  });
}

function packageJsonArchInputsChanged(cwd: string, file: string): boolean {
  return (
    manifestArchInputs(readManifest(cwd, 'HEAD', file)) !==
    manifestArchInputs(readManifest(cwd, '', file))
  );
}

/**
 * Whether the staged change affects the architecture shape. A `package.json` is
 * relevant only when its dependency names or workspace globs changed — a pure
 * version bump leaves the fingerprint untouched and so must not trigger a regen.
 */
export function stagedChangeAffectsArchitecture(cwd: string): boolean {
  for (const file of stagedFiles(cwd)) {
    if (isStructuralPath(file)) return true;
    if (basename(file) === 'package.json' && packageJsonArchInputsChanged(cwd, file)) {
      return true;
    }
  }
  return false;
}
