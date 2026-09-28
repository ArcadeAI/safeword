import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import type { RedExecutionAttestation, ReviewKind, ReviewPacket } from './contract.js';
import { recordFinalizedScope } from './scope.js';

const MAX_FILE_COUNT = 64;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_PACKET_BYTES = 1024 * 1024;
const HIGH_CONFIDENCE_SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u,
  /\bsk-(?:proj-|ant-)[\w-]{16,}\b/u,
  /\bAIza[\w-]{35}\b/u,
] as const;

export interface PreparedReviewPacket {
  readonly packet: ReviewPacket;
  readonly excludedTargets: readonly string[];
  readonly sourceRoot: string;
  readonly workspace: string;
  readonly sourceChanged: () => boolean;
  readonly snapshotChanged: () => boolean;
  readonly cleanup: () => void;
}

export class ReviewPacketError extends Error {
  readonly name = 'ReviewPacketError';

  constructor(
    message: string,
    readonly code = 'REVIEW_PACKET_INVALID',
  ) {
    super(message);
  }
}

interface CapturedFile {
  readonly source: string;
  readonly snapshot: string;
  readonly sha256: string;
  readonly device: number;
  readonly inode: number;
}

interface OversizedFile {
  readonly source: string;
  readonly relative: string;
  readonly device: number;
  readonly inode: number;
  readonly size: number;
}

function gitEnvironment(alternateObjects?: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    ...(process.platform === 'win32' && { SystemRoot: process.env.SystemRoot }),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_ATTR_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    ...(alternateObjects !== undefined && { GIT_ALTERNATE_OBJECT_DIRECTORIES: alternateObjects }),
  };
}

function gitOutput(args: readonly string[], env: NodeJS.ProcessEnv): Buffer {
  const result = spawnSync('git', [...args], {
    env,
    encoding: 'buffer',
    timeout: 5000,
    maxBuffer: 256 * 1024,
  });
  if (result.status !== 0 || result.error !== undefined || !Buffer.isBuffer(result.stdout)) {
    throw new ReviewPacketError(
      'Git attributes could not be resolved for an oversized review target',
      'REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE',
    );
  }
  return result.stdout;
}

