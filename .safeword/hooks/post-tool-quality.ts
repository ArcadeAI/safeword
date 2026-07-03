#!/usr/bin/env bun
// Safeword: Quality Gates - PostToolUse observer
// Counts LOC via git diff --stat HEAD, detects phase changes, and updates
// per-session quality state. Fires on Edit|Write|MultiEdit|NotebookEdit|Bash

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { isGitOperationInProgress } from './lib/git-operation.ts';
import { getQualityMessage } from './lib/quality.ts';
import {
  getStateFilePath,
  LOC_THRESHOLD,
  META_PATHS,
  type QualityState,
} from './lib/quality-state.ts';
import { shouldReviewPhase } from './lib/review-trigger.ts';
import {
  isNamespacePath,
  NAMESPACE_ROOT_DEFAULT,
  NAMESPACE_ROOT_LEGACY,
} from './lib/namespace-root.ts';
import { installCrashCapture } from './lib/self-report.ts';

installCrashCapture('post-tool-quality');

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
      return JSON.parse(readFileSync(stateFile, 'utf8'));
    } catch {
      // Corrupted file — reinitialize
    }
  }
  return {
    locSinceCommit: 0,
    lastCommitHash: '',
    activeTicket: null,
    gate: null,
    recentFailures: [],
    incrementedPatterns: [],
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
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function countLoc(): number {
  try {
    // execFileSync (no shell): pathspecs are args, so no shell-quoting needed
    // (`:!path`, not the shell-escaped `':!path'`).
    const excludes = META_PATHS.map(p => `:!${p}`);
    const diffStat = execFileSync('git', ['diff', '--stat', 'HEAD', '--', '.', ...excludes], {
      cwd: projectDirectory,
      encoding: 'utf8',
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

// LOC gate (only hard gate remaining — blast radius control). Stands down while
// a git merge/rebase/cherry-pick/revert is in progress: those incoming lines are
// not agent edits and must not block conflict resolution (ticket MT27QG).
if (state.gate === 'loc' && state.locSinceCommit < LOC_THRESHOLD) {
  state.gate = null;
}
if (state.locSinceCommit >= LOC_THRESHOLD && !isGitOperationInProgress(projectDirectory)) {
  state.gate = 'loc';
}

// Quality review surfaced as additionalContext when a phase boundary is crossed.
// Implement-step TDD reviews still happen as internal self-checks, but quiet
// implement mode keeps ordinary RED/GREEN/REFACTOR progress out of chat.
let reviewMessage: string | null = null;

// `<namespace root>/tickets/<folder>/…` → absolute path of that folder's
// ticket.md. Anchored on the same roots isNamespacePath accepts; a file not
// nested inside a ticket folder (e.g. `tickets/foo.md`) yields undefined, and
// `tickets/completed/<f>/…` resolves to the absent `tickets/completed/ticket.md`.
const escapedNamespaceRoots = [NAMESPACE_ROOT_DEFAULT, NAMESPACE_ROOT_LEGACY]
  .map(root => root.replaceAll('.', String.raw`\.`))
  .join('|');
const TICKET_FOLDER_PATTERN = new RegExp(`(?:^|/)(?:${escapedNamespaceRoots})/tickets/[^/]+/`);

function boundTicketFileForArtifact(filePath: string): string | undefined {
  const match = TICKET_FOLDER_PATTERN.exec(filePath);
  if (!match) return undefined;
  const ticketFile = `${filePath.slice(0, match.index + match[0].length)}ticket.md`;
  return ticketFile.startsWith('/') ? ticketFile : nodePath.join(projectDirectory, ticketFile);
}

// One `field: value` line from ticket.md frontmatter (same shape getTicketInfo
// parses in lib/active-ticket.ts).
function frontmatterField(content: string, field: string): string | undefined {
  return content.match(new RegExp(`^${field}:\\s*(\\S+)`, 'm'))?.[1];
}

// Active ticket binding (phase/TDD step no longer cached — derived at read time)
if (isNamespacePath(editedFile, 'tickets/') && editedFile.endsWith('ticket.md')) {
  const fullPath = editedFile.startsWith('/')
    ? editedFile
    : nodePath.join(projectDirectory, editedFile);
  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf8');

    // Track active ticket
    const ticketId = frontmatterField(content, 'id');
    if (ticketId !== undefined) {
      state.activeTicket = ticketId;
    }

    // Auto-clear binding when ticket reaches done or backlog
    const ticketStatus = frontmatterField(content, 'status');
    if (ticketStatus === 'done' || ticketStatus === 'backlog') {
      state.activeTicket = null;
    }

    // Per-phase review (enter-semantics, deduped). Fires on the first edit that
    // brings the ticket into an un-reviewed phase — autonomous-safe, since it
    // does not wait for a Stop. The Stop backstop covers non-edit phase bumps.
    const phase = frontmatterField(content, 'phase');
    if (shouldReviewPhase(phase, state.lastReviewedPhase)) {
      reviewMessage = getQualityMessage(phase);
      state.lastReviewedPhase = phase;
    }
  }
} else if (isNamespacePath(editedFile, 'tickets/') && editedFile.endsWith('.md')) {
  // Broadened binding write-site (#630): a session resuming an in_progress
  // ticket usually edits its artifacts (spec.md, test-definitions.md, …)
  // without touching ticket.md, so artifact edits must also bind — otherwise
  // write-review-stamp.ts sees no session ticket and hard-fails whenever more
  // than one ticket is in_progress. The folder's ticket.md carries the id.
  // Binding demands status: in_progress — the full vocabulary (done, cancelled,
  // superseded, wontfix, blocked, …) must neither bind nor steal the binding;
  // an explicit non-active status only clears a binding to that same ticket, so
  // annotating an archived ticket cannot unbind the session from its real one.
  // Epics never bind (the stamp helper's in_progress scan excludes them). The
  // per-phase review trigger deliberately stays ticket.md-scoped, and a custom
  // paths.projectRoot shares isNamespacePath's default/legacy-root-only limit.
  const ticketFile = boundTicketFileForArtifact(editedFile);
  if (ticketFile !== undefined && existsSync(ticketFile)) {
    const content = readFileSync(ticketFile, 'utf8');
    const id = frontmatterField(content, 'id');
    const status = frontmatterField(content, 'status');
    const type = frontmatterField(content, 'type');
    if (id !== undefined) {
      if (status === 'in_progress') {
        if (type !== 'epic') state.activeTicket = id;
      } else if (status !== undefined && state.activeTicket === id) {
        state.activeTicket = null;
      }
    }
  }
}

// Novel-claim nudge: append the edited learnings file to the per-session
// pending set. Per-fingerprint dedup — if we've already armed for this file
// this session (whether pending or acknowledged), don't re-arm. Monotonic
// append-only state replaces the prior single-bit boolean (ticket 4N5Y28).
if (isNamespacePath(editedFile, 'learnings/') && editedFile.endsWith('.md')) {
  state.learningsNudgesPending ??= [];
  state.learningsNudgesAcknowledged ??= [];
  const alreadyArmed =
    state.learningsNudgesPending.includes(editedFile) ||
    state.learningsNudgesAcknowledged.includes(editedFile);
  if (!alreadyArmed) {
    state.learningsNudgesPending.push(editedFile);
  }
}

saveState(state);

if (reviewMessage) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: reviewMessage },
    }),
  );
}
process.exit(0);
