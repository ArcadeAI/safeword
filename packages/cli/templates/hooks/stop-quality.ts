#!/usr/bin/env bun
// Safeword: Auto Quality Review Stop Hook
// Triggers quality review when edit tools (Write/Edit/MultiEdit/NotebookEdit) are used
// Phase-aware: reads ticket phase for context-appropriate review questions

import { existsSync, readFileSync } from 'node:fs';

import { getActiveTicket } from './lib/active-ticket.ts';
import { findNextWork, updateTicketStatus } from './lib/hierarchy.ts';
import { getQualityMessage, type BddPhase } from './lib/quality.ts';
import { runTests } from './lib/test-runner.ts';

interface HookInput {
  transcript_path?: string;
  stop_hook_active?: boolean;
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

/** Evidence patterns for done-phase validation (matched against Claude's last message text). */
const TEST_EVIDENCE_PATTERN = /✓\s*\d+\/\d+\s*tests?\s*pass/i; // "✓ 156/156 tests pass"
const TEST_EVIDENCE_ALT_PATTERN = /\d+\/\d+\s*tests?\s*pass/i; // "156/156 tests pass"
const SCENARIO_EVIDENCE_PATTERN = /all\s+\d+\s+scenarios?\s+marked/i; // "All 10 scenarios marked complete"
const AUDIT_EVIDENCE_PATTERN = /audit\s+passed/i; // "Audit passed" or "Audit passed with warnings"

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
  // Counts all checkbox lines (including RED/GREEN/REFACTOR sub-steps). Threshold: > 0.
  const content = readFileSync(testDefsPath, 'utf8');
  const scenarioCount = (content.match(/^\s*- \[/gm) ?? []).length;
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
- "✓ X/X tests pass" or "X/X tests pass" (required for tasks with no test command)${scenarioLine}${auditLine}

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
 * Used for: quality review prompts, navigation instructions, cumulative artifact gates.
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
    hardBlockDone(
      `SAFEWORD: Tests failed. Fix failures before marking done.\n\n${testResult.output}`,
    );
  }

  // Scenario + audit evidence: text-based (checked in Claude's last message).
  // Scenarios come from /verify prose output — not Bash tool output.
  // Audit comes from /audit skill output — not a Bash subprocess.
  const hasScenarios = SCENARIO_EVIDENCE_PATTERN.test(combinedText);
  const hasAudit = AUDIT_EVIDENCE_PATTERN.test(combinedText);

  if (isFeature) {
    // Features: require scenario + audit evidence (tests already verified above)
    if (!hasScenarios)
      hardBlockDone(
        `SAFEWORD: Done phase requires scenario evidence. Run /verify and show results.\n\nExpected: "All N scenarios marked complete"\n\nRun /verify, show output, then try again.`,
      );
    if (!hasAudit) hardBlockDone(getDoneHardBlockMessage(ticketInfo.type, true));
  } else if (testResult.skipped) {
    // Tasks with no test command: fall back to text evidence
    if (!hasTestEvidence(combinedText))
      hardBlockDone(getDoneHardBlockMessage(ticketInfo.type, false));
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
