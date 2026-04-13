#!/usr/bin/env bun
// Safeword: Quality Gates - PreToolUse enforcer
// Two-purpose: LOC gate (blast radius control) + artifact prerequisite check
// Fires on Edit|Write|MultiEdit|NotebookEdit

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { parseFrontmatter } from './lib/hierarchy.ts';
import {
  getStateFilePath,
  LOC_THRESHOLD,
  META_PATHS,
  type QualityState,
  recordFailure,
} from './lib/quality-state.ts';

const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];

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

const tool = input.tool_name ?? '';
const editedFile = input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '';

// Only gate edit tools
if (!EDIT_TOOLS.includes(tool)) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Artifact prerequisite check: test-definitions.md requires a complete ticket spec
// Runs BEFORE META_PATHS exemption because test-definitions.md lives in .safeword-project/
// This is the one structural gate at the highest-leverage transition point.
// Understanding determines the quality of everything downstream.
// ---------------------------------------------------------------------------

if (
  editedFile.endsWith('test-definitions.md') &&
  editedFile.includes('.safeword-project/tickets/') &&
  !existsSync(editedFile) // Only gate creation, not edits to existing files
) {
  const ticketDirectory = nodePath.dirname(editedFile);
  const ticketFile = nodePath.join(ticketDirectory, 'ticket.md');

  if (!existsSync(ticketFile)) {
    deny(
      'Cannot create test definitions without a ticket spec. Create ticket.md with Scope, Out of Scope, and Done When sections first.',
      'Complete understanding (propose-and-converge) before writing scenarios.',
    );
  }

  const ticketContent = readFileSync(ticketFile, 'utf8');
  const frontmatterMatch = ticketContent.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    deny(
      'Ticket spec has no YAML frontmatter. Add scope, out_of_scope, and done_when fields.',
      'Complete understanding (propose-and-converge) before writing scenarios.',
    );
  }

  const meta = parseFrontmatter(frontmatterMatch![1] ?? '');
  const required = ['scope', 'out_of_scope', 'done_when'] as const;
  const missing = required.filter(field => {
    const value = meta[field];
    return !value || value === 'null';
  });

  if (missing.length > 0) {
    deny(
      `Ticket frontmatter is missing: ${missing.join(', ')}. Complete understanding before writing scenarios.`,
      'Add the missing fields to ticket.md frontmatter, then create test-definitions.md.',
    );
  }
}

// Never block edits to tooling/meta files — these are not application code.
// (After artifact prerequisite check, which targets files in .safeword-project/)
if (META_PATHS.some(p => editedFile.includes(p))) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// LOC gate: blast radius control — commit every ~400 LOC
// ---------------------------------------------------------------------------

const stateFile = getStateFilePath(projectDirectory, input.session_id);

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

if (!state.gate) {
  process.exit(0);
}

if (state.gate === 'loc') {
  recordFailure(projectDirectory, input.session_id, 'loc-exceeded');
  deny(`${state.locSinceCommit} LOC since last commit (threshold: ${LOC_THRESHOLD}).

Commit your progress before continuing.`);
}

// All other gates (tdd:*, phase:*) are now reminders via prompt hook, not hard blocks.
// See ticket #109 / #114 for the design rationale.
process.exit(0);
