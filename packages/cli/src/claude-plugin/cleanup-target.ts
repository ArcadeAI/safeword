import { existsSync, lstatSync } from 'node:fs';
import nodePath from 'node:path';

export function containedClaudeCleanupPath(cwd: string, relative: string): string {
  if (relative === '' || nodePath.isAbsolute(relative) || relative.split(/[\\/]/u).includes('..')) {
    throw new Error(`Unsafe Claude cleanup target: ${relative}`);
  }
  const root = nodePath.resolve(cwd);
  const target = nodePath.resolve(root, relative);
  if (!target.startsWith(`${root}${nodePath.sep}`)) {
    throw new Error(`Unsafe Claude cleanup target: ${relative}`);
  }
  return target;
}

export function assertSafeClaudeCleanupTarget(cwd: string, relative: string): string {
  const target = containedClaudeCleanupPath(cwd, relative);
  let cursor = nodePath.resolve(cwd);
  for (const segment of relative.split(/[\\/]/u)) {
    cursor = nodePath.join(cursor, segment);
    if (!existsSync(cursor)) continue;
    const metadata = lstatSync(cursor);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Unsafe symlinked Claude cleanup target: ${relative}`);
    }
    if (cursor === target ? !metadata.isFile() : !metadata.isDirectory()) {
      throw new Error(`Unsafe non-file Claude cleanup target: ${relative}`);
    }
  }
  return target;
}
