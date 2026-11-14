import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import type { GitDiffRepresentation } from './contract.js';
import { parseGitProjectPrefix } from './git-prefix.js';
import { ReviewPacketError } from './packet-error.js';
import { decodeReviewText } from './text.js';

export const MAX_LOCKFILE_SOURCE_BYTES = 8 * 1024 * 1024;
const DEFAULT_REFS = [
  'refs/remotes/origin/HEAD',
  'refs/remotes/origin/main',
  'refs/remotes/origin/master',
  'refs/heads/main',
  'refs/heads/master',
] as const;
const GIT_METADATA_BYTES = 256 * 1024;

interface Baseline {
  readonly ref: string;
  readonly commit: string;
}
interface BaselineBlob {
  readonly path: string;
  readonly oid: string;
  readonly mode: '100644' | '100755';
  readonly bytes: number;
}
interface LockfileDiffRequest {
  readonly root: string;
  readonly relative: string;
  readonly bytes: Buffer;
  readonly executable: boolean;
  readonly environment: NodeJS.ProcessEnv;
  readonly maxFileBytes: number;
}
interface PreparedLockfileDiff {
  readonly file: {
    readonly path: string;
    readonly content: string;
    readonly representation: GitDiffRepresentation;
  };
  readonly baselineChanged: () => boolean;
}

const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

function unavailable(message: string): never {
  throw new ReviewPacketError(message, 'REVIEW_LOCKFILE_DIFF_UNAVAILABLE');
}

function tooLarge(subject: string, limit: number): never {
  throw new ReviewPacketError(
    `${subject} exceeds the ${limit}-byte review capture limit; refresh a stale default branch or narrow the change`,
    'REVIEW_TARGET_TOO_LARGE',
  );
}

function git(root: string, args: readonly string[], environment: NodeJS.ProcessEnv) {
  const result = spawnSync('git', [...args], {
    cwd: root,
    env: environment,
    encoding: 'buffer',
    timeout: 5000,
    maxBuffer: GIT_METADATA_BYTES,
  });
  if (result.error !== undefined || result.signal !== null) {
    unavailable('Git could not complete bounded lockfile review');
  }
  return result;
}

function metadata(root: string, args: readonly string[], environment: NodeJS.ProcessEnv): string {
  const result = git(root, args, environment);
  if (result.status !== 0) unavailable('Git could not read the lockfile baseline metadata');
  return decodeReviewText(result.stdout, 'lockfile Git metadata');
}

function resolveBaseline(root: string, environment: NodeJS.ProcessEnv): Baseline {
  for (const ref of DEFAULT_REFS) {
    const result = git(root, ['rev-parse', '--verify', '--quiet', ref], environment);
    if (result.status === 1) continue;
    if (result.status !== 0)
      unavailable('Git could not resolve the default branch for lockfile review');
    const commit = metadata(root, ['merge-base', 'HEAD', ref], environment).trim();
    if (!/^[a-f0-9]{40,64}$/u.test(commit))
      unavailable('Default branch has no lockfile review baseline');
    return { ref, commit };
  }
  return unavailable(
    'No default branch baseline for bounded lockfile review; fetch its history first',
  );
}

function baselineChanged(
  root: string,
  environment: NodeJS.ProcessEnv,
  original: Baseline,
): () => boolean {
  return () => {
    try {
      const current = resolveBaseline(root, environment);
      return current.ref !== original.ref || current.commit !== original.commit;
    } catch {
      return true;
    }
  };
}

function projectPrefix(request: LockfileDiffRequest): string {
  const prefixLine = metadata(request.root, ['rev-parse', '--show-prefix'], request.environment);
  const prefix = parseGitProjectPrefix(prefixLine);
  if (prefix === undefined) {
    unavailable('Invalid Git project prefix for lockfile review');
  }
  return prefix;
}

function parseBlob(entry: string, path: string): BaselineBlob {
  const tab = entry.indexOf('\t');
  const match = /^(100644|100755) blob ([a-f0-9]{40,64}) +(\d+)$/u.exec(entry.slice(0, tab));
  const mode = match?.[1];
  const oid = match?.[2];
  const bytes = Number(match?.[3]);
  if (
    (mode !== '100644' && mode !== '100755') ||
    oid === undefined ||
    !Number.isSafeInteger(bytes) ||
    bytes < 0 ||
    entry.slice(tab + 1) !== `${path}\0`
  ) {
    unavailable('No regular tracked baseline exists at this large lockfile path');
  }
  return { path, mode, oid, bytes };
}

