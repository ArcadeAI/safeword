#!/usr/bin/env bun
// Safeword: Quality Gates - PostToolUse observer
// Counts LOC via git diff --stat HEAD, detects phase changes and feat: commits,
// updates quality-state.json. Fires on Edit|Write|MultiEdit|NotebookEdit|Bash

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { LOC_THRESHOLD, type QualityState } from './lib/quality-state.ts';

interface HookInput {
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    notebook_path?: string;
  };
}

const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const stateFile = nodePath.join(projectDirectory, '.safeword-project', 'quality-state.json');

// Read hook input from stdin
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  process.exit(0);
}

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

function getLastCommitMessage(): string {
  try {
    return execSync('git log -1 --pretty=%s', {
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

  // Refactor gate: after a feat: commit during implement phase, require refactor
  if (state.lastKnownPhase === 'implement') {
    const lastMessage = getLastCommitMessage();
    if (lastMessage.startsWith('feat:')) {
      state.gate = 'refactor';
    }
  }
}

// Count LOC
state.locSinceCommit = countLoc();

// LOC gate
if (state.locSinceCommit >= LOC_THRESHOLD && state.gate !== 'refactor') {
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
      state.gate = `phase:${currentPhase}`;
      state.lastKnownPhase = currentPhase;
    }

    // Track active ticket
    const idMatch = content.match(/^id:\s*(\S+)/m);
    if (idMatch) {
      state.activeTicket = idMatch[1];
    }
  }
}

saveState(state);
process.exit(0);
