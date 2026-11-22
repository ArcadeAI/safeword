import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { canonicalPathForGate } from './namespace-root.js';
import { isMetaPath } from './quality-state.js';

export interface SmallWorkThresholds {
  readonly files: number;
  readonly surfaces: number;
}

const defaults: SmallWorkThresholds = { files: 2, surfaces: 1 };
const fullGitObjectId = /^(?:[a-f\d]{40}|[a-f\d]{64})$/u;

function threshold(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  throw new Error('Small-work thresholds must be positive whole numbers.');
}

export function smallWorkThresholds(projectRoot: string): SmallWorkThresholds {
  let content: string;
  try {
    content = readFileSync(nodePath.join(projectRoot, '.safeword', 'config.json'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaults;
    throw error;
  }
  const config = JSON.parse(content) as { smallWorkThresholds?: unknown };
  const value = config.smallWorkThresholds;
  if (value === undefined) return defaults;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Small-work thresholds must name file and surface limits.');
  }
  const limits = value as Record<string, unknown>;
  return {
    files: threshold(limits.files, defaults.files),
    surfaces: threshold(limits.surfaces, defaults.surfaces),
  };
}

function inspectGitPaths(projectRoot: string, args: string[]): string[] {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 2000,
  })
    .split('\0')
    .filter(Boolean);
}

/** Count the observed footprint cumulatively from the recorded task base. */
export function smallWorkFileFootprint(
  projectRoot: string,
  base: string,
  proposed?: string,
): string[] {
  if (!fullGitObjectId.test(base)) throw new Error('Record the full task base commit.');
  const tracked = inspectGitPaths(projectRoot, [
    'diff',
    '--relative',
    '--no-renames',
    '--name-only',
    '-z',
    base,
    '--',
    '.',
  ]);
  const untracked = inspectGitPaths(projectRoot, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
  ]);
  const canonicalRoot = canonicalPathForGate(projectRoot);
  const proposedPath =
    proposed === undefined
      ? []
      : [
          nodePath
            .relative(canonicalRoot, canonicalPathForGate(proposed))
            .split(nodePath.sep)
            .join('/'),
        ];
  return [...new Set([...tracked, ...untracked, ...proposedPath])]
    .filter(path => !isMetaPath(nodePath.join(projectRoot, path), projectRoot))
    .sort();
}

export function smallWorkFootprintDenial(
  projectRoot: string,
  proposed: string,
  evaluation: unknown,
  thresholds: SmallWorkThresholds,
): string | undefined {
  if (evaluation === undefined) {
    return 'Record the task base and evaluated footprint before editing production code.';
  }
  if (typeof evaluation !== 'object' || evaluation === null) {
    return 'The recorded small-work evaluation is invalid. Reevaluate the current task.';
  }
  const record = evaluation as Record<string, unknown>;
  if (record.fileLimit !== thresholds.files || record.surfaceLimit !== thresholds.surfaces) {
    return 'The small-work thresholds changed. Reevaluate the task before editing production code.';
  }
  if (
    typeof record.base !== 'string' ||
    typeof record.aboveFileLimit !== 'boolean' ||
    typeof record.aboveSurfaceLimit !== 'boolean' ||
    !Array.isArray(record.declaredSurfaces) ||
    !Array.isArray(record.surfacePaths) ||
    !record.declaredSurfaces.every(surface => typeof surface === 'string' && surface.trim() !== '')
  ) {
    return 'The recorded small-work footprint is incomplete. Reevaluate the current task.';
  }
  const paths = smallWorkFileFootprint(projectRoot, record.base, proposed);
  const surfaces = new Set<string>(record.declaredSurfaces);
  for (const binding of record.surfacePaths as Array<{ path: string; surfaces: string[] }>) {
    if (
      typeof binding?.path !== 'string' ||
      !Array.isArray(binding.surfaces) ||
      !binding.surfaces.every(surface => typeof surface === 'string' && surface.trim() !== '')
    ) {
      return 'The recorded path-to-surface evidence is invalid. Reevaluate the current task.';
    }
    if (paths.includes(binding.path)) {
      for (const surface of binding.surfaces) surfaces.add(surface);
    }
  }
  if (
    paths.length > thresholds.files !== record.aboveFileLimit ||
    surfaces.size > thresholds.surfaces !== record.aboveSurfaceLimit
  ) {
    return 'The task crossed a configured file or surface threshold. Reevaluate its scope and route before editing production code.';
  }
  const mapped = new Set(record.surfacePaths.map((binding: { path: string }) => binding.path));
  if (paths.some(path => !mapped.has(path))) {
    return 'Identify the affected surfaces for the newly observed paths before editing production code.';
  }
  return undefined;
}
