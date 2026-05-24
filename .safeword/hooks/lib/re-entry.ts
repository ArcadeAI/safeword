/**
 * Shared pure functions for the re-entry brief (ticket 645W8H).
 *
 * Both `.safeword/hooks/session-start-reentry.ts` (Slice 2) and
 * `.safeword/statusline/reentry.ts` (Slice 3) parse the same canonical
 * log line and detect the same kind of dirty-file conflict between
 * concurrent Claude sessions. The functions here are pure (no stdin
 * reading, no stdout writing); the hook/script wrappers handle I/O.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

export interface Entry {
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

export function parseLogLine(line: string): Entry | null {
  const match = LINE_REGEX.exec(line.trim());
  if (!match) return null;
  return {
    timestamp: match[1],
    sessionId: match[2],
    ticket: match[3],
    nextImperative: match[4],
  };
}

export function listOtherSessionTranscripts(currentTranscriptPath: string): string[] {
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

export function readRecentEditedFiles(transcriptPath: string): string[] {
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

export function getDirtyFiles(cwd: string): string[] {
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

export function normalizeRelative(filePath: string, cwd: string): string {
  // Edit tool_use events typically use absolute paths; git status emits paths
  // relative to the repo root (== cwd here).
  if (filePath.startsWith(cwd)) {
    return relative(cwd, filePath);
  }
  return filePath;
}

/**
 * Resolve the project root reliably, regardless of where the session's cwd drifted.
 *
 * Claude Code passes `input.cwd` = the session's current working directory, which
 * is not necessarily the project root. Hooks that wrote `join(cwd, '.safeword-project')`
 * blindly would silently mkdirSync a bogus nested `.safeword-project/` inside whatever
 * subdir the session happened to be in (e.g. `<root>/.safeword-project/tickets/.safeword-project/`).
 *
 * Implementation: walk up from `cwd` looking for a `.git` marker. Pure (no subprocess),
 * preserves the cwd path form (matters on macOS where `git rev-parse --show-toplevel`
 * canonicalizes `/var/folders/...` symlinks to `/private/var/folders/...` and breaks
 * downstream `startsWith` comparisons against absolute paths captured by other code).
 *
 * Returns null when no `.git/` ancestor exists — caller bails silently rather than
 * write to a stray path. Note: we intentionally do NOT match on `.safeword-project/`
 * during the walk because the bogus nested directories created by the old code would
 * mislead the resolver.
 */
export function resolveProjectRoot(cwd: string): string | null {
  let current = resolve(cwd);
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function detectConflictFiles(cwd: string, transcriptPath: string | undefined): string[] {
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
