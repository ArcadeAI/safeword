#!/usr/bin/env bun
/**
 * Stop hook: append a single re-entry brief line to .safeword-project/re-entry.md.
 *
 * Ticket 645W8H. Slice 1 walking skeleton — currently does nothing.
 *
 * Reads stdin (session_id, transcript_path, cwd) from Claude Code's hook input.
 * Will extract the last `**Next:** ...` line from the last assistant message in
 * the transcript and append a canonical log entry with all deterministic fields
 * (timestamp, session_id, ticket=id/phase) sourced from the hook itself.
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
  process.stderr.write(`stop-reentry: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
