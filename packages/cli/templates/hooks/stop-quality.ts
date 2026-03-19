#!/usr/bin/env bun
// Safeword: Auto Quality Review Stop Hook
// Triggers quality review when changes are proposed or made
// Uses JSON summary if available, falls back to detecting edit tool usage
// Phase-aware: reads ticket phase for context-appropriate review questions

import { existsSync, readdirSync, readFileSync } from 'node:fs';

import { findNextWork, updateTicketStatus } from './lib/hierarchy.ts';
import { getQualityMessage, type BddPhase } from './lib/quality.ts';

interface HookInput {
  transcript_path?: string;
  stop_hook_active?: boolean;
}

interface ContentItem {
  type: string;
  text?: string;
  name?: string; // for tool_use
}

interface TranscriptMessage {
  type: string; // "assistant" | "user" | etc at top level
  message?: {
    role?: string;
    content?: ContentItem[];
  };
}

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDir = `${projectDir}/.safeword`;
const ticketsDir = `${projectDir}/.safeword-project/tickets`;

interface TicketInfo {
  phase: BddPhase | undefined;
  type: string | undefined;
  folder: string | undefined;
}

/**
 * Read ticket info from the most recently modified in_progress ticket.
 * Only considers tickets with status: in_progress (ignores backlog, done, etc.)
 * Skips type: epic tickets (work happens in child features/tasks)
 */
function getCurrentTicketInfo(): TicketInfo {
  const empty: TicketInfo = { phase: undefined, type: undefined, folder: undefined };

  if (!existsSync(ticketsDir)) {
    return empty;
  }

  try {
    // List ticket folders (exclude 'completed' and 'tmp')
    const folders = readdirSync(ticketsDir).filter(f => {
      if (f === 'completed' || f === 'tmp') return false;
      const ticketPath = `${ticketsDir}/${f}/ticket.md`;
      return existsSync(ticketPath);
    });
    if (folders.length === 0) return empty;

    // Find most recently modified in_progress ticket (excluding epics)
    let latestFolder = '';
    let latestContent = '';
    let latestMtime = 0;
    for (const folder of folders) {
      const ticketPath = `${ticketsDir}/${folder}/ticket.md`;
      const content = readFileSync(ticketPath, 'utf-8');

      // Skip tickets that aren't in_progress
      const statusMatch = content.match(/^status:\s*(\S+)/m);
      if (statusMatch?.[1] !== 'in_progress') continue;

      // Skip epic tickets (work happens in children)
      const typeMatch = content.match(/^type:\s*(\S+)/m);
      if (typeMatch?.[1] === 'epic') continue;

      const mtime = new Date(content.match(/last_modified: (.+)/)?.[1] ?? 0).getTime();
      if (mtime > latestMtime) {
        latestMtime = mtime;
        latestFolder = folder;
        latestContent = content;
      }
    }

    if (!latestFolder) return empty;

    const phaseMatch = latestContent.match(/^phase:\s*(\S+)/m);
    const typeMatch = latestContent.match(/^type:\s*(\S+)/m);

    return {
      phase: phaseMatch?.[1] as BddPhase | undefined,
      type: typeMatch?.[1],
      folder: latestFolder,
    };
  } catch {
    // Silent fail - use default message
  }
  return empty;
}

/**
 * Check cumulative artifact requirements for features.
 * Features at scenario-gate+ phases require test-definitions.md to exist.
 */
