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

function digest(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function fileDigest(path: string): string | undefined {
  try {
    return digest(readFileSync(path));
  } catch {
    return undefined;
  }
}

function readContainedText(
  root: string,
  source: string,
  target: string,
): {
  readonly bytes: Buffer;
  readonly content: string;
} {
  const descriptor = openSync(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile()) throw new Error(`Review target is not a regular file: ${target}`);
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
    return { bytes, content };
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

export function prepareReviewPacket(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
): PreparedReviewPacket {
  if (targets.length > MAX_FILE_COUNT) {
    throw new Error(`Review packet exceeds the ${MAX_FILE_COUNT}-file limit`);
  }
  const workspace = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-'));
  const canonicalRoot = realpathSync(cwd);
  const tracked: { source: string; snapshot: string; sha256: string }[] = [];
  const expectedSnapshotEntries = new Set<string>();
  let logicalFiles: { path: string; content: string }[];
  try {
    let packetBytes = 0;
    logicalFiles = targets.map(target => {
      const source = nodePath.resolve(cwd, target);
      const relative = nodePath.relative(cwd, source);
      if (escapes(cwd, source)) {
        throw new Error(`Review target escapes the project: ${target}`);
      }
      const stats = lstatSync(source);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw new Error(`Review target is not a regular file: ${target}`);
      }
      const { bytes, content } = readContainedText(canonicalRoot, source, target);
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
      tracked.push({ source, snapshot, sha256: digest(bytes) });
      return { path: relative, content };
    });
  } catch (error) {
    rmSync(workspace, { recursive: true, force: true });
    throw error;
  }
  const packet: ReviewPacket = {
    schema_version: 1,
    dispatch_id: randomUUID(),
    kind,
    logical_files: logicalFiles,
  };
  return {
    packet,
    sourceRoot: canonicalRoot,
    workspace,
    sourceChanged: () => tracked.some(file => fileDigest(file.source) !== file.sha256),
    snapshotChanged: () => {
      if (tracked.some(file => fileDigest(file.snapshot) !== file.sha256)) return true;
      const actualEntries = snapshotEntries(workspace);
      return (
        actualEntries.length !== expectedSnapshotEntries.size ||
        actualEntries.some(entry => !expectedSnapshotEntries.has(entry))
      );
    },
    cleanup: () => {
      rmSync(workspace, { recursive: true, force: true });
    },
  };
}
