#!/usr/bin/env bun
// Safeword: Pre-work reminders (UserPromptSubmit)
// Injects propose-and-converge principles + phase-aware status reminder

import { existsSync, readFileSync } from 'node:fs';

import { getStateFilePath } from './lib/quality-state.ts';

interface HookInput {
  session_id?: string;
  prompt?: string;
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const safewordDirectory = `${projectDirectory}/.safeword`;

// Not a safeword project, skip silently
if (!existsSync(safewordDirectory)) {
  process.exit(0);
}

// Read hook input from stdin (same pattern as pre-tool and post-tool hooks)
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  input = {};
}

// Core principles (survive context compaction — re-injected every turn)
const lines = [
  'SAFEWORD:',
  '- Contribute before asking. Embed open questions in your contribution.',
  '- When proposing, state what it touches and what rigor it warrants.',
];

// Phase-aware reminder from quality state (compressed cognitive state — one line)
const stateFile = getStateFilePath(projectDirectory, input.session_id);

if (existsSync(stateFile)) {
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));

    if (state.activeTicket && state.lastKnownPhase) {
      const phase = state.lastKnownPhase;
      const tddStep = state.lastKnownTddStep;

      // Phase-specific one-liner
      const reminders: Record<string, string> = {
        intake: 'Phase: understanding. Contribute a perspective, surface open questions.',
        'define-behavior': 'Phase: define-behavior. Write scenarios from your converged proposal.',
        'scenario-gate':
          'Phase: scenario-gate. Validate scenarios (AODI: Atomic, Observable, Deterministic, Independent).',
        decomposition:
          'Phase: decomposition (optional). Break into tasks if architecture is unclear.',
        implement: tddStep
          ? `TDD: ${tddStep.toUpperCase()}. ${tddNextStep(tddStep)}`
          : 'Phase: implement. Pick first unchecked scenario, start TDD.',
        done: 'Phase: done. Finish (refactor → verify → audit), then close.',
      };

      const reminder = reminders[phase];
      if (reminder) {
        lines.push(`- ${reminder}`);
      }
    }
  } catch {
    // State file corrupted or unreadable — skip reminder, keep core principles
  }
}

console.log(lines.join('\n'));

function tddNextStep(step: string): string {
  const next: Record<string, string> = {
    red: 'Write a minimal failing test for the next scenario.',
    green: 'Next: refactor while keeping tests green.',
    refactor: 'Next: pick next unchecked scenario.',
  };
  return next[step] ?? '';
}
