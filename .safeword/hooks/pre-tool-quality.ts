#!/usr/bin/env bun
// Safeword: Quality Gates - PreToolUse enforcer
// Reads quality-state.json, blocks edits when gate is set (exit 2)
// Fires on Edit|Write|MultiEdit|NotebookEdit

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

const LOC_THRESHOLD = 400;
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];

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
  tool_name?: string;
}

interface QualityState {
  locSinceCommit: number;
  lastCommitHash: string;
  activeTicket: string | null;
  lastKnownPhase: string | null;
  gate: string | null;
}

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const stateFile = nodePath.join(projectDir, '.safeword-project', 'quality-state.json');

// Read hook input from stdin
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

const tool = input.tool_name ?? '';

// Only gate edit tools
if (!EDIT_TOOLS.includes(tool)) {
  process.exit(0);
}

// No state file → no enforcement
if (!existsSync(stateFile)) {
  process.exit(0);
}

let state: QualityState;
try {
  state = JSON.parse(readFileSync(stateFile, 'utf-8'));
} catch {
  process.exit(0);
}

// Check if commit happened → gate clears
const currentHead = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
})();

if (state.lastCommitHash !== currentHead) {
  process.exit(0);
}

// No gate set → allow
if (!state.gate) {
  process.exit(0);
}

// LOC gate
if (state.gate === 'loc') {
  console.error(`SAFEWORD: ${state.locSinceCommit} LOC since last commit (threshold: ${LOC_THRESHOLD}).

Commit your progress before continuing.

TDD reminder:
- RED: commit test ("test: [scenario]")
- GREEN: commit implementation ("feat: [scenario]")
- REFACTOR: commit cleanup`);
  process.exit(2);
}

// Phase gate
if (state.gate.startsWith('phase:')) {
  const phase = state.gate.replace('phase:', '');
  const phaseContent = readPhaseFile(phase);
  console.error(`SAFEWORD: Entering ${phase} phase.

${phaseContent}

Commit to proceed.`);
  process.exit(2);
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
  const filePath = nodePath.join(
    projectDir,
    '.claude',
    'skills',
    'safeword-bdd-orchestrating',
    fileName,
  );
  if (!existsSync(filePath)) {
    return `Phase: ${phase} (phase file not found: ${fileName})`;
  }
  return readFileSync(filePath, 'utf-8').trim();
}
