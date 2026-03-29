#!/usr/bin/env bun
// Safeword: Quality Gates - PreToolUse enforcer
// Reads quality-state.json, blocks edits when gate is set
// Fires on Edit|Write|MultiEdit|NotebookEdit

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { getTicketPhase } from './lib/active-ticket.ts';
import {
  getStateFilePath,
  LOC_THRESHOLD,
  META_PATHS,
  type QualityState,
} from './lib/quality-state.ts';

const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];

// Phases that block code edits (only implement phase allows writing code)
const PLANNING_PHASES = new Set([
  'intake',
  'define-behavior',
  'scenario-gate',
  'decomposition',
  'done',
]);

// Phase → skill file mapping
const PHASE_FILE_MAP: Record<string, string> = {
  intake: 'DISCOVERY.md',
  'define-behavior': 'SCENARIOS.md',
  'scenario-gate': 'SCENARIOS.md',
  decomposition: 'DECOMPOSITION.md',
  implement: 'TDD.md',
  done: 'DONE.md',
};

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    notebook_path?: string;
  };
}

function deny(reason: string, additionalContext?: string): never {
  const output: Record<string, unknown> = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
      ...(additionalContext ? { additionalContext } : {}),
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
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
const tool = input.tool_name ?? '';
const editedFile = input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '';

// Only gate edit tools
if (!EDIT_TOOLS.includes(tool)) {
  process.exit(0);
}

// Never block edits to tooling/meta files — these are not application code.
if (META_PATHS.some(p => editedFile.includes(p))) {
  process.exit(0);
}

// No state file → no enforcement (session hasn't started tracking yet)
if (!existsSync(stateFile)) {
  process.exit(0);
}

let state: QualityState;
try {
  state = JSON.parse(readFileSync(stateFile, 'utf8'));
} catch {
  process.exit(0);
}

// Check if commit happened → gate clears
const currentHead = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: projectDirectory,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
})();

if (state.lastCommitHash !== currentHead) {
  process.exit(0);
}

// Phase-based access control: planning phases block code edits.
// Uses THIS session's activeTicket (from per-session state) — not a global scan.
// This prevents tickets from other sessions from blocking this session's edits.
if (state.activeTicket) {
  const phase = getTicketPhase(projectDirectory, state.activeTicket);
  if (phase && PLANNING_PHASES.has(phase)) {
    deny(
      `SAFEWORD: Active ticket is at "${phase}" phase — code edits require "implement" phase.\n\nAdvance your ticket to implement phase before writing code.`,
      'Update ticket.md frontmatter: phase: implement',
    );
  }
}

// No gate set → allow
if (!state.gate) {
  process.exit(0);
}

// LOC gate
if (state.gate === 'loc') {
  deny(`SAFEWORD: ${state.locSinceCommit} LOC since last commit (threshold: ${LOC_THRESHOLD}).

Commit your progress before continuing.

TDD reminder:
- RED: commit test ("test: [scenario]")
- GREEN: commit implementation ("feat: [scenario]")
- REFACTOR: commit cleanup`);
}

// TDD gates (tdd:green, tdd:refactor, tdd:red)
if (state.gate.startsWith('tdd:')) {
  const step = state.gate.replace('tdd:', '');
  deny(
    `SAFEWORD: Entering ${step} phase. Review your work before proceeding.`,
    'Run /tdd-review to review your work. Then commit to clear this gate.',
  );
}

// Phase gate
if (state.gate.startsWith('phase:')) {
  const phase = state.gate.replace('phase:', '');
  const phaseContent = readPhaseFile(phase);
  deny(
    `SAFEWORD: Entering ${phase} phase.\n\n${phaseContent}`,
    'Run /quality-review to review your outgoing phase work. Then commit to clear this gate.',
  );
}

process.exit(0);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readPhaseFile(phase: string): string {
  const fileName = PHASE_FILE_MAP[phase];
  if (!fileName) {
    return `Phase: ${phase}`;
  }
  const filePath = nodePath.join(projectDirectory, '.claude', 'skills', 'bdd', fileName);
  if (!existsSync(filePath)) {
    return `Phase: ${phase} (phase file not found: ${fileName})`;
  }
  return readFileSync(filePath, 'utf8').trim();
}
