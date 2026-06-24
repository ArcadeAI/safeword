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
const folder = active.folder ?? '';

// Parity with the Claude-side gate (pre-tool-quality.ts): only FEATURES at the
// `implement` phase require test-definitions.md. Tasks and patches are exempt
// (per #126 — their sizing boundary makes them lighter), and other phases are
// not gated here. Mis-scoping this would block normal task/patch work on every
// prompt once the ticket reaches a later phase.
const isFeatureImplement = active.type === 'feature' && active.phase === 'implement';
const hasDefinitions = findTestDefinitions(process.cwd(), folder);

if (isFeatureImplement && !hasDefinitions) {
  const msg =
    'Feature at implement phase requires test-definitions.md before writing application code. ' +
    `Create test-definitions.md in .project/tickets/${folder}/ with RED/GREEN/REFACTOR scenarios, then resubmit.`;
  const out: BeforeSubmitOutput = { continue: false, user_message: msg };
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
}

// Allow — explicit per Cursor's documented output contract ({ continue: true }).
const allow: BeforeSubmitOutput = { continue: true };
process.stdout.write(JSON.stringify(allow) + '\n');
process.exit(0);
