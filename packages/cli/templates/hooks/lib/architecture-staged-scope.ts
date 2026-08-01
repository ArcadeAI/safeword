// Safeword: scope the commit-time `architecture --stage` auto-fix to commits that
// actually move the generated architecture state (#425). That state excludes
// versions and tracks module names, normalized package descriptions, dependency
// *names*, boundary config, and schema files — so a routine commit (a version
// bump, a docs edit) must NOT get a regenerated architecture.generated.md
// injected into it. This gate mirrors those inputs and is biased toward NOT
// regenerating: a false skip only leaves the doc transiently stale (CI
// `architecture --check` catches it), whereas a false trigger reintroduces the
// leak.

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

export interface ArchitectureScopeGitContext {
  gitDirectory?: string;
  indexPath?: string;
  worktreeRoot?: string;
}

function runGit(cwd: string, args: string[], context?: ArchitectureScopeGitContext): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...(context?.gitDirectory === undefined ? {} : { GIT_DIR: context.gitDirectory }),
        ...(context?.indexPath === undefined ? {} : { GIT_INDEX_FILE: context.indexPath }),
        ...(context?.worktreeRoot === undefined ? {} : { GIT_WORK_TREE: context.worktreeRoot }),
      },
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    // Outside a git repo, or git unavailable: nothing staged, never trigger.
    return '';
  }
}

export function stagedFiles(cwd: string, context?: ArchitectureScopeGitContext): string[] {
  return runGit(cwd, ['diff', '--cached', '--name-only'], context)
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

function readManifest(
  cwd: string,
  ref: string,
  file: string,
  context?: ArchitectureScopeGitContext,
): Record<string, unknown> {
  // ref '' → the staged (index) blob via `git show :file`.
  const raw = runGit(cwd, ['show', ref === '' ? `:${file}` : `${ref}:${file}`], context);
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

/** The raw workspace list — either a top-level array or the `{ packages: [...] }` shape. */
function workspaceList(field: unknown): unknown[] {
  if (Array.isArray(field)) return field;
  if (field !== null && typeof field === 'object') {
    const packages = (field as { packages?: unknown }).packages;
    if (Array.isArray(packages)) return packages;
  }
  return [];
}

function workspacePatterns(manifest: Record<string, unknown>): string[] {
  return workspaceList(manifest.workspaces)
    .filter((item): item is string => typeof item === 'string')
    .toSorted();
}

/** A usable package description, normalized exactly like the architecture purpose line. */
function packageDescription(manifest: Record<string, unknown>): string | undefined {
  const description = manifest.description;
  return typeof description === 'string' && description.trim().length > 0
    ? description.replaceAll(/\s+/g, ' ').trim()
    : undefined;
}

/** The architecture-relevant inputs a package.json contributes (NOT name/version). */
function manifestArchInputs(manifest: Record<string, unknown>): string {
  return JSON.stringify({
    description: packageDescription(manifest),
    deps: dependencyNames(manifest),
    workspaces: workspacePatterns(manifest),
  });
}

function packageJsonArchInputsChanged(
  cwd: string,
  file: string,
  context?: ArchitectureScopeGitContext,
): boolean {
  return (
    manifestArchInputs(readManifest(cwd, 'HEAD', file, context)) !==
    manifestArchInputs(readManifest(cwd, '', file, context))
  );
}

/**
 * Whether the staged change affects the architecture shape. A `package.json` is
 * relevant only when its normalized description, dependency names, or workspace
 * globs changed — a pure version bump leaves the generated document untouched
 * and so must not trigger a regen.
 */
export function stagedChangeAffectsArchitecture(
  cwd: string,
  context?: ArchitectureScopeGitContext,
): boolean {
  for (const file of stagedFiles(cwd, context)) {
    if (isStructuralPath(file)) return true;
    if (basename(file) === 'package.json' && packageJsonArchInputsChanged(cwd, file, context)) {
      return true;
    }
  }
  return false;
}
