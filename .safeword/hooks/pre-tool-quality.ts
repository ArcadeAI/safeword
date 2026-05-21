#!/usr/bin/env bun
// Safeword: Quality Gates - PreToolUse enforcer
// Two-purpose: LOC gate (blast radius control) + artifact prerequisite check
// Fires on Edit|Write|MultiEdit|NotebookEdit

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { getTicketInfo } from './lib/active-ticket.ts';
import { parseFrontmatter } from './lib/hierarchy.ts';
import {
  classifyAnnotation,
  isValidSkipReason,
  parseCheckboxAnnotation,
} from './lib/parse-annotation.ts';
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
    old_string?: string;
    new_string?: string;
    content?: string;
    edits?: Array<{ old_string?: string; new_string?: string }>;
  };
}

interface CheckboxTransition {
  step: string;
  annotation: string;
}

/**
 * Find every checkbox line that transitioned from `[ ] STEP` to `[x] STEP <annotation>`
 * in this edit. Aligned by line index — works for Edit (old_string / new_string are
 * local replacement regions), Write (old = disk contents, new = full new content),
 * and MultiEdit (each edit treated as Edit). If lines don't align (e.g. Write that
 * reorders sections), some transitions may be missed; done-gate is the final arbiter.
 */
function findTransitionsByLineIndex(oldText: string, newText: string): CheckboxTransition[] {
  const transitions: CheckboxTransition[] = [];
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const newLine = newLines[i];
    if (newLine === undefined) continue;
    const newParsed = parseCheckboxAnnotation(newLine);
    if (!newParsed || !newParsed.checked) continue;
    const oldLine = oldLines[i];
    if (oldLine === undefined) continue;
    const oldParsed = parseCheckboxAnnotation(oldLine);
    if (oldParsed && !oldParsed.checked && oldParsed.step === newParsed.step) {
      transitions.push({ step: newParsed.step, annotation: newParsed.annotation });
    }
  }
  return transitions;
}

function collectNewTransitions(hookInput: HookInput, filePath: string): CheckboxTransition[] {
  const toolInput = hookInput.tool_input ?? {};
  const toolName = hookInput.tool_name ?? '';

  if (toolName === 'Edit') {
    const oldString = toolInput.old_string ?? '';
    const newString = toolInput.new_string ?? '';
    return findTransitionsByLineIndex(oldString, newString);
  }

  if (toolName === 'Write') {
    const oldText = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
    const newText = toolInput.content ?? '';
    return findTransitionsByLineIndex(oldText, newText);
  }

  if (toolName === 'MultiEdit') {
    const edits = toolInput.edits ?? [];
    return edits.flatMap(edit =>
      findTransitionsByLineIndex(edit.old_string ?? '', edit.new_string ?? ''),
    );
  }

  return [];
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

  // Phase gate: must have advanced past intake before writing scenarios.
  if (meta.phase === 'intake') {
    deny(
      'Ticket is still in intake phase. Update phase to define-behavior before writing scenarios.',
      'Complete understanding, then set phase: define-behavior in ticket frontmatter.',
    );
  }

  // Dimension artifact gate: features require dimensions.md before test-definitions.md.
  // Natural gate — next step's input doesn't exist if prior step was skipped.
  if (meta.type === 'feature') {
    const dimensionsFile = nodePath.join(ticketDirectory, 'dimensions.md');
    if (!existsSync(dimensionsFile)) {
      deny(
        'Features require dimensions.md before test-definitions.md. Document behavioral dimensions and partitions first.',
        'Create dimensions.md with a dimension table, then create test-definitions.md.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// SHA-or-skip annotation gate (ticket J7VBGJ, Rule 1)
// On Edit/Write/MultiEdit of test-definitions.md, any [ ] → [x] transition
// must carry either a SHA (`- [x] RED abc1234`) or `skip: <non-empty reason>`.
// Pre-existing [x] without annotation is silently allowed (forward-looking).
// ---------------------------------------------------------------------------

if (
  editedFile.endsWith('test-definitions.md') &&
  editedFile.includes('.safeword-project/tickets/')
) {
  const transitions = collectNewTransitions(input, editedFile);
  for (const transition of transitions) {
    if (transition.annotation === '') {
      deny(
        `Cannot mark "[x] ${transition.step}" without an annotation. Use "${transition.step} <sha>" or "${transition.step} skip: <non-empty reason>".`,
        'Every checkbox transition needs a commit SHA (proof of the work) or a deliberate skip with reason (auditable omission).',
      );
    }
    const kind = classifyAnnotation(transition.annotation);
    if (kind.kind === 'skip' && !isValidSkipReason(kind.reason)) {
      deny(
        `Cannot mark "[x] ${transition.step}" with empty skip reason. Use "skip: <non-empty reason>".`,
        'The text after "skip:" must not be empty or whitespace-only. A real reason is the audit trail.',
      );
    }
  }
}

// Never block edits to tooling/meta files — these are not application code.
// (After artifact prerequisite check, which targets files in .safeword-project/)
if (META_PATHS.some(p => editedFile.includes(p))) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Shared state read — used by both implement phase gate and LOC gate below.
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

// ---------------------------------------------------------------------------
// Implement phase gate: features need test-definitions.md before app code (#128)
// Tasks are exempt (per #126 retro — sizing boundary makes tasks lighter).
// Reads ticket state directly from disk (per #124 — no cached phase).
// ---------------------------------------------------------------------------

if (state.activeTicket) {
  const ticketInfo = getTicketInfo(projectDirectory, state.activeTicket);

  if (ticketInfo.type === 'feature' && ticketInfo.phase === 'implement' && ticketInfo.folder) {
    const testDefinitionsPath = nodePath.join(
      projectDirectory,
      '.safeword-project',
      'tickets',
      ticketInfo.folder,
      'test-definitions.md',
    );

    if (!existsSync(testDefinitionsPath)) {
      recordFailure(projectDirectory, input.session_id, 'implement-without-test-definitions');
      deny(
        'Feature at implement phase requires test-definitions.md before writing application code. Create test-definitions.md with scenarios first.',
        'Write scenarios (RED/GREEN/REFACTOR checkboxes) before implementation. Tasks are exempt from this gate.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// LOC gate: blast radius control — commit every ~400 LOC
// ---------------------------------------------------------------------------

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

// Remaining gates (tdd:*, phase:*) are reminders via prompt hook, not hard blocks.
// Exception: implement-without-test-definitions gate above (#128). See #109 / #114.
process.exit(0);
