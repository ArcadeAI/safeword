#!/usr/bin/env bun
// Safeword: Cursor adapter for stop hook
// Checks for marker file from afterFileEdit to determine if files were modified
// Uses followup_message to inject quality review prompt into conversation.
// Suppresses phases where the next step is agent-owned execution, not a human
// review stop: ordinary implement work and verify entry.

import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import nodePath from 'node:path';

import { architectureDocumentNudgeForProject } from '../lib/architecture-document-nudge.ts';
import { cursorEditedMarkerPath } from '../lib/cursor-state.ts';
import {
  evaluateDecisionBriefCompliance,
  QUALITY_REVIEW_MESSAGE,
  renderDecisionBriefCorrection,
} from '../lib/quality.ts';
import { readSessionActiveTicket } from '../lib/quality-state.ts';
import { decideRetroFilingGate } from '../lib/retro-filing-gate.ts';
import {
  isStopQualityReviewEnabled,
  isTerminalHandoffCorrectionEnabled,
} from '../lib/review-ledger.ts';
import { resolveRunIdentity } from '../lib/run-identity.ts';
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
  loop_count?: number;
}

interface StopOutput {
  followup_message?: string;
}

function assistantText(record: unknown): string | undefined {
  if (!record || typeof record !== 'object') return undefined;
  const candidate = record as Record<string, unknown>;
  const message =
    candidate.message && typeof candidate.message === 'object'
      ? (candidate.message as Record<string, unknown>)
      : candidate;
  if (
    candidate.role !== 'assistant' &&
    message.role !== 'assistant' &&
    candidate.type !== 'assistant'
  ) {
    return undefined;
  }
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return undefined;
  return message.content
    .flatMap(item =>
      item && typeof item === 'object' && (item as { type?: unknown }).type === 'text'
        ? [String((item as { text?: unknown }).text ?? '')]
        : [],
    )
    .join('\n');
}

async function readLastAssistantMessage(transcriptPath?: string): Promise<string> {
  if (!transcriptPath) return '';
  const transcript = await Bun.file(transcriptPath).text();
  const lines = transcript.trim().split('\n');
  for (let index = lines.length - 1; index >= 0; index--) {
    try {
      const text = assistantText(JSON.parse(lines[index] ?? ''));
      if (text !== undefined) return text;
    } catch {
      // Skip unreadable records; malformed payloads fail open below.
    }
  }
  return '';
}

/**
 * Emit the retro FILING dispatch (#628/GH628F) or the retro-available nudge as a
 * followup_message, else `{}`. Only called on stops where the quality-review
 * followup is NOT firing, so retro never clobbers it and the once-per-session
 * sentinel is left untouched when quality-review wins the stop. Filing outranks
 * the retro-available nudge: draining already-extracted findings before the
 * ephemeral container dies beats starting a new extraction, and one
 * followup_message per stop is a hard Cursor constraint.
 */
function emitRetroOrEmpty(input: CursorInput): void {
  const config = readSelfReportConfig(process.cwd());
  // The gate reads selfReport config itself (GH644A): capture gates the
  // tripwire, file gates the dispatch — evaluate unconditionally.
  const sessionId = resolveCursorSessionId({ conversation_id: input.conversation_id }, process.env);
  const dispatch = sessionId ? decideRetroFilingGate(process.cwd(), sessionId) : undefined;
  if (dispatch) {
    console.log(JSON.stringify({ followup_message: dispatch } satisfies StopOutput));
    return;
  }
  if (!config.surface) {
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

// Cursor exposes a bounded resubmission count rather than stop_hook_active.
// Correct only the original completed response; the continuation may stop freely.
if ((input.loop_count ?? 0) === 0) {
  try {
    const rawConfig = await Bun.file(nodePath.join(process.cwd(), '.safeword', 'config.json'))
      .text()
      .catch(() => undefined);
    if (isTerminalHandoffCorrectionEnabled(rawConfig)) {
      const reply = await readLastAssistantMessage(input.transcript_path);
      const evaluation = evaluateDecisionBriefCompliance(reply);
      if (!evaluation.compliant) {
        console.log(
          JSON.stringify({
            followup_message: renderDecisionBriefCorrection(
              evaluation,
              'Keep verified evidence intact.',
            ),
          } satisfies StopOutput),
        );
        process.exit(0);
      }
    }
  } catch {
    // Unreadable transcript/config/evaluator state fails open to existing Stop behavior.
  }
}

// Cursor enforces max 5 auto-submissions, no additional limit needed

// Check if any file edits occurred in this session by looking for marker file
const runIdentity = resolveRunIdentity(input, { runtime: 'cursor' });
const markerFile = cursorEditedMarkerPath(input);

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

  // Parity with Claude's stop hook (KHL52X): the Stop-time quality review is off
  // unless `stopQualityReview: true`. The architecture-drift advisory is evidence,
  // not judgment, so it still takes the stop on its own when present.
  const cursorStopReviewOn = isStopQualityReviewEnabled(
    await Bun.file(nodePath.join(process.cwd(), '.safeword', 'config.json'))
      .text()
      .catch(() => undefined),
  );
  if (!cursorStopReviewOn && architectureNudge === null) {
    emitRetroOrEmpty(input);
    process.exit(0);
  }

  // Quality review (with the architecture-drift advisory when present) takes this
  // stop; retro yields and its sentinel is untouched, so retro can still fire on a
  // later non-review stop. Accepted trade-off: a session that edits on EVERY stop
  // never reaches the retro branch and is starved that session — the occurrence
  // ledger still dedupes across sessions and the next session's first no-edit stop
  // fires it. One followup_message per stop is a hard Cursor constraint, so retro
  // can't ride alongside this one.
  const followupMessage = [architectureNudge, cursorStopReviewOn ? QUALITY_REVIEW_MESSAGE : null]
    .filter(Boolean)
    .join('\n\n');
  const output: StopOutput = {
    followup_message: followupMessage,
  };
  console.log(JSON.stringify(output));
} else {
  // No edits this stop → quality review does not fire → retro may.
  emitRetroOrEmpty(input);
}
