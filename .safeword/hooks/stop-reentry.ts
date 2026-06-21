#!/usr/bin/env bun
/**
 * Stop hook: append a single re-entry brief line to <namespace-root>/re-entry.md.
 *
 * Ticket 645W8H. Slice 1 walking skeleton.
 *
 * Line shape: `<ISO-timestamp> <session_id> ticket=<id>/<phase> Next: <imperative>`
 * All deterministic fields are hook-sourced; only the Next: imperative comes
 * from the agent's final assistant message (regex on the LAST `**Next:**`
 * occurrence). POSIX append; single-line writes are atomic under PIPE_BUF.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getTicketInfo } from './lib/active-ticket';
import { readSessionState } from './lib/quality-state.ts';
import { resolveProjectRoot } from './lib/re-entry';
import { resolveNamespaceRoot } from './lib/namespace-root.ts';

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
}

interface ContentItem {
  type: string;
  text?: string;
}

interface TranscriptEntry {
  type?: string;
  message?: { role?: string; content?: ContentItem[] };
}

function extractLastNextImperative(text: string): string | null {
  const lines = text.split('\n');
  for (let index = lines.length - 1; index >= 0; index--) {
    const match = /^\*\*Next:\*\*\s+(.+)$/.exec(lines[index].trim());
    if (match) {
      const imperative = match[1].trim();
      return imperative.length > 0 ? imperative : null;
    }
  }
  return null;
}

/**
 * The session's bound ticket id, from the per-session quality-state
 * (`quality-state-<sessionId>.json` `activeTicket`) — set when an edit touches a
 * ticket.md, auto-cleared when the ticket reaches done/backlog. Returns null when
 * the session never bound a ticket (or state is unreadable).
 */
function readSessionTicketId(projectDirectory: string, sessionId: string): string | null {
  return readSessionState(projectDirectory, sessionId)?.activeTicket ?? null;
}

/**
 * The re-entry brief records what THIS session worked on, so the ticket tag comes
 * from the per-session binding — NOT a global "most recent in_progress ticket"
 * scan, which surfaces an unrelated backlog ticket whenever the session has no
 * bound ticket (issue #274). There is deliberately no global fallback: an unbound
 * session is honestly `∅/freeform`.
 */
function resolveTicketField(projectDirectory: string, sessionId: string): string {
  const ticketId = readSessionTicketId(projectDirectory, sessionId);
  if (!ticketId) return 'ticket=∅/freeform';
  const { phase } = getTicketInfo(projectDirectory, ticketId);
  if (!phase) return 'ticket=∅/freeform';
  return `ticket=${ticketId}/${phase}`;
}

function readLastAssistantText(transcriptPath: string): string {
  const raw = readFileSync(transcriptPath, 'utf8').trim();
  if (raw.length === 0) return '';
  const lines = raw.split('\n');
  for (let index = lines.length - 1; index >= 0; index--) {
    try {
      const entry = JSON.parse(lines[index]) as TranscriptEntry;
      if (entry.type === 'assistant' && entry.message?.content) {
        return entry.message.content
          .filter(c => c.type === 'text' && typeof c.text === 'string')
          .map(c => c.text as string)
          .join('\n');
      }
    } catch {
      // Skip malformed JSONL lines silently.
    }
  }
  return '';
}

async function main(): Promise<void> {
  const stdinText = await new Response(Bun.stdin.stream()).text();
  let input: HookInput;
  try {
    input = JSON.parse(stdinText) as HookInput;
  } catch {
    return;
  }

  const { session_id, transcript_path, cwd } = input;
  if (!session_id || !transcript_path || !cwd) return;

  // Claude Code passes input.cwd = the session's current working directory,
  // which can drift into a subdirectory. Resolve the real project root so we
  // never write to a stray nested `.safeword-project/`. Bail silently if we
  // can't find a git repo to anchor to.
  const projectRoot = resolveProjectRoot(cwd);
  if (!projectRoot) return;

  const assistantText = readLastAssistantText(transcript_path);
  if (!assistantText) return;

  const imperative = extractLastNextImperative(assistantText);
  if (!imperative) return;

  const ticketField = resolveTicketField(projectRoot, session_id);

  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${session_id} ${ticketField} Next: ${imperative}\n`;

  const projectDirectory = join(resolveNamespaceRoot(projectRoot));
  if (!existsSync(projectDirectory)) {
    mkdirSync(projectDirectory, { recursive: true });
  }
  appendFileSync(join(projectDirectory, 're-entry.md'), line);
}

main().catch((error: unknown) => {
  process.stderr.write(`stop-reentry: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
