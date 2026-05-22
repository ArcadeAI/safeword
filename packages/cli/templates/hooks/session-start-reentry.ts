#!/usr/bin/env bun
/**
 * SessionStart hook: inject the re-entry brief into Claude's context.
 *
 * Ticket 645W8H. Slice 2.
 *
 * Reads `.safeword-project/re-entry.md`, filters by the current session_id,
 * and emits the last 3 matching entries via additionalContext for Claude
 * recall (silent — not shown in chat). The status-line script (Slice 3)
 * is the user-facing surface; this is the agent-facing surface.
 *
 * RED phase: stub. Behaviour is missing.
 */

async function main(): Promise<void> {
  // Drain stdin so the parent process doesn't block on the pipe.
  await new Response(Bun.stdin.stream()).text();
  // Behaviour deliberately absent — the failing test should drive the GREEN
  // implementation in the next step.
}

main().catch((error: unknown) => {
  process.stderr.write(
    `session-start-reentry: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
