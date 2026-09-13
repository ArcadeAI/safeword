#!/usr/bin/env bun
// Code-owned retro drain: removes only drafts with reader-visible acknowledgements.
//
// The guards below are the egress boundary, so they live in one exported
// function rather than being restated by each caller: the hook entrypoint here
// and `safeword project retro-drain`, which serves hosts with no project-local
// .safeword/hooks to shell out to. Same shape as run-review.ts — an exported
// function plus a thin `import.meta.main` that maps the result to exit codes.

import { existsSync, lstatSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import {
  ackFilePath,
  drainAcknowledgedDrafts,
  readSpooledDrafts,
  verifyDraftBody,
} from './retro-draft-spool.js';

export type DrainRetroSpoolResult =
  | { state: 'refused'; message: string }
  | { state: 'egress_refused'; message: string }
  | { state: 'validated'; drafts: unknown[] }
  | { state: 'drained' };

/** Drain, or validate for tracker egress, one spooled retro draft file. */
export function drainRetroSpool(
  inputPath: string,
  mode: 'drain' | 'validated-jsonl' = 'drain',
): DrainRetroSpoolResult {
  const spoolPath = nodePath.resolve(inputPath);
  const draftsDirectory = nodePath.dirname(spoolPath);
  const safewordDirectory = nodePath.dirname(draftsDirectory);
  if (
    nodePath.basename(draftsDirectory) !== 'retro-drafts' ||
    nodePath.basename(safewordDirectory) !== '.safeword' ||
    !spoolPath.endsWith('.jsonl')
  ) {
    return {
      state: 'refused',
      message: 'Refusing to drain a path outside .safeword/retro-drafts/*.jsonl',
    };
  }

  const projectDirectory = nodePath.dirname(safewordDirectory);
  const sessionId = nodePath.basename(spoolPath, '.jsonl');
  const ackPath = ackFilePath(projectDirectory, sessionId);
  const protectedPaths = [safewordDirectory, draftsDirectory, spoolPath, ackPath];
  if (protectedPaths.some(path => existsSync(path) && lstatSync(path).isSymbolicLink())) {
    return {
      state: 'refused',
      message: 'Refusing a symlinked retro spool or acknowledgement path',
    };
  }
  if (
    existsSync(spoolPath) &&
    (!existsSync(draftsDirectory) ||
      nodePath.dirname(realpathSync(spoolPath)) !== realpathSync(draftsDirectory))
  ) {
    return {
      state: 'refused',
      message: 'Refusing a retro spool outside its canonical drafts directory',
    };
  }

  if (mode === 'validated-jsonl') {
    const drafts = readSpooledDrafts(projectDirectory, sessionId);
    if (drafts.some(draft => !verifyDraftBody(draft))) {
      return {
        state: 'egress_refused',
        message: 'Refusing tracker egress: one or more retro drafts failed body validation',
      };
    }
    return { state: 'validated', drafts };
  }

  drainAcknowledgedDrafts(projectDirectory, sessionId);
  return { state: 'drained' };
}

if (import.meta.main) {
  const inputPath = process.argv[2];
  if (inputPath === undefined) {
    console.error('Usage: drain-retro-spool.ts <retro-draft-spool.jsonl>');
    process.exit(1);
  }
  const result = drainRetroSpool(
    inputPath,
    process.argv[3] === '--validated-jsonl' ? 'validated-jsonl' : 'drain',
  );
  if (result.state === 'refused') {
    console.error(result.message);
    process.exit(1);
  }
  if (result.state === 'egress_refused') {
    console.error(result.message);
    process.exit(2);
  }
  if (result.state === 'validated') {
    for (const draft of result.drafts) process.stdout.write(`${JSON.stringify(draft)}\n`);
    process.exit(0);
  }
}
