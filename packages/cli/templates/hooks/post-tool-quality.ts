#!/usr/bin/env bun
// Safeword: Quality Gates - PostToolUse observer
// Counts LOC via git diff --stat HEAD, detects phase changes and TDD step transitions,
// updates quality-state.json. Fires on Edit|Write|MultiEdit|NotebookEdit|Bash

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { getStateFilePath, LOC_THRESHOLD, type QualityState } from './lib/quality-state.ts';

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    notebook_path?: string;
  };
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

// Read hook input from stdin
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

const stateFile = getStateFilePath(projectDirectory, input.session_id);
const editedFile = input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '';

// Load or create state
function loadState(): QualityState {
  if (existsSync(stateFile)) {
    try {
      return JSON.parse(readFileSync(stateFile, 'utf-8'));
    } catch {
      // Corrupted file — reinitialize
    }
  }
  return {
    locSinceCommit: 0,
    lastCommitHash: '',
    activeTicket: null,
    lastKnownPhase: null,
    gate: null,
    lastKnownTddStep: null,
  };
}

function saveState(state: QualityState): void {
  const dir = nodePath.dirname(stateFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function getHeadHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: projectDirectory,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function countLoc(): number {
  try {
    const diffStat = execSync('git diff --stat HEAD', {
      cwd: projectDirectory,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const insMatch = diffStat.match(/(\d+) insertions?\(\+\)/);
    const delMatch = diffStat.match(/(\d+) deletions?\(-\)/);
    return (insMatch ? parseInt(insMatch[1]) : 0) + (delMatch ? parseInt(delMatch[1]) : 0);
  } catch {
    return 0;
  }
}

// --- Main ---

const state = loadState();
const currentHead = getHeadHash();

// If no commits yet, skip enforcement
if (!currentHead) {
  process.exit(0);
}

// Check if commit happened (gate clears)
if (state.lastCommitHash !== currentHead) {
  state.locSinceCommit = 0;
  state.lastCommitHash = currentHead;
  state.gate = null;
}

// Count LOC
state.locSinceCommit = countLoc();

// LOC gate
if (state.locSinceCommit >= LOC_THRESHOLD && !state.gate?.startsWith('tdd:')) {
  state.gate = 'loc';
}

// Phase change detection
if (editedFile.includes('.safeword-project/tickets/') && editedFile.endsWith('ticket.md')) {
  const fullPath = editedFile.startsWith('/')
    ? editedFile
    : nodePath.join(projectDirectory, editedFile);
  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    const phaseMatch = content.match(/^phase:\s*(\S+)/m);
    const currentPhase = phaseMatch?.[1];

    if (currentPhase && currentPhase !== state.lastKnownPhase) {
      // Only gate on real phase transitions, not ticket creation (null → phase).
      // Creating a ticket isn't a transition — there's no outgoing phase work to review.
      if (state.lastKnownPhase !== null) {
        state.gate = `phase:${currentPhase}`;
      }
      state.lastKnownPhase = currentPhase;
    }

    // Track active ticket
    const idMatch = content.match(/^id:\s*(\S+)/m);
    if (idMatch) {
      state.activeTicket = idMatch[1];
    }
  }
}

// TDD step detection (test-definitions.md sub-checkboxes)
if (
  state.lastKnownPhase === 'implement' &&
  editedFile.includes('.safeword-project/tickets/') &&
  editedFile.endsWith('test-definitions.md')
) {
  const fullPath = editedFile.startsWith('/')
    ? editedFile
    : nodePath.join(projectDirectory, editedFile);
  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    const currentStep = parseTddStep(content);

    if (currentStep && currentStep !== state.lastKnownTddStep) {
      const nextGate =
        currentStep === 'red' ? 'tdd:green' : currentStep === 'green' ? 'tdd:refactor' : 'tdd:red';
      state.gate = nextGate;
      state.lastKnownTddStep = currentStep;
    }
  }
}

saveState(state);
process.exit(0);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse test-definitions.md sub-checkboxes to find current TDD step.
 * Looks for the first scenario with mixed checked/unchecked sub-items.
 * Returns the last completed step: 'red' (1 checked), 'green' (2 checked),
 * 'refactor' (3 checked). Returns null if no active scenario found.
 */
function parseTddStep(content: string): string | null {
  const lines = content.split('\n');
  const steps = ['red', 'green', 'refactor'];
  let checkedCount = 0;
  let uncheckedCount = 0;
  let previousScenarioComplete = false;

  for (const line of lines) {
    // Detect scenario header — reset counters
    if (/^###\s/.test(line)) {
      // Check previous scenario before resetting
      if (checkedCount > 0 && uncheckedCount > 0) {
        return steps[checkedCount - 1] ?? null;
      }
      // Track if previous scenario was fully complete
      previousScenarioComplete = checkedCount === 3 && uncheckedCount === 0;
      checkedCount = 0;
      uncheckedCount = 0;
      continue;
    }

    // Count sub-checkboxes (RED/GREEN/REFACTOR)
    const checkboxMatch = line.match(/^- \[([ x])\] (RED|GREEN|REFACTOR)\s*$/i);
    if (checkboxMatch) {
      if (checkboxMatch[1] === 'x') {
        checkedCount++;
      } else {
        uncheckedCount++;
      }
    }
  }

  // Check last scenario — mixed means active
  if (checkedCount > 0 && uncheckedCount > 0) {
    return steps[checkedCount - 1] ?? null;
  }

  // Last scenario fully complete — return 'refactor' (just finished)
  if (checkedCount === 3 && uncheckedCount === 0) {
    return 'refactor';
  }

  // Last scenario all unchecked but previous was complete — REFACTOR just done
  if (checkedCount === 0 && uncheckedCount > 0 && previousScenarioComplete) {
    return 'refactor';
  }

  return null;
}
