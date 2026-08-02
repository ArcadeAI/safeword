import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import type { ReviewKind, ReviewPacket } from './contract.js';

export interface PreparedReviewPacket {
  readonly packet: ReviewPacket;
  readonly workspace: string;
  readonly changed: () => boolean;
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

export function prepareReviewPacket(
  cwd: string,
  kind: ReviewKind,
  targets: readonly string[],
): PreparedReviewPacket {
  const workspace = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-'));
  const tracked: { source: string; snapshot: string; sha256: string }[] = [];
  let logicalFiles: { path: string; content: string }[];
  try {
    logicalFiles = targets.map(target => {
      const source = nodePath.resolve(cwd, target);
      const relative = nodePath.relative(cwd, source);
      if (relative.startsWith('..') || nodePath.isAbsolute(relative)) {
        throw new Error(`Review target escapes the project: ${target}`);
      }
      const stats = lstatSync(source);
      if (!stats.isFile() || stats.isSymbolicLink()) {
        throw new Error(`Review target is not a regular file: ${target}`);
      }
      const content = readFileSync(source, 'utf8');
      const snapshot = nodePath.join(workspace, relative);
      mkdirSync(nodePath.dirname(snapshot), { recursive: true });
      writeFileSync(snapshot, content, { mode: 0o600 });
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
    changed: () =>
      tracked.some(
        file =>
          fileDigest(file.source) !== file.sha256 || fileDigest(file.snapshot) !== file.sha256,
      ),
    cleanup: () => {
      rmSync(workspace, { recursive: true, force: true });
    },
  };
}
