#!/usr/bin/env bun
// Safeword: Cursor beforeSubmitPrompt gate
// Hard-blocks prompt submission when the active ticket's phase precondition fails.
// Cursor contract: input via stdin JSON, output {continue, user_message} only.
// No context injection is possible on this hook (docs confirmed).

import { existsSync } from 'node:fs';
import nodePath from 'node:path';

import { getActiveTicket } from '../lib/active-ticket.ts';
import { resolveNamespaceRoot } from '../lib/namespace-root.ts';

interface CursorInput {
  prompt?: string;
  attachments?: Array<{ type: string; file_path?: string }>;
  workspace_roots?: string[];
}

interface BeforeSubmitOutput {
  continue: boolean;
  user_message?: string;
}

async function readInput(): Promise<CursorInput> {
  try {
    return (await Bun.stdin.json()) as CursorInput;
  } catch {
    return {};
  }
}

function findTestDefinitions(projectDir: string, ticketFolder: string): boolean {
  if (!ticketFolder) return true;
  const path = nodePath.join(
    resolveNamespaceRoot(projectDir),
    'tickets',
    ticketFolder,
    'test-definitions.md',
  );
  return existsSync(path);
}

const input = await readInput();
const workspace = input.workspace_roots?.[0];

if (workspace) {
  process.chdir(workspace);
}

if (!existsSync('.safeword')) {
  process.exit(0);
}

const active = getActiveTicket(process.cwd());
const phase = active.phase;
const folder = active.folder ?? '';

const needsDefinitions = phase === 'implement' || phase === 'verify' || phase === 'done';
const hasDefinitions = findTestDefinitions(process.cwd(), folder);

if (needsDefinitions && !hasDefinitions) {
  const msg =
    `Phase "${phase}" requires test-definitions.md before any implementation or verification work. ` +
    `Create the file in .project/tickets/${folder}/ then resubmit.`;
  const out: BeforeSubmitOutput = { continue: false, user_message: msg };
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
}

// Allow
process.exit(0);