// The Git process and its exact binary response are one fail-closed trust boundary.
// eslint-disable-next-line complexity -- Each process and tuple check rejects unsafe classification.
function generatedTargets(root: string, files: readonly OversizedFile[]): Set<string> {
  if (files.length === 0) return new Set();
  try {
    const env = gitEnvironment();
    const commit = gitOutput(['-C', root, 'rev-parse', '--verify', 'HEAD^{commit}'], env)
      .toString('utf8')
      .trim();
    if (!/^[0-9a-f]{40,64}$/u.test(commit)) {
      throw new ReviewPacketError(
        'Git attributes could not be resolved for an oversized review target',
        'REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE',
      );
    }
    const objectsPath = gitOutput(['-C', root, 'rev-parse', '--git-path', 'objects'], env)
      .toString('utf8')
      .trim();
    const objects = realpathSync(nodePath.resolve(root, objectsPath));
    const bare = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-git-'));
    try {
      gitOutput(['init', '--bare', '-q', bare], env);
      const result = spawnSync(
        'git',
        [
          '--git-dir',
          bare,
          '-c',
          `core.attributesFile=${process.platform === 'win32' ? 'NUL' : '/dev/null'}`,
          'check-attr',
          `--source=${commit}`,
          '-z',
          '--stdin',
          'linguist-generated',
        ],
        {
          env: gitEnvironment(objects),
          input: Buffer.from(`${files.map(file => file.relative).join('\0')}\0`),
          encoding: 'buffer',
          timeout: 5000,
          maxBuffer: 256 * 1024,
        },
      );
      if (result.status !== 0 || result.error !== undefined || !Buffer.isBuffer(result.stdout)) {
        throw new ReviewPacketError(
          'Git attributes could not be resolved for an oversized review target',
          'REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE',
        );
      }
      const fields = new TextDecoder('utf-8', { fatal: true }).decode(result.stdout).split('\0');
      if (fields.pop() !== '' || fields.length !== files.length * 3) {
        throw new ReviewPacketError(
          'Git attributes returned an invalid response',
          'REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE',
        );
      }
      const marked = new Set<string>();
      for (const [index, file] of files.entries()) {
        const offset = index * 3;
        if (fields[offset] !== file.relative || fields[offset + 1] !== 'linguist-generated') {
          throw new ReviewPacketError(
            'Git attributes returned an invalid response',
            'REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE',
          );
        }
        if (fields[offset + 2] === 'true') marked.add(file.relative);
      }
      return marked;
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  } catch (error) {
    if (error instanceof ReviewPacketError) throw error;
    throw new ReviewPacketError(
      'Git attributes could not be resolved for an oversized review target',
      'REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE',
    );
  }
}

function oversizedChanged(root: string, file: OversizedFile): boolean {
  try {
    const observed = lstatSync(file.source);
    return (
      !observed.isFile() ||
      observed.dev !== file.device ||
      observed.ino !== file.inode ||
      observed.size !== file.size ||
      escapes(root, realpathSync(file.source))
    );
  } catch {
    return true;
  }
}

function requireScenarioTicketSpec(
  kind: ReviewKind,
  contextFiles: readonly { readonly path: string; readonly content: string }[],
): void {
  if (kind !== 'scenario-gate') return;
  const ticketSpec = contextFiles[0];
  if (
    ticketSpec === undefined ||
    nodePath.basename(ticketSpec.path) !== 'spec.md' ||
    ticketSpec.content.trim() === ''
  ) {
    throw new ReviewPacketError(
      'Scenario-gate review requires a non-blank spec.md as its first context file',
    );
  }
}

function requirePlanWorkArtifact(
  kind: ReviewKind,
  logicalFiles: readonly { readonly path: string; readonly content: string }[],
): void {
  if (kind !== 'plan-implementation') return;
  const plan = logicalFiles[0];
  if (
    logicalFiles.length !== 1 ||
    plan === undefined ||
    nodePath.basename(plan.path) !== 'impl-plan.md' ||
    plan.content.trim() === ''
  ) {
    throw new ReviewPacketError(
      'Plan-implementation review requires one non-blank impl-plan.md work file; pass supporting evidence with --context',
    );
  }
}

function requireExecutableRedAttestation(
  kind: ReviewKind,
  attestation: RedExecutionAttestation | undefined,
): void {
  if (kind === 'executable-red' && attestation === undefined) {
    throw new ReviewPacketError('Executable-red review requires a trusted execution attestation');
  }
  if (kind !== 'executable-red' && attestation !== undefined) {
    throw new ReviewPacketError(
      'Trusted execution attestations are accepted only for executable-red review',
    );
  }
}

interface ReviewPacketExecution {
  readonly attestation?: RedExecutionAttestation;
  /** Fingerprint preparation only: no review is dispatched from this packet. */
  readonly allowMissingExecutableRedAttestation?: boolean;
}

function checkedExecutionAttestation(
  kind: ReviewKind,
  execution: ReviewPacketExecution,
): RedExecutionAttestation | undefined {
  if (kind !== 'executable-red' || execution.allowMissingExecutableRedAttestation !== true) {
    requireExecutableRedAttestation(kind, execution.attestation);
  }
  return execution.attestation;
}

function digest(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function fileDigest(path: string): string | undefined {
  try {
    return digest(readFileSync(path));
  } catch {
    // Integrity checks fail closed: deletion and unreadability both mean the
    // source can no longer be proven equal to the captured packet.
    return undefined;
  }
}

function readBounded(descriptor: number, maxBytes: number): Buffer | undefined {
  const buffer = Buffer.allocUnsafe(maxBytes + 1);
  let length = 0;
  while (length < buffer.length) {
    // eslint-disable-next-line unicorn/no-null -- Node uses null for the descriptor's current position.
    const read = readSync(descriptor, buffer, length, buffer.length - length, null);
    if (read === 0) return buffer.subarray(0, length);
    length += read;
  }
  return undefined;
}

function sourceFileChanged(file: CapturedFile): boolean {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(file.source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const current = fstatSync(descriptor);
    if (!current.isFile() || current.dev !== file.device || current.ino !== file.inode) return true;
    const bytes = readBounded(descriptor, MAX_FILE_BYTES);
    return bytes === undefined || digest(bytes) !== file.sha256;
  } catch {
    return true;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

// eslint-disable-next-line complexity -- Each validation rejects a distinct unsafe capture state.
function readContainedText(
  root: string,
  source: string,
  target: string,
  packetBytesRemaining: number,
): {
  readonly bytes: Buffer;
  readonly content: string;
  readonly device: number;
  readonly inode: number;
} {
  const descriptor = openSync(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile()) {
      throw new ReviewPacketError(
        `Review target is not a regular file: ${target}`,
        'REVIEW_TARGET_NOT_REGULAR',
      );
    }
    if (opened.size > MAX_FILE_BYTES) {
      throw new Error(`Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${target}`);
    }
    if (opened.size > packetBytesRemaining) {
      throw new ReviewPacketError(
        `Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`,
        'REVIEW_PACKET_TOO_LARGE',
      );
    }
    const resolved = realpathSync(source);
    if (escapes(root, resolved)) {
      throw new ReviewPacketError(
        `Review target escapes the project: ${target}`,
        'REVIEW_TARGET_OUTSIDE_PROJECT',
      );
    }
    const observed = lstatSync(resolved);
    if (opened.dev !== observed.dev || opened.ino !== observed.ino) {
      throw new ReviewPacketError(
        `Review target changed while it was being captured: ${target}`,
        'REVIEW_TARGET_CHANGED',
      );
    }
    const bytes = readBounded(descriptor, MAX_FILE_BYTES);
    if (bytes?.byteLength !== opened.size) {
      throw new ReviewPacketError(
        `Review target changed while it was being captured: ${target}`,
        'REVIEW_TARGET_CHANGED',
      );
    }
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new ReviewPacketError(
        `Review target is not valid UTF-8 text: ${target}`,
        'REVIEW_TARGET_INVALID_TEXT',
      );
    }
    if (HIGH_CONFIDENCE_SECRET_PATTERNS.some(pattern => pattern.test(content))) {
      throw new Error(
        `Review packet rejected a high-confidence credential in ${target}; redact it before dispatch`,
      );
    }
    return { bytes, content, device: opened.dev, inode: opened.ino };
  } finally {
    closeSync(descriptor);
  }
}

function escapes(root: string, candidate: string): boolean {
  const relative = nodePath.relative(root, candidate);
  return (
    relative === '..' || relative.startsWith(`..${nodePath.sep}`) || nodePath.isAbsolute(relative)
  );
}

function snapshotEntries(root: string, directory = root): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = nodePath.join(directory, name);
    const relative = nodePath.relative(root, path);
    const stats = lstatSync(path);
    if (stats.isDirectory()) return [`directory:${relative}`, ...snapshotEntries(root, path)];
    if (stats.isFile()) return [`file:${relative}`];
    return [`other:${relative}`];
  });
}

