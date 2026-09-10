/**
 * Before/after file observation used to report what a command actually
 * changed on disk. Shared by the codex, claude and retro handlers, which each
 * snapshot a path, run their mutation, and turn the difference into a
 * `files` effect.
 */

import { lstatSync, readFileSync, readlinkSync, type Stats } from 'node:fs';
import nodePath from 'node:path';

import type { CliResult } from './result.js';

export interface FileSnapshot {
  readonly kind: 'file' | 'symlink' | 'directory' | 'other';
  readonly mode: number;
  readonly bytes?: string;
}

function snapshotKind(stats: Stats): FileSnapshot['kind'] {
  if (stats.isFile()) return 'file';
  if (stats.isSymbolicLink()) return 'symlink';
  if (stats.isDirectory()) return 'directory';
  return 'other';
}

function snapshotBytes(path: string, stats: Stats): string | undefined {
  if (stats.isFile()) return readFileSync(path).toString('base64');
  if (stats.isSymbolicLink()) return Buffer.from(readlinkSync(path)).toString('base64');
  return undefined;
}

export function observeFile(path: string): FileSnapshot | undefined {
  try {
    const stats = lstatSync(path);
    const kind = snapshotKind(stats);
    const bytes = snapshotBytes(path, stats);
    return { kind, mode: stats.mode & 0o777, ...(bytes !== undefined && { bytes }) };
  } catch {
    return undefined;
  }
}

export function observedFileEffect(
  cwd: string,
  path: string,
  before: FileSnapshot | undefined,
): CliResult['effects']['files'] {
  const after = observeFile(path);
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const target = nodePath.relative(cwd, path).split(nodePath.sep).join('/');
  if (before === undefined) return [{ kind: 'create', target }];
  if (after === undefined) return [{ kind: 'delete', target }];
  return [{ kind: 'update', target }];
}
