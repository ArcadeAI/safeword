import { spawnSync } from 'node:child_process';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  type Stats,
} from 'node:fs';
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
  const keys = new Set<string>();
  const keyPattern = /("(?:\\.|[^"\\])*")\s*:/gu;
  for (const match of content.matchAll(keyPattern)) {
    const token = match[1];
    // eslint-disable-next-line security/detect-possible-timing-attacks -- Capture existence is public parser state.
    if (token === undefined) continue;
    const key = JSON.parse(token) as string;
    if (keys.has(key)) return true;
    keys.add(key);
  }
  return false;
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

function validateGitPrivacy(cwd: string, path: string): PersonalExecutionPreference | undefined {
  const relativePath = nodePath.relative(cwd, path);
  const ignored = spawnSync('git', ['-C', cwd, 'check-ignore', '--quiet', '--', relativePath], {
    stdio: 'ignore',
  });
  const tracked = spawnSync('git', ['-C', cwd, 'ls-files', '--error-unmatch', '--', relativePath], {
    stdio: 'ignore',
  });
  if (ignored.status !== 0 || tracked.status === 0) {
    return { path, error: 'must be Git-ignored and untracked' };
  }
  return undefined;
}

function readPersonalFile(path: string): {
  readonly content?: string;
  readonly error?: PersonalExecutionPreference;
} {
  // O_NOFOLLOW is POSIX-only. lstat still rejects a static final-component
  // symlink on Windows; the documented same-user directory race is out of scope.
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const descriptor = openSync(path, constants.O_RDONLY | noFollow);
  try {
    const fileError = validatePersonalFile(fstatSync(descriptor), path);
    if (fileError !== undefined) return { error: fileError };
    return { content: readFileSync(descriptor, 'utf8') };
  } finally {
    closeSync(descriptor);
  }
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
    const privacyError = validateGitPrivacy(cwd, path);
    if (privacyError !== undefined) return privacyError;
    const opened = readPersonalFile(path);
    if (opened.error !== undefined) return opened.error;
    if (opened.content === undefined) return { path, error: 'cannot be read' };
    return parsePersonalPreference(opened.content, path);
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
