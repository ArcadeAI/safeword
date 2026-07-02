#!/usr/bin/env bun
// Safeword: Codex Stop adapter for one-shot continuation nudges.
//
// Codex Stop cannot hard-block completion. `decision: "block"` creates a new
// continuation prompt, so this adapter only delivers non-blocking advisories
// whose enforcement already lives elsewhere.

import { existsSync } from 'node:fs';

import { getActiveTicket } from '../lib/active-ticket.ts';
import { architectureDocumentNudgeForProject } from '../lib/architecture-document-nudge.ts';
import { readSessionActiveTicket } from '../lib/quality-state.ts';
import { resolveRunIdentity } from '../lib/run-identity.ts';
import { installCrashCapture } from '../lib/self-report.ts';

installCrashCapture('codex-stop', undefined, 'codex');

interface CodexStopInput {
  session_id?: string;
  turn_id?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
}

async function readInput(): Promise<CodexStopInput> {
  try {
    return JSON.parse(await Bun.stdin.text()) as CodexStopInput;
  } catch {
    return {};
  }
}

function isDonePhaseWork(projectDirectory: string, input: CodexStopInput): boolean {
  const runIdentity = resolveRunIdentity(input, { runtime: 'codex' });
  const ticket = readSessionActiveTicket(projectDirectory, runIdentity);
  if (ticket) {
    return ticket.status === 'in_progress' && ticket.phase === 'done';
  }

  return getActiveTicket(projectDirectory).phase === 'done';
}

const input = await readInput();
const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

if (input.stop_hook_active === true) process.exit(0);
if (!existsSync(`${projectDirectory}/.safeword`)) process.exit(0);
if (!isDonePhaseWork(projectDirectory, input)) process.exit(0);

const architectureNudge = architectureDocumentNudgeForProject(projectDirectory);
if (architectureNudge === null) process.exit(0);

console.log(
  JSON.stringify({
    decision: 'block',
    reason: architectureNudge,
  }),
);
