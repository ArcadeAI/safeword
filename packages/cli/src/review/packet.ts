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
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import type { ReviewKind, ReviewPacket } from './contract.js';

const MAX_FILE_COUNT = 64;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_PACKET_BYTES = 1024 * 1024;

export interface PreparedReviewPacket {
  readonly packet: ReviewPacket;
  readonly sourceRoot: string;
  readonly workspace: string;
  readonly sourceChanged: () => boolean;
  readonly snapshotChanged: () => boolean;
  readonly cleanup: () => void;
}

export class ReviewPacketError extends Error {
  readonly name = 'ReviewPacketError';
}

interface CapturedFile {
  readonly source: string;
  readonly snapshot: string;
  readonly sha256: string;
  readonly device: number;
  readonly inode: number;
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

function sourceFileChanged(file: CapturedFile): boolean {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(file.source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const current = fstatSync(descriptor);
    return (
      !current.isFile() ||
      current.dev !== file.device ||
      current.ino !== file.inode ||
      digest(readFileSync(descriptor)) !== file.sha256
    );
  } catch {
    return true;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

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
    if (!opened.isFile()) throw new Error(`Review target is not a regular file: ${target}`);
    if (opened.size > MAX_FILE_BYTES) {
      throw new Error(`Review target exceeds the ${MAX_FILE_BYTES}-byte limit: ${target}`);
    }
    if (opened.size > packetBytesRemaining) {
      throw new Error(`Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`);
    }
    const resolved = realpathSync(source);
    if (escapes(root, resolved)) throw new Error(`Review target escapes the project: ${target}`);
    const observed = lstatSync(resolved);
    if (opened.dev !== observed.dev || opened.ino !== observed.ino) {
      throw new Error(`Review target changed while it was being captured: ${target}`);
    }
    const bytes = readFileSync(descriptor);
    let content: string;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`Review target is not valid UTF-8 text: ${target}`);
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

function prepareReviewPacketUnsafe(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
  context: readonly string[] = [],
): PreparedReviewPacket {
  if (targets.length + context.length > MAX_FILE_COUNT) {
    throw new Error(`Review packet exceeds the ${MAX_FILE_COUNT}-file limit`);
  }
  const canonicalRoot = realpathSync(cwd);
  const workspace = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-'));
  const tracked: CapturedFile[] = [];
  const expectedSnapshotEntries = new Set<string>();
  let logicalFiles: { path: string; content: string }[];
  let contextFiles: { path: string; content: string }[];
  try {
    let packetBytes = 0;
    const captureFiles = (files: readonly string[]): { path: string; content: string }[] =>
      files.map(target => {
        const source = nodePath.resolve(canonicalRoot, target);
        const relative = nodePath.relative(canonicalRoot, source);
        if (escapes(canonicalRoot, source)) {
          throw new Error(`Review target escapes the project: ${target}`);
        }
        const stats = lstatSync(source);
        if (!stats.isFile()) {
          throw new Error(`Review target is not a regular file: ${target}`);
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
          throw new Error(`Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`);
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
        return { path: relative, content };
      });
    const seen = new Set<string>();
    const rejectDuplicate = (target: string): void => {
      const relative = nodePath.relative(canonicalRoot, nodePath.resolve(canonicalRoot, target));
      if (seen.has(relative)) {
        throw new Error(`Review packet contains a duplicate file: ${target}`);
      }
      seen.add(relative);
    };
    for (const target of targets) rejectDuplicate(target);
    for (const target of context) rejectDuplicate(target);
    logicalFiles = captureFiles(targets);
    contextFiles = captureFiles(context);
    requireScenarioTicketSpec(kind, contextFiles);
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
  };
  if (Buffer.byteLength(JSON.stringify(packet), 'utf8') > MAX_PACKET_BYTES) {
    rmSync(workspace, { recursive: true, force: true });
    throw new ReviewPacketError(`Review packet exceeds the ${MAX_PACKET_BYTES}-byte limit`);
  }
  return {
    packet,
    sourceRoot: canonicalRoot,
    workspace,
    sourceChanged: () => tracked.some(file => sourceFileChanged(file)),
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
): PreparedReviewPacket {
  try {
    return prepareReviewPacketUnsafe(cwd, kind, targets, context);
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
