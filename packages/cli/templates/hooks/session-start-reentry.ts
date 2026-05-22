#!/usr/bin/env bun
/**
 * SessionStart hook: inject the re-entry brief into Claude's context.
 *
 * Ticket 645W8H. Slice 2.
 *
 * Reads `.safeword-project/re-entry.md`, filters entries to the current
 * session_id, and emits the last 3 matching lines via additionalContext
 * (silent — not shown in chat; for Claude recall when the user asks
 * "where were we?"). The status-line script (Slice 3) is the user-facing
 * surface.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface HookInput {
  session_id?: string;
  source?: 'startup' | 'resume' | 'clear' | 'compact';
  cwd?: string;
}

interface Entry {
  timestamp: string;
  sessionId: string;
  ticket: string;
  nextImperative: string;
}

// Canonical log line: `<ISO-ts> <session-id> ticket=<id>/<phase> Next: <imperative>`
const LINE_REGEX = /^(\S+)\s+(\S+)\s+(ticket=\S+)\s+Next:\s+(.+)$/;

function parseLogLine(line: string): Entry | null {
  const match = LINE_REGEX.exec(line.trim());
  if (!match) return null;
  return {
    timestamp: match[1],
    sessionId: match[2],
    ticket: match[3],
    nextImperative: match[4],
  };
}

function renderBrief(entries: Entry[]): string {
  const lines = entries.map(e => `- ${e.timestamp} [${e.ticket}] ${e.nextImperative}`);
  return `Re-entry brief — last ${entries.length} entries from this session:\n${lines.join('\n')}`;
}

async function main(): Promise<void> {
  const stdinText = await new Response(Bun.stdin.stream()).text();
  let input: HookInput;
  try {
    input = JSON.parse(stdinText) as HookInput;
  } catch {
    return;
  }

  const { session_id, cwd } = input;
  if (!session_id || !cwd) return;

  const logPath = join(cwd, '.safeword-project', 're-entry.md');
  if (!existsSync(logPath)) return;

  const content = readFileSync(logPath, 'utf8').trim();
  if (content.length === 0) return;

  const entries = content
    .split('\n')
    .map(parseLogLine)
    .filter((e): e is Entry => e !== null)
    .filter(e => e.sessionId === session_id);

  // Last 3 entries (already chronological — log is append-only).
  const lastThree = entries.slice(-3);
  if (lastThree.length === 0) return;

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: renderBrief(lastThree),
    },
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `session-start-reentry: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
