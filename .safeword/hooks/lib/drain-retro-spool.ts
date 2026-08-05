#!/usr/bin/env bun
// Code-owned retro drain: removes only drafts with reader-visible acknowledgements.

import nodePath from 'node:path';

import { drainAcknowledgedDrafts } from './retro-draft-spool.ts';

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
drainAcknowledgedDrafts(projectDirectory, sessionId);
