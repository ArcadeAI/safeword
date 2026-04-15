#!/usr/bin/env bun
// Safeword: Re-inject active ticket context after compaction
// Fires on SessionStart(compact) — outputs to stdout for Claude's context

import { existsSync, readFileSync } from 'node:fs';

import { getTicketInfo } from './lib/active-ticket.ts';
import { getStateFilePath } from './lib/quality-state.ts';

interface HookInput {
  session_id?: string;
}

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const ticketsDir = `${projectDir}/.safeword-project/tickets`;

// Read hook input from stdin for session_id
let input: HookInput;
try {
  input = await Bun.stdin.json();
} catch {
  input = {};
}

// Read per-session state file (not legacy shared file)
const stateFile = getStateFilePath(projectDir, input.session_id);

if (!existsSync(stateFile)) {
  process.exit(0);
}

let state: { activeTicket: string | null; gate: string | null };
try {
  state = JSON.parse(readFileSync(stateFile, 'utf8'));
} catch {
  process.exit(0);
}

if (!state.activeTicket) {
  process.exit(0);
}

// Derive phase from ticket file (not cache) — with freshness check
const ticketInfo = getTicketInfo(projectDir, state.activeTicket);

if (!ticketInfo.folder || (ticketInfo.status && ticketInfo.status !== 'in_progress')) {
  // Ticket missing or no longer active — skip context injection
  process.exit(0);
}

// Read ticket content for title and goal
let ticketContent = '';
try {
  const ticketPath = `${ticketsDir}/${ticketInfo.folder}/ticket.md`;
  if (existsSync(ticketPath)) {
    ticketContent = readFileSync(ticketPath, 'utf8');
  }
} catch {
  process.exit(0);
}

if (!ticketContent) {
  process.exit(0);
}

// Extract title and goal
const titleMatch = ticketContent.match(/^#\s+(.+)/m);
const goalMatch = ticketContent.match(/\*\*Goal:\*\*\s*(.+)/m);

const title = titleMatch?.[1] ?? ticketInfo.folder;
const goal = goalMatch?.[1] ?? '';
const phase = ticketInfo.phase ?? 'unknown';
const type = ticketInfo.type ?? 'task';
const gate = state.gate ?? 'none';

const lines = [
  `SAFEWORD Context (restored after compaction):`,
  `Ticket: ${state.activeTicket} — ${title}`,
  `Type: ${type} | Phase: ${phase} | Gate: ${gate}`,
];
if (goal) {
  lines.push(`Goal: ${goal}`);
}
lines.push(`Re-read .safeword-project/tickets/${ticketInfo.folder}/ticket.md for full context.`);

console.log(lines.join('\n'));
