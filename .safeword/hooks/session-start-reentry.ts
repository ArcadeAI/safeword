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
 *
 * Also detects conflict: when another session's transcript has Edit/Write
 * tool calls on files that are currently dirty in `git status`, append a
 * warning line so the agent (and via Slice 3, the user) knows to step
 * lightly around those files.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

interface HookInput {
  session_id?: string;
  source?: 'startup' | 'resume' | 'clear' | 'compact';
  cwd?: string;
  transcript_path?: string;
}

interface Entry {
  timestamp: string;
  sessionId: string;
  ticket: string;
  nextImperative: string;
}

interface ToolUse {
  type: string;
  name?: string;
  input?: { file_path?: string };
}

interface TranscriptEntry {
  type?: string;
  message?: { role?: string; content?: ToolUse[] };
}

// Canonical log line: `<ISO-ts> <session-id> ticket=<id>/<phase> Next: <imperative>`
const LINE_REGEX = /^(\S+)\s+(\S+)\s+(ticket=\S+)\s+Next:\s+(.+)$/;
const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit']);
const RECENT_TURNS = 10;

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

function renderBrief(entries: Entry[], options: { fromAnotherSession?: boolean } = {}): string {
  const header = options.fromAnotherSession
    ? 'Re-entry brief — most recent entry (from another session):'
    : `Re-entry brief — last ${entries.length} entries from this session:`;
  const lines = entries.map(e => `- ${e.timestamp} [${e.ticket}] ${e.nextImperative}`);
  return `${header}\n${lines.join('\n')}`;
}

function listOtherSessionTranscripts(currentTranscriptPath: string): string[] {
  const directory = dirname(currentTranscriptPath);
  const currentBase = basename(currentTranscriptPath);
  try {
    return readdirSync(directory)
      .filter(name => name.endsWith('.jsonl') && name !== currentBase)
      .map(name => join(directory, name));
  } catch {
    return [];
  }
}

function readRecentEditedFiles(transcriptPath: string): string[] {
  const edited = new Set<string>();
  try {
    const raw = readFileSync(transcriptPath, 'utf8').trim();
    if (raw.length === 0) return [];
    const lines = raw.split('\n');
    // Scan the last RECENT_TURNS * 5 lines as a coarse upper bound — one assistant
    // turn often emits multiple tool-use events.
    for (const line of lines.slice(-RECENT_TURNS * 5)) {
      try {
        const entry = JSON.parse(line) as TranscriptEntry;
        if (entry.type !== 'assistant' || !entry.message?.content) continue;
        for (const item of entry.message.content) {
          if (item.type === 'tool_use' && item.name && EDIT_TOOL_NAMES.has(item.name)) {
            const filePath = item.input?.file_path;
            if (filePath) edited.add(filePath);
          }
        }
      } catch {
        // Skip malformed lines silently.
      }
    }
  } catch {
    // Transcript unreadable — no edits to report.
  }
  return [...edited];
}

function getDirtyFiles(cwd: string): string[] {
  try {
    const output = execSync('git status --porcelain', { cwd, encoding: 'utf8' });
    return output
      .split('\n')
      .map(line => line.slice(3).trim())
      .filter(line => line.length > 0);
  } catch {
    return [];
  }
}

function normalizeRelative(filePath: string, cwd: string): string {
  // Edit tool_use events typically use absolute paths; git status emits paths
  // relative to the repo root (== cwd here).
  if (filePath.startsWith(cwd)) {
    return relative(cwd, filePath);
  }
  return filePath;
}

function detectConflictFiles(cwd: string, transcriptPath: string | undefined): string[] {
  if (!transcriptPath) return [];
  const dirtyFiles = new Set(getDirtyFiles(cwd));
  if (dirtyFiles.size === 0) return [];
  const overlap = new Set<string>();
  for (const otherPath of listOtherSessionTranscripts(transcriptPath)) {
    for (const editedFile of readRecentEditedFiles(otherPath)) {
      const relativePath = normalizeRelative(editedFile, cwd);
      if (dirtyFiles.has(relativePath)) overlap.add(relativePath);
    }
  }
  return [...overlap];
}

function renderConflictWarning(files: string[]): string {
  if (files.length === 0) return '';
  const quoted = files.map(f => `\`${f}\``).join(', ');
  return `\n\n⚠️ Conflict: another session edited ${quoted} (still dirty in the working tree).`;
}

async function main(): Promise<void> {
  const stdinText = await new Response(Bun.stdin.stream()).text();
  let input: HookInput;
  try {
    input = JSON.parse(stdinText) as HookInput;
  } catch {
    return;
  }

  const { session_id, cwd, source, transcript_path } = input;
  if (!session_id || !cwd) return;

  const logPath = join(cwd, '.safeword-project', 're-entry.md');
  const logExists = existsSync(logPath);
  const content = logExists ? readFileSync(logPath, 'utf8').trim() : '';

  const allEntries = content
    .split('\n')
    .map(parseLogLine)
    .filter((e): e is Entry => e !== null);

  const currentEntries = allEntries.filter(e => e.sessionId === session_id);

  let briefBody = '';
  if (currentEntries.length > 0) {
    briefBody = renderBrief(currentEntries.slice(-3));
  } else if (source === 'startup' && allEntries.length > 0) {
    briefBody = renderBrief([allEntries[allEntries.length - 1]], { fromAnotherSession: true });
  }

  const conflictFiles = detectConflictFiles(cwd, transcript_path);
  const conflictWarning = renderConflictWarning(conflictFiles);

  // Nothing to inject in either channel → stay silent.
  if (briefBody.length === 0 && conflictWarning.length === 0) return;

  const output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `${briefBody}${conflictWarning}`,
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
