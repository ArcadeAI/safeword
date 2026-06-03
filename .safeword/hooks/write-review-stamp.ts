#!/usr/bin/env bun
// Safeword: the review-stamp earning step (ticket NMSD94).
//
// Appends a `review:<scope>` line to the skill-invocation-log so the review
// gates in pre-tool-quality.ts read it back and allow the next step. Two callers:
//   - Tier 1 (per-asset): the `/review` skill's render-time injection runs this
//     to stamp the just-reviewed artifact at its CURRENT content.
//   - Tier 2 (phase exit): the working agent runs this AFTER a fork review
//     passes, to stamp the phase being exited.
//
// Scope is built with the SAME reviewScope()/hashArtifact() the gate uses (same
// hook lib, same runtime), so the stamp matches by construction — no
// cross-language hash contract to drift. Trust boundary: this writes a stamp on
// invocation, which is the cheap Tier 1 floor; Tier 2's real independence is the
// fork reviewer, not this script.
//
// Usage:
//   bun write-review-stamp.ts <artifact> [skip reason…]      # stamp <artifact>.md at current content
//   bun write-review-stamp.ts --phase <phase> [skip reason…] # stamp a phase exit

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { getActiveTicket } from './lib/active-ticket.ts';
import { formatReviewStamp, hashArtifact, reviewScope } from './lib/review-ledger.ts';

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const sessionId = process.env.CLAUDE_SESSION_ID ?? 'unknown-session';

function fail(message: string): never {
  process.stdout.write(`[skill-invocation-log] FAILED — ${message}\n`);
  process.exit(1);
}

// The active in_progress ticket's FOLDER name — the same key the gate derives
// from the edited path (nodePath.basename(ticketDirectory)), so scopes align.
const { folder } = getActiveTicket(projectDirectory);
if (folder === undefined) {
  fail('no in_progress ticket found — nothing to stamp');
}

const isPhase = process.argv[2] === '--phase';
const skipReason =
  process.argv
    .slice(isPhase ? 4 : 3)
    .join(' ')
    .trim() || undefined;

function resolveScope(ticketFolder: string): { scope: string; label: string } {
  if (isPhase) {
    const phase = process.argv[3];
    if (phase === undefined || phase === '') fail('--phase requires a phase name');
    return { scope: reviewScope(ticketFolder, 'phase', phase), label: `phase ${phase}` };
  }
  const artifact = process.argv[2] ?? 'spec';
  const artifactFile = nodePath.join(
    projectDirectory,
    '.safeword-project',
    'tickets',
    ticketFolder,
    `${artifact}.md`,
  );
  if (!existsSync(artifactFile)) fail(`artifact not found: ${artifact}.md in ${ticketFolder}`);
  const content = readFileSync(artifactFile, 'utf8');
  return {
    scope: reviewScope(ticketFolder, artifact, hashArtifact(content)),
    label: `${artifact}.md`,
  };
}

const { scope, label } = resolveScope(folder);

const logDirectory = nodePath.join(projectDirectory, '.safeword-project');
const logFile = nodePath.join(logDirectory, 'skill-invocations.log');
mkdirSync(logDirectory, { recursive: true });
appendFileSync(
  logFile,
  `${new Date().toISOString()} ${sessionId} ${formatReviewStamp(scope, skipReason)}\n`,
);

const kind = skipReason === undefined ? 'review' : `skip (${skipReason})`;
process.stdout.write(`[skill-invocation-log] ${kind} stamped for ${label} ✓\n`);
