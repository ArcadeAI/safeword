#!/usr/bin/env bun
/**
 * Status line: surface the latest `**Next:**` for the current session.
 *
 * Ticket 645W8H. Slice 3.
 *
 * Claude Code runs a status-line script with session JSON on stdin and renders
 * whatever it prints at the bottom of the editor. This script reads
 * `.safeword-project/re-entry.md`, finds the most recent entry for the current
 * session_id, and prints `Next: <imperative>` for the user to glance at.
 *
 * RED phase: stub. Behaviour is missing.
 */

async function main(): Promise<void> {
  await new Response(Bun.stdin.stream()).text();
  // Behaviour deliberately absent — the failing test should drive GREEN.
}

main().catch((error: unknown) => {
  process.stderr.write(
    `statusline-reentry: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