function baselineBlob(request: LockfileDiffRequest, base: Baseline): BaselineBlob {
  const path = projectPrefix(request) + request.relative;
  const entry = metadata(
    request.root,
    ['ls-tree', '-l', '-z', '--full-tree', base.commit, '--', `:(literal)${path}`],
    request.environment,
  );
  const blob = parseBlob(entry, path);
  if (blob.bytes > MAX_LOCKFILE_SOURCE_BYTES)
    tooLarge('Lockfile baseline', MAX_LOCKFILE_SOURCE_BYTES);
  return blob;
}

function lockfileText(bytes: Buffer, target: string): string {
  const content = decodeReviewText(bytes, target);
  if (content.includes('\0')) {
    throw new ReviewPacketError(
      `Review target is binary rather than UTF-8 lockfile text: ${target}`,
      'REVIEW_TARGET_INVALID_TEXT',
    );
  }
  return content;
}

/** File-backed capture avoids treating an incomplete successful stdout pipe as a complete blob. */
function captureBlob(
  request: LockfileDiffRequest,
  blob: BaselineBlob,
  destination: string,
): Buffer {
  const descriptor = openSync(destination, 'wx', 0o600);
  try {
    const run = spawnSync('git', ['cat-file', 'blob', blob.oid], {
      cwd: request.root,
      env: request.environment,
      stdio: ['ignore', descriptor, 'pipe'],
      timeout: 5000,
      maxBuffer: GIT_METADATA_BYTES,
    });
    if (run.status !== 0 || run.error !== undefined || run.signal !== null) {
      unavailable('Git could not capture the complete lockfile baseline');
    }
  } finally {
    closeSync(descriptor);
  }
  if (statSync(destination).size !== blob.bytes)
    unavailable('Git returned an incomplete lockfile baseline');
  const bytes = readFileSync(destination);
  lockfileText(bytes, `${request.relative} baseline`);
  return bytes;
}

function setMode(path: string, executable: boolean): void {
  chmodSync(path, executable ? 0o755 : 0o644);
  if (Boolean(statSync(path).mode & 0o111) !== executable) {
    unavailable('This host cannot preserve the lockfile executable mode for review');
  }
}

function displayedPatch(raw: string, relative: string): string {
  const lines = raw.split('\n');
  if (lines[0] !== 'diff --git a/before/bun.lock b/after/bun.lock') {
    unavailable('Git returned unexpected lockfile diff paths');
  }
  const before = JSON.stringify(`a/${relative}`);
  const after = JSON.stringify(`b/${relative}`);
  lines[0] = `diff --git ${before} ${after}`;
  for (let index = 1; index < lines.length; index++) {
    const line = lines[index];
    if (line?.startsWith('@@ ')) break;
    if (line === '--- a/before/bun.lock') lines[index] = `--- ${before}`;
    else if (line === '+++ b/after/bun.lock') lines[index] = `+++ ${after}`;
  }
  return lines.join('\n');
}

function reconstruct(
  request: LockfileDiffRequest,
  directory: string,
  isolatedGit: string,
  beforeBytes: Buffer,
  file: PreparedLockfileDiff['file'],
): void {
  const replay = nodePath.join(directory, 'replay');
  const replayPath = nodePath.resolve(replay, request.relative);
  const relative = nodePath.relative(replay, replayPath);
  if (
    relative === '..' ||
    relative.startsWith(`..${nodePath.sep}`) ||
    nodePath.isAbsolute(relative)
  ) {
    unavailable('Lockfile reconstruction path escapes its private directory');
  }
  mkdirSync(nodePath.dirname(replayPath), { recursive: true });
  writeFileSync(replayPath, beforeBytes, { mode: 0o600 });
  setMode(replayPath, file.representation.base_mode === '100755');
  const patchPath = nodePath.join(directory, 'displayed.patch');
  writeFileSync(patchPath, file.content, { mode: 0o600 });
  const applied = git(
    replay,
    [
      `--git-dir=${isolatedGit}`,
      `--work-tree=${replay}`,
      '-c',
      'core.filemode=true',
      'apply',
      '-p1',
      '--whitespace=nowarn',
      patchPath,
    ],
    request.environment,
  );
  const observed = statSync(replayPath);
  if (
    applied.status !== 0 ||
    observed.size !== request.bytes.length ||
    digest(readFileSync(replayPath)) !== file.representation.source_sha256 ||
    Boolean(observed.mode & 0o111) !== request.executable
  ) {
    unavailable(
      'The displayed lockfile patch does not reconstruct the exact captured source bytes and mode',
    );
  }
}

