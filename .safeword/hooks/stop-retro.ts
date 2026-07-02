#!/usr/bin/env bun
// Safeword: INVISIBLE retro auto-trigger (ticket 7D8PJP; supersedes the FTCQGD nudge).
//
// At a Stop, if this session is SUBSTANTIAL and hasn't run yet, run the retro
// retrospective entirely OUT OF BAND — a synchronous, isolated `safeword retro
// --auto-extract` (which itself launches a headless `claude -p`) — and emit
// NOTHING to the conversation. There is NO `additionalContext`: the user's
// running session is never hijacked. The recursion guard (decideRetroRun checks
// SAFEWORD_RETRO_CHILD) stops the headless child from re-firing retro.
//
// Stop-anchored (NOT SessionEnd): fires while the session is alive and the
// transcript is readable; SessionEnd is killed before async work finishes in
// cloud. Synchronous (spawnSync) so the work completes before container reclaim —
// detached survival past session end is undocumented/unreliable. The once-per-
// session sentinel keeps it to one run per session. Best-effort: never throws,
// never blocks Stop.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import nodePath from 'node:path';
import process from 'node:process';

import { retroChildArgs, RETRO_EXTRACT_CMD_ENV } from './lib/retro-extract.ts';
import { decideRetroRun } from './lib/retro-trigger.ts';
import { readSelfReportConfig } from './lib/self-report.ts';

interface HookInput {
  session_id?: string;
  transcript_path?: string;
}

/**
 * The command that runs the extraction CLI. A `SAFEWORD_RETRO_EXTRACT_CMD`
 * override short-circuits resolution (test/advanced seam). Otherwise prefer the
 * dogfood local CLI, else `bunx safeword@latest`.
 */
function resolveExtractCommand(
  projectDirectory: string,
  decision: { transcriptPath: string; windowStart: number; sessionId: string },
): [string, string[]] {
  const override = process.env[RETRO_EXTRACT_CMD_ENV];
  if (override && override.length > 0) return [override, []];
  const retroArgs = retroChildArgs(decision);
  const localCli = nodePath.join(projectDirectory, 'packages/cli/src/cli.ts');
  return existsSync(localCli)
    ? ['bun', [localCli, ...retroArgs]]
    : ['bunx', ['safeword@latest', ...retroArgs]];
}

async function main(): Promise<void> {
  let input: HookInput;
  try {
    input = await Bun.stdin.json();
  } catch {
    return; // no stdin / not JSON — nothing to do
  }

  const projectDirectory = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  // Reuse the self-report surfacing toggle (the same "act on a safeword signal at
  // Stop" switch); when off, do nothing.
  if (!readSelfReportConfig(projectDirectory).surface) return;

  const decision = decideRetroRun(input, { env: process.env });
  if (!decision) return; // not substantial / already ran / retro child → silent

  // Run extraction + filing out of band, synchronously, with NO conversation
  // output. Failures are swallowed here (the CLI also fail-opens internally).
  const [command, args] = resolveExtractCommand(projectDirectory, decision);
  spawnSync(command, args, { cwd: projectDirectory, stdio: 'ignore', timeout: 300_000 });
}

try {
  await main();
} catch {
  // Self-observation must never break Stop.
}
process.exit(0);
