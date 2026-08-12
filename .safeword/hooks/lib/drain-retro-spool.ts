#!/usr/bin/env bun
// Code-owned retro drain: removes only drafts with reader-visible acknowledgements.

import { existsSync, lstatSync, realpathSync } from 'node:fs';
import nodePath from 'node:path';

import {
  ackFilePath,
  drainAcknowledgedDrafts,
  readSpooledDrafts,
  verifyDraftBody,
} from './retro-draft-spool.ts';

const inputPath = process.argv[2];
if (inputPath === undefined) {
  console.error('Usage: drain-retro-spool.ts <retro-draft-spool.jsonl>');
  process.exit(1);
}

const spoolPath = nodePath.resolve(inputPath);
const draftsDirectory = nodePath.dirname(spoolPath);
const safewordDirectory = nodePath.dirname(draftsDirectory);
if (
  nodePath.basename(draftsDirectory) !== 'retro-drafts' ||
  nodePath.basename(safewordDirectory) !== '.safeword' ||
  !spoolPath.endsWith('.jsonl')
) {
  console.error('Refusing to drain a path outside .safeword/retro-drafts/*.jsonl');
  process.exit(1);
}

const projectDirectory = nodePath.dirname(safewordDirectory);
const sessionId = nodePath.basename(spoolPath, '.jsonl');
const ackPath = ackFilePath(projectDirectory, sessionId);
const protectedPaths = [safewordDirectory, draftsDirectory, spoolPath, ackPath];
if (protectedPaths.some(path => existsSync(path) && lstatSync(path).isSymbolicLink())) {
  console.error('Refusing a symlinked retro spool or acknowledgement path');
  process.exit(1);
}
if (
  existsSync(spoolPath) &&
  (!existsSync(draftsDirectory) ||
    nodePath.dirname(realpathSync(spoolPath)) !== realpathSync(draftsDirectory))
) {
  console.error('Refusing a retro spool outside its canonical drafts directory');
  process.exit(1);
}
if (process.argv[3] === '--validated-jsonl') {
  const drafts = readSpooledDrafts(projectDirectory, sessionId);
  if (drafts.some(draft => !verifyDraftBody(draft))) {
    console.error('Refusing tracker egress: one or more retro drafts failed body validation');
    process.exit(2);
  }
  for (const draft of drafts) process.stdout.write(`${JSON.stringify(draft)}\n`);
  process.exit(0);
}
drainAcknowledgedDrafts(projectDirectory, sessionId);
