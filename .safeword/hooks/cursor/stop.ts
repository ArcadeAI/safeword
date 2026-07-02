#!/usr/bin/env bun
// Safeword: Cursor adapter for stop hook
// Checks for marker file from afterFileEdit to determine if files were modified
// Uses followup_message to inject quality review prompt into conversation.
// Suppresses phases where the next step is agent-owned execution, not a human
// review stop: ordinary implement work and verify entry.

import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';

import { architectureDocumentNudgeForProject } from '../lib/architecture-document-nudge.ts';
import { QUALITY_REVIEW_MESSAGE } from '../lib/quality.ts';
import { readSessionActiveTicket } from '../lib/quality-state.ts';
import { getRunStorageKey, resolveRunIdentity } from '../lib/run-identity.ts';
import { installCrashCapture, readSelfReportConfig } from '../lib/self-report.ts';
import {
  countToolUses,
  decideRetroAvailableNudge,
  resolveCursorSessionId,
} from '../lib/retro-trigger.ts';

installCrashCapture('cursor-stop', undefined, 'cursor');

interface CursorInput {
  workspace_roots?: string[];
  conversation_id?: string;
  generation_id?: string;
  status?: string;
  // Every Cursor hook (incl. stop) carries transcript_path to the conversation
  // transcript (official docs) — the earlier interface omitted it.
  transcript_path?: string;
}

interface StopOutput {
  followup_message?: string;
}

/**
 * Emit the retro nudge as a followup_message when this session is substantial and
 * not yet nudged, else `{}`. Only called on stops where the quality-review
 * followup is NOT firing, so retro never clobbers it and the once-per-session
 * sentinel is left untouched when quality-review wins the stop.
 */
function emitRetroOrEmpty(input: CursorInput): void {
  if (!readSelfReportConfig(process.cwd()).surface) {
    console.log('{}');
    return;
  }
  const reason = decideRetroAvailableNudge(
    { conversation_id: input.conversation_id, transcript_path: input.transcript_path },
    { env: process.env, countToolUses, resolveSessionId: resolveCursorSessionId },
  );
  const output: StopOutput = reason ? { followup_message: reason } : {};
  console.log(JSON.stringify(output));
}

function isAutomatedEvidenceRun(
  workspace: string,
  runIdentity: ReturnType<typeof resolveRunIdentity>,
): boolean {
  const phase = readSessionActiveTicket(workspace, runIdentity)?.phase;
  return phase === 'implement' || phase === 'verify';
}

function architectureNudgeForDonePhase(
  workspace: string,
  runIdentity: ReturnType<typeof resolveRunIdentity>,
): string | null {
  const ticketInfo = readSessionActiveTicket(workspace, runIdentity);
  if (!ticketInfo) return null;
  if (ticketInfo.status !== 'in_progress' || ticketInfo.phase !== 'done') return null;
  return architectureDocumentNudgeForProject(workspace);
}

// Read hook input from stdin
let input: CursorInput;
try {
  input = await Bun.stdin.json();
} catch {
  console.log('{}');
  process.exit(0);
}

const workspace = input.workspace_roots?.[0];

// Change to workspace directory
if (workspace) {
  process.chdir(workspace);
}

// Check for .safeword directory
if (!existsSync('.safeword')) {
  console.log('{}');
  process.exit(0);
}

// Check status - only proceed on completed (not aborted/error)
if (input.status !== 'completed') {
  console.log('{}');
  process.exit(0);
}

// Cursor enforces max 5 auto-submissions, no additional limit needed

// Check if any file edits occurred in this session by looking for marker file
const runIdentity = resolveRunIdentity(input, { runtime: 'cursor' });
const markerKey = getRunStorageKey(runIdentity) ?? 'cursor-default';
const markerFile = `/tmp/safeword-cursor-edited-${markerKey}`;

if (await Bun.file(markerFile).exists()) {
  // Clean up marker (best-effort; missing file or perm issue is non-fatal)
  await unlink(markerFile).catch(error => {
    if (process.env.DEBUG) console.error('[cursor/stop] marker cleanup failed:', error);
  });

  const architectureNudge = architectureNudgeForDonePhase(process.cwd(), runIdentity);
  if (isAutomatedEvidenceRun(process.cwd(), runIdentity) && architectureNudge === null) {
    console.log('{}');
    process.exit(0);
  }

  // Quality review (with the architecture-drift advisory when present) takes this
  // stop; retro yields and its sentinel is untouched, so retro can still fire on a
  // later non-review stop. Accepted trade-off: a session that edits on EVERY stop
  // never reaches the retro branch and is starved that session — the occurrence
  // ledger still dedupes across sessions and the next session's first no-edit stop
  // fires it. One followup_message per stop is a hard Cursor constraint, so retro
  // can't ride alongside this one.
  const followupMessage = [architectureNudge, QUALITY_REVIEW_MESSAGE].filter(Boolean).join('\n\n');
  const output: StopOutput = {
    followup_message: followupMessage,
  };
  console.log(JSON.stringify(output));
} else {
  // No edits this stop → quality review does not fire → retro may.
  emitRetroOrEmpty(input);
}
