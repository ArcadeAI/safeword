#!/usr/bin/env bun
/**
 * Status line: surface the latest `Next:` for the current session.
 *
 * Ticket 645W8H. Slice 3.
 *
 * Claude Code runs a status-line script with session JSON on stdin and
 * renders whatever it prints at the bottom of the editor. This script
 * reads `.safeword-project/re-entry.md`, finds the most recent entry
 * for the current session_id, and prints `Next: <imperative>`. When a
 * dirty-file conflict exists with another session, the line is
 * prepended with `⚠️ conflict: <file>` (scenarios 8.2 onward).
 *
 * Not wired into settings.json automatically — Claude Code's
 * `statusLine` config slot is single-valued; auto-installing would
 * clobber a user's existing status-line. The user opts in by setting
 * their `statusLine.command` to `bun .safeword/statusline/reentry.ts`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface StatusLineInput {
  session_id?: string;
  cwd?: string;
}

interface Entry {
  timestamp: string;
  sessionId: string;
  ticket: string;
  nextImperative: string;
}

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

async function main(): Promise<void> {
  const stdinText = await new Response(Bun.stdin.stream()).text();
  let input: StatusLineInput;
  try {
    input = JSON.parse(stdinText) as StatusLineInput;
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

  if (entries.length === 0) return;

  const latest = entries[entries.length - 1];
  process.stdout.write(`Next: ${latest.nextImperative}`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `statusline-reentry: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
