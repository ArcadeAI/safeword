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
import { installCrashCapture } from '../lib/self-report.ts';

installCrashCapture('cursor-stop', undefined, 'cursor');

interface CursorInput {
  workspace_roots?: string[];
  conversation_id?: string;
  generation_id?: string;
  status?: string;
}

interface StopOutput {
  followup_message?: string;
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

  const followupMessage = [architectureNudge, QUALITY_REVIEW_MESSAGE].filter(Boolean).join('\n\n');
  const output: StopOutput = {
    followup_message: followupMessage,
  };
  console.log(JSON.stringify(output));
} else {
  console.log('{}');
}
