import { existsSync } from 'node:fs';
import nodePath from 'node:path';

export const ENROLLMENT_CHOICE_MESSAGE =
  'Safeword needs to set up this project before it can continue this workflow. Set it up now? You will review the exact files and changes before anything is applied.';

export type EnrollmentBoundaryDecision =
  { kind: 'not-needed' } | { kind: 'ready' } | { kind: 'choice-required'; message: string };

function relativeTarget(projectDirectory: string, target: string): string | undefined {
  const absolute = nodePath.isAbsolute(target)
    ? nodePath.normalize(target)
    : nodePath.resolve(projectDirectory, target);
  const relative = nodePath.relative(projectDirectory, absolute).replaceAll(nodePath.sep, '/');
  if (relative === '' || relative === '..' || relative.startsWith('../')) return undefined;
  return relative;
}

export function toolTargetsSafewordState(input: {
  projectDirectory: string;
  toolName?: string;
  filePath?: string;
  command?: string;
  isOwnedPath: (path: string) => boolean;
}): boolean {
  if (input.filePath) {
    const target = relativeTarget(input.projectDirectory, input.filePath);
    if (target !== undefined && input.isOwnedPath(target)) return true;
  }

  const command = input.command ?? '';
  if (
    /\bproject\s+(?:record-skill-invocation|runtime|review-knowledge|namespace-root)\b/u.test(
      command,
    )
  )
    return true;
  for (const line of command.split(/\r?\n/u)) {
    const match = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/u.exec(line.trim());
    if (!match?.[1]) continue;
    const target = relativeTarget(input.projectDirectory, match[1].trim());
    if (target !== undefined && input.isOwnedPath(target)) return true;
  }
  return false;
}

export function decideEnrollmentBoundary(input: {
  projectDirectory: string;
  needsSafewordState: boolean;
  markerExists?: (path: string) => boolean;
}): EnrollmentBoundaryDecision {
  if (!input.needsSafewordState) return { kind: 'not-needed' };
  const marker = nodePath.join(input.projectDirectory, '.safeword', 'SAFEWORD.md');
  if ((input.markerExists ?? existsSync)(marker)) return { kind: 'ready' };
  return { kind: 'choice-required', message: ENROLLMENT_CHOICE_MESSAGE };
}
