#!/usr/bin/env bun
// Safeword: Auto Quality Review Stop Hook
// Triggers quality review when edit tools (Write/Edit/MultiEdit/NotebookEdit) are used
// Phase-aware: reads ticket phase for context-appropriate review questions

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { deriveTddStep, getActiveTicket, getTicketInfo } from './lib/active-ticket.ts';
import { findNextWork, updateTicketStatus } from './lib/hierarchy.ts';
import { getQualityMessage, type BddPhase } from './lib/quality.ts';
import { getStateFilePath, type QualityState, recordFailure } from './lib/quality-state.ts';
import { runTests } from './lib/test-runner.ts';

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string;
}

interface ContentItem {
  type: string;
  text?: string;
  name?: string; // tool_use: tool name
}

interface TranscriptMessage {
  type: string; // "assistant" | "user" | etc at top level
  message?: {
    role?: string;
    content?: ContentItem[];
  };
}

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
/** How many recent assistant messages to scan for edit tool usage. */
const MAX_MESSAGES_FOR_TOOLS = 5;

/** Evidence patterns for done-phase validation (matched against Claude's last message text). */
const TEST_EVIDENCE_PATTERN = /\d+\/\d+\s*tests?\s*pass/i; // "156/156 tests pass" or "✓ 156/156 tests pass"
const AUDIT_EVIDENCE_PATTERN = /audit\s+passed/i; // "Audit passed" or "Audit passed with warnings"
const USAGE_LIMIT_PATTERN = /\b(usage limit reached|5-hour limit reached)\b/i;
/** LOC threshold for implement-phase quality review frequency reduction. */
const LOC_REVIEW_THRESHOLD = 50;

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDir = `${projectDir}/.safeword`;
const ticketsDir = `${projectDir}/.safeword-project/tickets`;

interface TicketInfo {
  phase: BddPhase | undefined;
  type: string | undefined;
  folder: string | undefined;
}

/**
 * Resolve the active ticket for this session.
 * Uses session state binding first (session-scoped), falls back to global scan
 * (needed for hierarchy navigation after done gate passes).
 */
function getCurrentTicketInfo(sessionId?: string): TicketInfo {
  const empty: TicketInfo = { phase: undefined, type: undefined, folder: undefined };

  // Try session-scoped resolution first
  if (sessionId) {
    const stateFile = getStateFilePath(projectDir, sessionId);
    if (!existsSync(stateFile)) return fallbackGlobalScan();

    let state: QualityState;
    try {
      state = JSON.parse(readFileSync(stateFile, 'utf8'));
    } catch {
      return fallbackGlobalScan();
    }

    if (!state.activeTicket) return empty;

    const ticket = getTicketInfo(projectDir, state.activeTicket);
    if (ticket.status !== 'in_progress') return empty;

    return {
      phase: ticket.phase as BddPhase | undefined,
      type: ticket.type,
      folder: ticket.folder,
    };
  }

  return fallbackGlobalScan();
}

