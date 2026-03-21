#!/usr/bin/env bun
// Safeword: Auto Quality Review Stop Hook
// Triggers quality review when edit tools (Write/Edit/MultiEdit/NotebookEdit) are used
// Phase-aware: reads ticket phase for context-appropriate review questions

import { existsSync, readFileSync } from 'node:fs';

import { getActiveTicket } from './lib/active-ticket.ts';
import { findNextWork, updateTicketStatus } from './lib/hierarchy.ts';
import { getQualityMessage, type BddPhase } from './lib/quality.ts';

interface HookInput {
  transcript_path?: string;
  stop_hook_active?: boolean;
}

interface ContentItem {
  type: string;
  text?: string;
  name?: string; // tool_use: tool name
  id?: string; // tool_use: unique call ID
  tool_use_id?: string; // tool_result: correlates to tool_use.id
  content?: string | ContentItem[]; // tool_result: output content
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

function getCurrentTicketInfo(): TicketInfo {
  const info = getActiveTicket(projectDir);
  return {
    phase: info.phase as BddPhase | undefined,
    type: info.type,
    folder: info.folder,
  };
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
 * Extract Bash tool output from transcript lines, scoped to calls after the last edit.
 *
 * Two-pass approach:
 * 1. Find the line index of the most recent edit tool call (Write/Edit/MultiEdit/NotebookEdit)
 *    and collect all Bash tool_use IDs with their positions.
 * 2. Collect tool_result content for Bash calls that came after the last edit.
 *
 * Returns combined output string, or null if no Bash calls found after last edit.
 *
 * Trust model: test + scenario evidence must come from real Bash output (external, verifiable).
 * Audit evidence stays text-based — /audit is judgment-based, not a Bash subprocess.
 */
function extractBashOutputSinceLastEdit(transcriptLines: string[]): string | null {
  // Pass 1: find last edit position and all Bash tool_use IDs with their line positions
  let lastEditLineIndex = -1;
  const bashCalls: Array<{ id: string; lineIndex: number }> = [];

  for (let i = 0; i < transcriptLines.length; i++) {
    try {
      const msg: TranscriptMessage = JSON.parse(transcriptLines[i]);
      if (msg.type === 'assistant' && msg.message?.content) {
        for (const item of msg.message.content) {
          if (item.type === 'tool_use') {
            if (item.name && EDIT_TOOLS.has(item.name)) lastEditLineIndex = i;
            if (item.name === 'Bash' && item.id) bashCalls.push({ id: item.id, lineIndex: i });
          }
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }

  // Bash calls that came strictly after the last edit
  const bashIdsAfterEdit = new Set(
    bashCalls.filter(b => b.lineIndex > lastEditLineIndex).map(b => b.id),
  );
  if (bashIdsAfterEdit.size === 0) return null;

  // Pass 2: collect tool_result content for those Bash calls
  let output = '';
  for (const line of transcriptLines) {
    try {
      const msg: TranscriptMessage = JSON.parse(line);
      if (msg.type === 'user' && msg.message?.content) {
        for (const item of msg.message.content) {
          if (
            item.type === 'tool_result' &&
            item.tool_use_id &&
            bashIdsAfterEdit.has(item.tool_use_id)
          ) {
            if (typeof item.content === 'string') {
              output += '\n' + item.content;
            } else if (Array.isArray(item.content)) {
              for (const c of item.content) {
                if (c.type === 'text' && c.text) output += '\n' + c.text;
              }
            }
          }
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return output || null;
}

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

  return `SAFEWORD: Done phase requires test evidence from Bash output. Run /verify and show results.

Expected evidence formats (must appear in Bash tool output):
- "✓ X/X tests pass" (required)${scenarioLine}${auditLine}

Run /verify (or run tests directly via Bash), show output, then try again.`;
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
 * Used for: quality review prompts, navigation instructions, cumulative artifact gates.
 */
function softBlock(reason: string): never {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

// Decision logic:
// 1. Cumulative artifact missing → softBlock (gate: must fix, but stop_hook_active can bypass)
// 2. Done phase with missing evidence → hardBlockDone (no bypass; loops until evidence present)
// 3. Done phase with evidence → allow (exit 0)
// 4. Other phases → softBlock with quality review prompt (one-shot judgment; not enforcement)

// Check cumulative artifacts (features at scenario-gate+ need test-definitions.md)
const artifactError = checkCumulativeArtifacts(ticketInfo);
if (artifactError) {
  softBlock(artifactError);
}

if (currentPhase === 'done') {
  // Done phase: require evidence before allowing stop.
  // Features need test + scenario + audit evidence; tasks need test only.
  const isFeature = ticketInfo.type === 'feature';

  // Test + scenario evidence must come from Bash tool output after the last edit.
  // This prevents Claude from gaming the gate by writing the evidence string in prose.
  // Audit evidence stays text-based: /audit is a skill (judgment), not a Bash subprocess.
  const bashOutput = extractBashOutputSinceLastEdit(lines);
  if (bashOutput === null) {
    hardBlockDone(
      `SAFEWORD: Done phase requires test evidence from Bash output, but no Bash commands ran after your last edit.\n\nRun /verify (or run tests directly via Bash), show output, then try again.`,
    );
  }
  const hasTests = hasTestEvidence(bashOutput);
  const hasScenarios = SCENARIO_EVIDENCE_PATTERN.test(bashOutput);
  const hasAudit = AUDIT_EVIDENCE_PATTERN.test(combinedText); // /audit output is in assistant text

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

// Other phases: prompt quality review when edits were made.
// Loop prevention: if stop_hook_active, the previous review cycle already ran — allow stop.
// This is intentional, not a weakness: the quality review is Claude's judgment on things
// external tools cannot verify (elegance, abstractions, best practices). One round is the point.
if (stopHookActive) {
  process.exit(0);
}
softBlock(qualityMessage);
