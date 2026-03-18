#!/usr/bin/env bun
// Safeword: Re-inject active ticket context after compaction
// Fires on SessionStart(compact) — outputs to stdout for Claude's context

import { existsSync, readFileSync, readdirSync } from 'node:fs';

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const stateFile = `${projectDir}/.safeword-project/quality-state.json`;
const ticketsDir = `${projectDir}/.safeword-project/tickets`;

if (!existsSync(stateFile)) {
  process.exit(0);
}

let state: { activeTicket: string | null; lastKnownPhase: string | null; gate: string | null };
try {
  state = JSON.parse(readFileSync(stateFile, 'utf8'));
} catch {
  process.exit(0);
}

if (!state.activeTicket) {
  process.exit(0);
}

// Find the ticket folder matching the active ticket ID
let ticketFolder = '';
let ticketContent = '';
try {
  const folders = readdirSync(ticketsDir);
  for (const folder of folders) {
    if (folder.startsWith(`${state.activeTicket}-`)) {
      const ticketPath = `${ticketsDir}/${folder}/ticket.md`;
      if (existsSync(ticketPath)) {
        ticketFolder = folder;
        ticketContent = readFileSync(ticketPath, 'utf8');
      }
      break;
    }
  }
} catch {
  process.exit(0);
}

if (!ticketContent) {
  // Minimal output with just state info
  console.log(
    `SAFEWORD: Active ticket ${state.activeTicket} (phase: ${state.lastKnownPhase ?? 'unknown'})`,
  );
  process.exit(0);
}

// Extract title (first # heading) and goal
const titleMatch = ticketContent.match(/^#\s+(.+)/m);
const goalMatch = ticketContent.match(/\*\*Goal:\*\*\s*(.+)/m);
const typeMatch = ticketContent.match(/^type:\s*(\S+)/m);

const title = titleMatch?.[1] ?? ticketFolder;
const goal = goalMatch?.[1] ?? '';
const type = typeMatch?.[1] ?? 'task';
const phase = state.lastKnownPhase ?? 'unknown';
const gate = state.gate ?? 'none';

const lines = [
  `SAFEWORD Context (restored after compaction):`,
  `Ticket: ${state.activeTicket} — ${title}`,
  `Type: ${type} | Phase: ${phase} | Gate: ${gate}`,
];
if (goal) {
  lines.push(`Goal: ${goal}`);
}
lines.push(`Re-read .safeword-project/tickets/${ticketFolder}/ticket.md for full context.`);

console.log(lines.join('\n'));
