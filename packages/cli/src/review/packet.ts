import { createHash, randomUUID } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import type { ReviewKind, ReviewPacket } from './contract.js';

export interface PreparedReviewPacket {
  readonly packet: ReviewPacket;
  readonly workspace: string;
  readonly sourceChanged: () => boolean;
  readonly snapshotChanged: () => boolean;
  readonly cleanup: () => void;
}

function digest(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function fileDigest(path: string): string | undefined {
  try {
    return digest(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
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
  const workspace = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-'));
  const canonicalRoot = realpathSync(cwd);
  const tracked: { source: string; snapshot: string; sha256: string }[] = [];
  const expectedSnapshotEntries = new Set<string>();
  let logicalFiles: { path: string; content: string }[];
  try {
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
      if (escapes(canonicalRoot, realpathSync(source))) {
        throw new Error(`Review target escapes the project: ${target}`);
      }
      const content = readFileSync(source, 'utf8');
      const snapshot = nodePath.join(workspace, relative);
      mkdirSync(nodePath.dirname(snapshot), { recursive: true });
      writeFileSync(snapshot, content, { mode: 0o600 });
      let parent = nodePath.dirname(relative);
      while (parent !== '.') {
        expectedSnapshotEntries.add(`directory:${parent}`);
        parent = nodePath.dirname(parent);
      }
      expectedSnapshotEntries.add(`file:${relative}`);
      tracked.push({ source, snapshot, sha256: digest(content) });
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
