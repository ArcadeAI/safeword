import { lstatSync, readFileSync, realpathSync, type Stats } from 'node:fs';
import nodePath from 'node:path';

import { resolveNamespaceRoot } from '../utils/configured-paths.js';
import type { ExecutionMode } from './mode.js';

export interface PersonalExecutionPreference {
  readonly path: string;
  readonly mode?: ExecutionMode;
  readonly error?: string;
}

function isExecutionMode(value: unknown): value is ExecutionMode {
  return value === 'local' || value === 'remote-preferred';
}

function hasDuplicateJsonKeys(content: string): boolean {
  return ['"schemaVersion"', '"testExecution"'].some(key => content.split(key).length > 2);
}

function personalPath(cwd: string): { namespaceRoot: string; path: string } {
  const namespaceRoot = resolveNamespaceRoot(cwd);
  return { namespaceRoot, path: nodePath.join(namespaceRoot, 'personal', 'config.json') };
}

function validatePersonalFile(
  metadata: Stats,
  path: string,
): PersonalExecutionPreference | undefined {
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    return { path, error: 'must be a regular, unlinked file' };
  }
  return undefined;
}

function validatePersonalDirectory(
  namespaceRoot: string,
  path: string,
): PersonalExecutionPreference | undefined {
  const rootRealPath = realpathSync(namespaceRoot);
  const personalDirectoryRealPath = realpathSync(nodePath.dirname(path));
  if (personalDirectoryRealPath !== nodePath.join(rootRealPath, 'personal')) {
    return { path, error: 'must remain inside the resolved namespace root' };
  }
  return undefined;
}

function parsePersonalPreference(content: string, path: string): PersonalExecutionPreference {
  if (hasDuplicateJsonKeys(content)) return { path, error: 'contains duplicate JSON keys' };
  const parsed: unknown = JSON.parse(content);
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    return { path, error: 'must be a JSON object' };
  }
  const record = parsed as Record<string, unknown>;
  if (
    Object.keys(record).length !== 2 ||
    !Object.hasOwn(record, 'schemaVersion') ||
    !Object.hasOwn(record, 'testExecution')
  ) {
    return { path, error: 'must contain only schemaVersion and testExecution' };
  }
  if (record.schemaVersion !== 1) return { path, error: 'uses an unsupported schema version' };
  if (!isExecutionMode(record.testExecution))
    return { path, error: 'uses an unsupported execution mode' };
  return { path, mode: record.testExecution };
}

/** Read a private worktree preference without following links or accepting shared files. */
export function readPersonalExecutionPreference(cwd: string): PersonalExecutionPreference {
  const { namespaceRoot, path } = personalPath(cwd);

  try {
    const metadata = lstatSync(path, { throwIfNoEntry: false });
    if (metadata === undefined) return { path };
    const fileError = validatePersonalFile(metadata, path);
    if (fileError !== undefined) return fileError;
    const directoryError = validatePersonalDirectory(namespaceRoot, path);
    if (directoryError !== undefined) return directoryError;
    return parsePersonalPreference(readFileSync(path, 'utf8'), path);
  } catch {
    return { path, error: 'cannot be read as personal test-execution configuration' };
  }
}

/** Read the optional shared default without allowing it to affect private-config safety. */
export function readProjectExecutionPreference(cwd: string): ExecutionMode | undefined {
  try {
    const config = JSON.parse(
      readFileSync(nodePath.join(cwd, '.safeword', 'config.json'), 'utf8'),
    ) as { testExecution?: unknown };
    return isExecutionMode(config.testExecution) ? config.testExecution : undefined;
  } catch {
    return undefined;
  }
}