// Keep validation, generated classification, and packet capture in one atomic preflight.
// eslint-disable-next-line complexity -- A partial packet must never escape this boundary.
function prepareReviewPacketUnsafe(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[] = [],
  execution: ReviewPacketExecution = {},
): PreparedReviewPacket {
  if (targets.length + context.length > MAX_FILE_COUNT) {
    throw new ReviewPacketError(
      `Review packet exceeds the ${MAX_FILE_COUNT}-file limit`,
      'REVIEW_PACKET_TOO_LARGE',
    );
  }
  const executionAttestation = checkedExecutionAttestation(kind, execution);
  const canonicalRoot = realpathSync(cwd);
  const workspace = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-'));
  const tracked: CapturedFile[] = [];
  const oversized: OversizedFile[] = [];
  const excludedTargets: string[] = [];
  const expectedSnapshotEntries = new Set<string>();
  let logicalFiles: { path: string; content: string }[];
  let contextFiles: { path: string; content: string }[];
  try {
    let packetBytes = 0;
    const captureFiles = (
      files: readonly string[],
      allowGenerated: boolean,
    ): { path: string; content: string }[] =>
      files.flatMap(target => {
        const source = nodePath.resolve(canonicalRoot, target);
        const relative = nodePath.relative(canonicalRoot, source);
        if (escapes(canonicalRoot, source)) {
          throw new ReviewPacketError(
            `Review target escapes the project: ${target}`,
            'REVIEW_TARGET_OUTSIDE_PROJECT',
          );
        }
        const stats = lstatSync(source);
        if (!stats.isFile()) {
          throw new ReviewPacketError(
            `Review target is not a regular file: ${target}`,
            'REVIEW_TARGET_NOT_REGULAR',
          );
        }
        if (escapes(canonicalRoot, realpathSync(source))) {
          throw new ReviewPacketError(
            `Review target escapes the project: ${target}`,
            'REVIEW_TARGET_OUTSIDE_PROJECT',
          );
        }
        if (stats.size > MAX_FILE_BYTES) {
          if (!allowGenerated) {
            throw new Error(`Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${target}`);
          }
          oversized.push({
            source,
            relative,
            device: stats.dev,
            inode: stats.ino,
            size: stats.size,
          });
          return [];
        }
        // A hard link inside the project is intentionally treated as a regular
        // in-project file; containment is path-based, and its bytes are copied.
        const { bytes, content, device, inode } = readContainedText(
          canonicalRoot,
          source,
          target,
          MAX_PACKET_BYTES - packetBytes,
        );
        const fileBytes = bytes.byteLength;
        if (fileBytes > MAX_FILE_BYTES) {
          throw new Error(`Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${target}`);
        }
        packetBytes += fileBytes;
        if (packetBytes > MAX_PACKET_BYTES) {
          throw new ReviewPacketError(
            `Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`,
            'REVIEW_PACKET_TOO_LARGE',
          );
        }
        const snapshot = nodePath.join(workspace, relative);
        mkdirSync(nodePath.dirname(snapshot), { recursive: true });
        writeFileSync(snapshot, bytes, { mode: 0o600 });
        let parent = nodePath.dirname(relative);
        while (parent !== '.') {
          expectedSnapshotEntries.add(`directory:${parent}`);
          parent = nodePath.dirname(parent);
        }
        expectedSnapshotEntries.add(`file:${relative}`);
        tracked.push({ source, snapshot, sha256: digest(bytes), device, inode });
        return [{ path: relative, content }];
      });
    const seen = new Set<string>();
    const rejectDuplicate = (target: string): void => {
      const relative = nodePath.relative(canonicalRoot, nodePath.resolve(canonicalRoot, target));
      if (seen.has(relative)) {
        throw new Error(`Review packet contains a duplicate file: ${target}`);
      }
      seen.add(relative);
    };
    const uniqueTargets: string[] = [];
    for (const target of targets) {
      const relative = nodePath.relative(canonicalRoot, nodePath.resolve(canonicalRoot, target));
      if (seen.has(relative)) continue;
      rejectDuplicate(target);
      uniqueTargets.push(target);
    }
    for (const target of context) rejectDuplicate(target);
    logicalFiles = captureFiles(uniqueTargets, true);
    contextFiles = captureFiles(context, false);
    const marked = generatedTargets(canonicalRoot, oversized);
    for (const file of oversized) {
      if (oversizedChanged(canonicalRoot, file)) {
        throw new ReviewPacketError(
          `Review target changed while it was being classified: ${file.relative}`,
          'REVIEW_TARGET_CHANGED',
        );
      }
      if (!marked.has(file.relative)) {
        throw new ReviewPacketError(
          `Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${file.relative}`,
          'REVIEW_TARGET_TOO_LARGE',
        );
      }
      excludedTargets.push(file.relative);
    }
    if (logicalFiles.length === 0) {
      throw new ReviewPacketError(
        'Review has no eligible targets after generated outputs are excluded',
        'REVIEW_NO_ELIGIBLE_TARGETS',
      );
    }
    requireScenarioTicketSpec(kind, contextFiles);
    requirePlanWorkArtifact(kind, logicalFiles);
  } catch (error) {
    rmSync(workspace, { recursive: true, force: true });
    throw error;
  }
  const packet: ReviewPacket = {
    schema_version: 1,
    dispatch_id: randomUUID(),
    kind,
    logical_files: logicalFiles,
    ...(contextFiles.length > 0 && { context_files: contextFiles }),
    ...(executionAttestation !== undefined && { execution_attestation: executionAttestation }),
  };
  if (Buffer.byteLength(JSON.stringify(packet), 'utf8') > MAX_PACKET_BYTES) {
    rmSync(workspace, { recursive: true, force: true });
    throw new ReviewPacketError(
      `Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`,
      'REVIEW_PACKET_TOO_LARGE',
    );
  }
  return {
    packet,
    excludedTargets,
    sourceRoot: canonicalRoot,
    workspace,
    sourceChanged: () =>
      tracked.some(file => sourceFileChanged(file)) ||
      oversized.some(file => oversizedChanged(canonicalRoot, file)),
    snapshotChanged: () => {
      if (tracked.some(file => fileDigest(file.snapshot) !== file.sha256)) return true;
      try {
        const actualEntries = snapshotEntries(workspace);
        return (
          actualEntries.length !== expectedSnapshotEntries.size ||
          actualEntries.some(entry => !expectedSnapshotEntries.has(entry))
        );
      } catch {
        return true;
      }
    },
    cleanup: () => {
      rmSync(workspace, { recursive: true, force: true });
    },
  };
}

export function prepareReviewPacket(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[] = [],
  execution: ReviewPacketExecution = {},
): PreparedReviewPacket {
  try {
    const prepared = prepareReviewPacketUnsafe(cwd, kind, targets, context, execution);
    recordFinalizedScope(prepared.excludedTargets);
    return prepared;
  } catch (error) {
    if (error instanceof ReviewPacketError) throw error;
    const message = error instanceof Error ? error.message : '';
    throw new ReviewPacketError(
      message.startsWith('Review ')
        ? message
        : 'Review packet could not be prepared. Check that every target and context path exists and is readable.',
    );
  }
}