/** Read session state file once. Returns null if unavailable. */
function readSessionState(sessionId?: string): QualityState | null {
  if (!sessionId) return null;
  const stateFile = getStateFilePath(projectDir, sessionId);
  if (!existsSync(stateFile)) return null;
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

/** Update locAtLastReview in session state after a quality review fires. */
function updateLocAtLastReview(sessionId?: string): void {
  if (!sessionId) return;
  const stateFile = getStateFilePath(projectDir, sessionId);
  if (!existsSync(stateFile)) return;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    state.locAtLastReview = state.locSinceCommit ?? 0;
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch {
    // Best effort — don't crash stop hook on state write failure
  }
}

/** Global scan fallback — used when no session state exists */
function fallbackGlobalScan(): TicketInfo {
  const info = getActiveTicket(projectDir);
  return {
    phase: info.phase as BddPhase | undefined,
    type: info.type,
    folder: info.folder,
  };
}

/**
 * Check if all scenarios in test-definitions.md are complete.
 * Counts GFM task list checkboxes (- [x] / - [ ]). Headings (## Rule:)
 * are organizational only — the hook counts checkboxes, not headers.
 * Returns true if all checkboxes are checked, false otherwise.
 */
function checkScenariosComplete(ticketInfo: TicketInfo): boolean {
  if (!ticketInfo.folder) return false;
  const testDefsPath = `${ticketsDir}/${ticketInfo.folder}/test-definitions.md`;
  if (!existsSync(testDefsPath)) return false;

  const content = readFileSync(testDefsPath, 'utf8');
  const checked = (content.match(/^\s*- \[x\]/gim) ?? []).length;
  const unchecked = (content.match(/^\s*- \[ \]/gim) ?? []).length;
  const total = checked + unchecked;

  if (total === 0 && content.length > 50) {
    hardBlockDone(
      'test-definitions.md has content but no GFM checkboxes (- [ ] / - [x]). Unrecognized scenario format — convert to GFM task list items.',
    );
  }

  return total > 0 && unchecked === 0;
}

/**
 * Check cumulative artifact requirements for features.
 * Features at scenario-gate+ phases require test-definitions.md with at least one scenario.
 * Uses hardBlockDone — no stop_hook_active bypass. A feature with no scenarios is broken.
 */
function checkCumulativeArtifacts(ticketInfo: TicketInfo): void {
  // Only enforce for features
  if (ticketInfo.type !== 'feature') return;
  if (!ticketInfo.folder || !ticketInfo.phase) return;

  // Phases that require test-definitions.md
  const phasesRequiringTestDefs = ['scenario-gate', 'decomposition', 'implement', 'done'];
  if (!phasesRequiringTestDefs.includes(ticketInfo.phase)) return;

  const testDefsPath = `${ticketsDir}/${ticketInfo.folder}/test-definitions.md`;

  if (!existsSync(testDefsPath)) {
    hardBlockDone(
      `Feature at ${ticketInfo.phase} phase requires test-definitions.md. Create it with at least one scenario before stopping.`,
    );
  }

  // File exists — verify it has at least one scenario (not empty/stub).
  // Counts GFM task list checkboxes (- [ ] / - [x]). Threshold: > 0.
  const content = readFileSync(testDefsPath, 'utf8');
  const scenarioCount = (content.match(/^\s*- \[.\]/gm) ?? []).length;
  if (scenarioCount === 0) {
    hardBlockDone(
      `Feature at ${ticketInfo.phase} phase: test-definitions.md has no scenarios defined. Add at least one before stopping.`,
    );
  }
}

// Not a safeword project, skip silently
if (!existsSync(safewordDir)) {
  process.exit(0);
}

// Read hook input from stdin
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

// Loop guard: if stop hook already triggered a continuation and no new edits,
// allow Claude to stop. Prevents infinite quality review loops.
const stopHookActive = input.stop_hook_active ?? false;

const transcriptPath = input.transcript_path;
if (!transcriptPath) {
  process.exit(0);
}

const transcriptFile = Bun.file(transcriptPath);
if (!(await transcriptFile.exists())) {
  process.exit(0);
}

// Read transcript (JSONL format)
const transcriptText = await transcriptFile.text();
const lines = transcriptText.trim().split('\n');

checkUsageLimit(lines);

// Claude's last response text — provided directly by the hook runtime.
const combinedText = input.last_assistant_message ?? '';

// No edit tools used → no quality review needed (conversational response)
if (!detectEditToolsUsed(lines)) {
  process.exit(0);
}

// Get ticket info for phase-aware decision logic
const ticketInfo = getCurrentTicketInfo(input.session_id);
const currentPhase = ticketInfo.phase;

/**
 * Check last transcript line for usage limit phrases.
 * Exits with code 1 if found — avoids false positives from conversation content
 * by checking only the final message and capping text length at 200 chars.
 */
function checkUsageLimit(transcriptLines: string[]): void {
  try {
    const lastLine = transcriptLines[transcriptLines.length - 1] ?? '';
    const lastMessage: TranscriptMessage = JSON.parse(lastLine);
    const textContent =
      lastMessage.message?.content
        ?.filter(
          (item): item is ContentItem & { text: string } => item.type === 'text' && !!item.text,
        )
        .map(item => item.text)
        .join('') ?? '';
    if (
      textContent.length > 0 &&
      textContent.length < 200 &&
      USAGE_LIMIT_PATTERN.test(textContent)
    ) {
      console.error('Claude usage limit reached. Try again after reset.');
      process.exit(1);
    }
  } catch {
    // Not valid JSON or missing structure - continue with normal processing
  }
}

/**
 * Scan the last MAX_MESSAGES_FOR_TOOLS assistant messages for edit tool usage.
 * Returns true if Write/Edit/MultiEdit/NotebookEdit appears in any recent message.
 */
function detectEditToolsUsed(transcriptLines: string[]): boolean {
  let checked = 0;
  for (let i = transcriptLines.length - 1; i >= 0 && checked < MAX_MESSAGES_FOR_TOOLS; i--) {
    try {
      const message: TranscriptMessage = JSON.parse(transcriptLines[i]);
      if (message.type === 'assistant' && message.message?.content) {
        checked++;
        for (const item of message.message.content) {
          if (item.type === 'tool_use' && item.name && EDIT_TOOLS.has(item.name)) return true;
        }
      }
    } catch {
      // Skip invalid JSON lines
    }
  }
  return false;
}

/**
 * Get done gate message based on ticket type.
 */
function getDoneHardBlockMessage(ticketType: string | undefined, missingAudit: boolean): string {
  if (missingAudit) {
    return `Done phase requires audit evidence. Run /audit and show results.

Expected evidence format:
- "Audit passed" or "Audit passed with warnings"

Run /audit, show output, then try again.`;
  }

  const auditLine =
    ticketType === 'feature' ? '\n- "Audit passed" (required for features — run /audit)' : '';

  return `Done phase requires evidence. Run /verify and show results.

Expected evidence formats:
- "✓ X/X tests pass" or "X/X tests pass" (required for tasks with no test command)${auditLine}

Run /verify, show output, then try again.`;
}

/**
 * Hard block for done phase — requires specific evidence before Claude can stop.
 * No bypass: stop_hook_active does not skip this check.
 */
function hardBlockDone(reason: string): never {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

/**
 * Bypassable block — delivers a reason or instruction to Claude via JSON decision:block.
 * The stop_hook_active guard (below) allows one bypass per review cycle to prevent loops.
 * Used for: quality review prompts, navigation instructions.
 */
function softBlock(reason: string): never {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

// Decision logic:
// 1. Cumulative artifact missing/empty → hardBlockDone (no bypass; a feature with no scenarios is broken)
// 2. Done phase with missing evidence → hardBlockDone (no bypass; loops until evidence present)
// 3. Done phase with evidence → allow (exit 0)
// 4. Other phases → softBlock with quality review prompt (one-shot judgment; not enforcement)

// Check cumulative artifacts (features at scenario-gate+ need test-definitions.md with scenarios)
checkCumulativeArtifacts(ticketInfo);

if (currentPhase === 'done') {
  // Done phase: require evidence before allowing stop.
  // Features need test + scenario + audit evidence; tasks need test only.
  const isFeature = ticketInfo.type === 'feature';

  // Run tests directly — authoritative external gate, cannot be gamed by prose.
  // skipped=true means no test command found (package.json missing or no scripts.test).
  const testResult = runTests(projectDir);
  if (!testResult.skipped && !testResult.passed) {
    recordFailure(projectDir, input.session_id, 'done-gate-tests-failed');
    hardBlockDone(`Tests failed. Fix failures before marking done.\n\n${testResult.output}`);
  }

  // Scenario evidence: read test-definitions.md directly (structural, not prose matching).
  // Audit evidence: text-based (audit produces qualitative assessment, not binary file output).
  const hasScenarios = checkScenariosComplete(ticketInfo);
  const hasAudit = AUDIT_EVIDENCE_PATTERN.test(combinedText);

  if (isFeature) {
    // Features: require scenario + audit evidence (tests already verified above)
    if (!hasScenarios) {
      recordFailure(projectDir, input.session_id, 'done-gate-tests-failed');
      hardBlockDone(
        `Not all scenarios are complete in test-definitions.md. Mark all scenario checkboxes [x] before marking done.`,
      );
    }
    if (!hasAudit) {
      recordFailure(projectDir, input.session_id, 'done-gate-tests-failed');
      hardBlockDone(getDoneHardBlockMessage(ticketInfo.type, true));
    }
  } else if (testResult.skipped) {
    // Tasks with no test command: fall back to text evidence
    if (!TEST_EVIDENCE_PATTERN.test(combinedText)) {
      recordFailure(projectDir, input.session_id, 'done-gate-tests-failed');
      hardBlockDone(getDoneHardBlockMessage(ticketInfo.type, false));
    }
  }

  // Evidence passed — mark current ticket done and navigate hierarchy
  if (ticketInfo.folder) {
    const currentTicketDirectory = `${ticketsDir}/${ticketInfo.folder}`;
    updateTicketStatus(currentTicketDirectory, 'done', 'done');

    // Walk hierarchy: cascade done status up and navigate to next sibling
    let directory = currentTicketDirectory;
    const MAX_CASCADE = 10;
    for (let depth = 0; depth < MAX_CASCADE; depth++) {
      const next = findNextWork(directory, ticketsDir);
      if (next.type === 'navigate') {
        softBlock(
          `Ticket complete! Next up: read ${next.ticketDirectory}/ticket.md and begin work on ${next.ticketId}.`,
        );
      } else if (next.type === 'cascade-done') {
        // Mark parent done and continue walking up
        updateTicketStatus(next.ticketDirectory, 'done', 'done');
        directory = next.ticketDirectory;
      } else {
        // all-done — no more work in hierarchy
        break;
      }
    }
  }

  process.exit(0);
}

// Heavyweight tier: quality review prompt (judgment-based, not enforcement).
// Loop prevention: if stop_hook_active, the previous review cycle already ran — allow stop.
if (stopHookActive) {
  process.exit(0);
}

// Frequency reduction: only fire quality review when meaningful.
// - Non-implement phases: always fire (they're brief — 1-3 turns each)
// - Implement phase: fire only when >50 LOC changed since last review
const sessionState = readSessionState(input.session_id);

const shouldFireReview = (() => {
  if (!sessionState) return true;
  if (currentPhase !== 'implement') return true;
  const locDelta = (sessionState.locSinceCommit ?? 0) - (sessionState.locAtLastReview ?? 0);
  return locDelta > LOC_REVIEW_THRESHOLD;
})();

if (!shouldFireReview) {
  process.exit(0);
}

updateLocAtLastReview(input.session_id);

// Derive TDD step from test-definitions.md (not cache)
const tddStep =
  currentPhase === 'implement' && ticketInfo.folder
    ? deriveTddStep(projectDir, ticketInfo.folder)
    : null;

softBlock(getQualityMessage(currentPhase, tddStep));