function capturePatch(
  request: LockfileDiffRequest,
  directory: string,
  blob: BaselineBlob,
): { content: string; beforeBytes: Buffer; isolatedGit: string } {
  const before = nodePath.join(directory, 'before');
  const after = nodePath.join(directory, 'after');
  mkdirSync(before);
  mkdirSync(after);
  const beforePath = nodePath.join(before, 'bun.lock');
  const beforeBytes = captureBlob(request, blob, beforePath);
  setMode(beforePath, blob.mode === '100755');
  const afterPath = nodePath.join(after, 'bun.lock');
  writeFileSync(afterPath, request.bytes, { mode: 0o600 });
  setMode(afterPath, request.executable);
  const template = nodePath.join(directory, 'empty-template');
  const isolatedGit = nodePath.join(directory, 'bare');
  mkdirSync(template);
  const initialized = git(
    directory,
    ['init', '--bare', '-q', `--template=${template}`, isolatedGit],
    request.environment,
  );
  if (initialized.status !== 0) unavailable('Git could not isolate lockfile review configuration');
  const patch = nodePath.join(directory, 'raw.patch');
  const run = git(
    directory,
    [
      `--git-dir=${isolatedGit}`,
      '-c',
      'core.filemode=true',
      'diff',
      '--no-index',
      '--text',
      '--no-ext-diff',
      '--no-textconv',
      '--no-color',
      '--no-renames',
      '--diff-algorithm=myers',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      '--unified=20',
      `--output=${patch}`,
      '--',
      'before/bun.lock',
      'after/bun.lock',
    ],
    request.environment,
  );
  if (run.status !== 1) unavailable('No complete changed lockfile patch is available');
  if (statSync(patch).size > request.maxFileBytes) tooLarge('Lockfile patch', request.maxFileBytes);
  const raw = lockfileText(readFileSync(patch), request.relative);
  const content = displayedPatch(raw, request.relative);
  lockfileText(Buffer.from(content), request.relative);
  return { content, beforeBytes, isolatedGit };
}

/** Produce one original logical target only after exact displayed-patch reconstruction succeeds. */
export function prepareLockfileDiff(request: LockfileDiffRequest): PreparedLockfileDiff {
  if (request.bytes.length > MAX_LOCKFILE_SOURCE_BYTES)
    tooLarge('Lockfile source', MAX_LOCKFILE_SOURCE_BYTES);
  lockfileText(request.bytes, request.relative);
  const base = resolveBaseline(request.root, request.environment);
  const blob = baselineBlob(request, base);
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-lock-diff-'));
  try {
    const { content, beforeBytes, isolatedGit } = capturePatch(request, directory, blob);
    const representation: GitDiffRepresentation = {
      kind: 'git-diff',
      base_ref: base.ref,
      base_commit: base.commit,
      base_path: blob.path,
      base_blob: blob.oid,
      base_sha256: digest(beforeBytes),
      base_mode: blob.mode,
      source_sha256: digest(request.bytes),
      source_bytes: request.bytes.length,
      source_mode: request.executable ? '100755' : '100644',
    };
    const file = { path: request.relative, content, representation };
    if (Buffer.byteLength(JSON.stringify(file)) > request.maxFileBytes) {
      tooLarge('Lockfile representation', request.maxFileBytes);
    }
    reconstruct(request, directory, isolatedGit, beforeBytes, file);
    return { file, baselineChanged: baselineChanged(request.root, request.environment, base) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
