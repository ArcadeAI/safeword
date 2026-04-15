#!/usr/bin/env bun
// Safeword: Quality Gates - PostToolUse observer
// Counts LOC via git diff --stat HEAD, detects phase changes and TDD step transitions,
// updates quality-state.json. Fires on Edit|Write|MultiEdit|NotebookEdit|Bash

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import {
  getStateFilePath,
  LOC_THRESHOLD,
  META_PATHS,
  type QualityState,
} from './lib/quality-state.ts';

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
    locAtLastReview: 0,
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
    const excludes = META_PATHS.map(p => `':!${p}'`).join(' ');
    const diffStat = execSync(`git diff --stat HEAD -- . ${excludes}`, {
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

// LOC gate (only hard gate remaining — blast radius control)
if (state.locSinceCommit >= LOC_THRESHOLD) {
  state.gate = 'loc';
}

// Active ticket binding (phase/TDD step no longer cached — derived at read time)
if (editedFile.includes('.safeword-project/tickets/') && editedFile.endsWith('ticket.md')) {
  const fullPath = editedFile.startsWith('/')
    ? editedFile
    : nodePath.join(projectDirectory, editedFile);
  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf8');

    // Track active ticket
    const idMatch = content.match(/^id:\s*(\S+)/m);
    if (idMatch) {
      state.activeTicket = idMatch[1];
    }

    // Auto-clear binding when ticket reaches done or backlog
    const statusMatch = content.match(/^status:\s*(\S+)/m);
    const ticketStatus = statusMatch?.[1];
    if (ticketStatus === 'done' || ticketStatus === 'backlog') {
      state.activeTicket = null;
    }
  }
}

// Novel research reminder: flag when a learnings file is created
if (editedFile.includes('.safeword-project/learnings/') && editedFile.endsWith('.md')) {
  state.novelResearchReminder = true;
}

saveState(state);
process.exit(0);