function checkCumulativeArtifacts(ticketInfo: TicketInfo): string | undefined {
  // Only enforce for features
  if (ticketInfo.type !== 'feature') return undefined;
  if (!ticketInfo.folder || !ticketInfo.phase) return undefined;

  // Phases that require test-definitions.md
  const phasesRequiringTestDefs = ['scenario-gate', 'decomposition', 'implement', 'done'];
  if (!phasesRequiringTestDefs.includes(ticketInfo.phase)) return undefined;

  // Check if test-definitions.md exists
  const testDefsPath = `${ticketsDir}/${ticketInfo.folder}/test-definitions.md`;
  if (!existsSync(testDefsPath)) {
    return `Feature at ${ticketInfo.phase} phase requires test-definitions.md. Create it before proceeding.`;
  }

  return undefined;
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

// Check last message for usage limit (avoids false positives from conversation content)
const USAGE_LIMIT_PATTERN =
  /\b(usage limit reached|5-hour limit reached|"type"\s*:\s*"exceeded_limit")\b/i;
try {
  const lastLine = lines[lines.length - 1] ?? '';
  const lastMessage: TranscriptMessage = JSON.parse(lastLine);
  const textContent =
    lastMessage.message?.content
      ?.filter(
        (item): item is ContentItem & { text: string } => item.type === 'text' && !!item.text,
      )
      .map(item => item.text)
      .join('') ?? '';
  if (textContent.length > 0 && textContent.length < 200 && USAGE_LIMIT_PATTERN.test(textContent)) {
    console.error('SAFEWORD: Claude usage limit reached. Try again after reset.');
    process.exit(1);
  }
} catch {
  // Not valid JSON or missing structure - continue with normal processing
}

// Detect edit tool usage in recent assistant messages
let editToolsUsed = false;
let combinedText = '';
let assistantMessagesChecked = 0;
const MAX_MESSAGES_FOR_TOOLS = 5;

for (let i = lines.length - 1; i >= 0 && assistantMessagesChecked < MAX_MESSAGES_FOR_TOOLS; i--) {
  try {
    const message: TranscriptMessage = JSON.parse(lines[i]);
    if (message.type === 'assistant' && message.message?.content) {
      assistantMessagesChecked++;
      for (const item of message.message.content) {
        // Collect text from the most recent assistant message (for done-phase evidence)
        if (assistantMessagesChecked === 1 && item.type === 'text' && item.text) {
          combinedText += item.text;
        }
        if (item.type === 'tool_use' && item.name && EDIT_TOOLS.has(item.name)) {
          editToolsUsed = true;
        }
      }
    }
  } catch {
    // Skip invalid JSON lines
  }
}

// No edit tools used → no quality review needed (conversational response)
if (!editToolsUsed) {
  process.exit(0);
}

// Get ticket info and phase-aware quality message
const ticketInfo = getCurrentTicketInfo();
const currentPhase = ticketInfo.phase;
const qualityMessage = getQualityMessage(currentPhase);

/**
 * Evidence patterns for done phase validation.
 */
const TEST_EVIDENCE_PATTERN = /✓\s*\d+\/\d+\s*tests?\s*pass/i; // "✓ 156/156 tests pass"
const TEST_EVIDENCE_ALT_PATTERN = /\d+\/\d+\s*tests?\s*pass/i; // "156/156 tests pass"
const SCENARIO_EVIDENCE_PATTERN = /all\s+\d+\s+scenarios?\s+marked/i; // "All 10 scenarios marked complete"
const AUDIT_EVIDENCE_PATTERN = /audit\s+passed/i; // "Audit passed" or "Audit passed with warnings"

/** Check if transcript contains test evidence (either format). */
function hasTestEvidence(text: string): boolean {
  return TEST_EVIDENCE_PATTERN.test(text) || TEST_EVIDENCE_ALT_PATTERN.test(text);
}

/**
 * Get done gate message based on ticket type.
 */
function getDoneHardBlockMessage(ticketType: string | undefined, missingAudit: boolean): string {
  const scenarioLine =
    ticketType === 'feature' ? '\n- "All N scenarios marked complete" (required for features)' : '';
  const auditLine =
    ticketType === 'feature' ? '\n- "Audit passed" (required for features — run /audit)' : '';

  if (missingAudit) {
    return `SAFEWORD: Done phase requires audit evidence. Run /audit and show results.

Expected evidence format:
- "Audit passed" or "Audit passed with warnings"

Run /audit, show output, then try again.`;
  }

  return `SAFEWORD: Done phase requires evidence. Run /verify and show results.

Expected evidence formats:
- "✓ X/X tests pass" (required)${scenarioLine}${auditLine}

Run tests, show output, then try again.`;
}

/**
 * Hard block for done phase - uses exit 2 to force Claude to continue.
 * Claude receives stderr and must provide evidence before stopping.
 */
function hardBlockDone(reason: string): never {
  console.error(reason);
  process.exit(2);
}

/**
 * Soft block for other phases - uses JSON decision to prompt review.
 */
function softBlock(reason: string): never {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

// Decision logic:
// 1. Cumulative artifact missing → soft block
// 2. Done phase with missing evidence → hard block (exit 2)
// 3. Done phase with evidence → allow (exit 0)
// 4. Other phases → soft block with quality review

// Check cumulative artifacts (features at scenario-gate+ need test-definitions.md)
const artifactError = checkCumulativeArtifacts(ticketInfo);
if (artifactError) {
  softBlock(artifactError);
}

if (currentPhase === 'done') {
  // Done phase: require evidence before allowing stop.
  // Features need test + scenario + audit evidence; tasks need test only.
  const isFeature = ticketInfo.type === 'feature';
  const hasTests = hasTestEvidence(combinedText);
  const hasScenarios = SCENARIO_EVIDENCE_PATTERN.test(combinedText);
  const hasAudit = AUDIT_EVIDENCE_PATTERN.test(combinedText);

  if (isFeature) {
    // Features: require all three evidence types
    if (!hasTests || !hasScenarios) hardBlockDone(getDoneHardBlockMessage(ticketInfo.type, false));
    if (!hasAudit) hardBlockDone(getDoneHardBlockMessage(ticketInfo.type, true));
  } else {
    // Tasks: require test evidence only
    if (!hasTests) hardBlockDone(getDoneHardBlockMessage(ticketInfo.type, false));
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

// Other phases: trigger quality review when edits were made
// Guard: if stop_hook_active, a previous review already ran — allow stop
if (stopHookActive) {
  process.exit(0);
}
softBlock(qualityMessage);
