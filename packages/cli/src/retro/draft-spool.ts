// Retro draft spool (ticket BNGK9W — cloud filing transport, step 1).
//
// The invisible retro extracts + sanitizes findings into code-assembled drafts,
// then files them via the REST transport. In a Claude cloud container that REST
// call 401s (GITHUB_TOKEN is the platform's, not a GitHub token; #568), so the
// drafts are LOST. This spool persists the POST-EGRESS drafts to disk so a filing
// failure doesn't lose them — the agent-filing path (PATH B) reads the spool and
// posts each draft verbatim via its inherited GitHub MCP.
//
// Only the code-assembled draft ({signature, title, body, labels}) is written —
// it is already sanitized at egress, so no raw finding text reaches disk.

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import type { RetroDraft } from './draft.js';

/** Per-session spool cap — bounds a crash-looping or runaway session's disk use. */
const MAX_DRAFTS_PER_SESSION = 20;

/** Spool lives under the project's `.safeword/` so it travels with the install. */
const SPOOL_DIR = nodePath.join('.safeword', 'retro-drafts');

/** Collapse a session id to one safe filename component (no path escape). */
function spoolName(sessionId: string): string {
  return `${sessionId.replaceAll(/[^\w.-]/g, '_') || 'unknown'}.jsonl`;
}

/** Absolute path of the per-session retro-draft spool file. */
export function draftSpoolPath(projectDirectory: string, sessionId: string): string {
  return nodePath.join(projectDirectory, SPOOL_DIR, spoolName(sessionId));
}

/** A parsed spool line is a draft only when all four code-assembled fields are present. */
function toDraft(value: unknown): RetroDraft | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const { signature, title, body, labels } = record;
  if (
    typeof signature !== 'string' ||
    typeof title !== 'string' ||
    typeof body !== 'string' ||
    !Array.isArray(labels) ||
    !labels.every((label): label is string => typeof label === 'string')
  ) {
    return undefined;
  }
  return { signature, title, body, labels };
}

/**
 * Read the drafts spooled for one session, or `[]` when the spool is absent,
 * unreadable, or torn. Fail-open by construction — a partial/malformed line is
 * skipped, never thrown, so the filing path never crashes on a bad spool.
 */
export function readSpooledDrafts(projectDirectory: string, sessionId: string): RetroDraft[] {
  let raw: string;
  try {
    raw = readFileSync(draftSpoolPath(projectDirectory, sessionId), 'utf8');
  } catch {
    return [];
  }
  const drafts: RetroDraft[] = [];
  for (const line of raw.split('\n')) {
    if (line.trim().length === 0) continue;
    try {
      const draft = toDraft(JSON.parse(line));
      if (draft) drafts.push(draft);
    } catch {
      // skip a torn/malformed JSONL line
    }
  }
  return drafts;
}

/**
 * Append post-egress drafts to the session spool (writing ONLY the four
 * code-assembled fields). BEST-EFFORT — never throws, so a spool-write failure
 * can't break the out-of-band Stop path — and capped: once the session spool holds
 * `MAX_DRAFTS_PER_SESSION`, further drafts are dropped rather than growing unbounded.
 */
export function spoolDrafts(
  projectDirectory: string,
  sessionId: string,
  drafts: readonly RetroDraft[],
): void {
  try {
    const existing = readSpooledDrafts(projectDirectory, sessionId).length;
    const room = MAX_DRAFTS_PER_SESSION - existing;
    if (room <= 0) return;
    const file = draftSpoolPath(projectDirectory, sessionId);
    mkdirSync(nodePath.dirname(file), { recursive: true });
    const lines = drafts
      .slice(0, room)
      .map(d =>
        JSON.stringify({ signature: d.signature, title: d.title, body: d.body, labels: d.labels }),
      );
    if (lines.length > 0) appendFileSync(file, `${lines.join('\n')}\n`);
  } catch {
    // Self-observation must never break the host. Swallow.
  }
}
