// Retro draft spool (ticket BNGK9W — cloud filing transport).
//
// The invisible retro extracts + sanitizes findings into code-assembled drafts,
// then files them via the REST transport. In a Claude cloud container that REST
// call 401s (GITHUB_TOKEN is the platform's, not a GitHub token; #568), so the
// drafts are LOST. This spool persists the POST-EGRESS drafts to disk so a filing
// failure doesn't lose them — the agent-filing path (PATH B) reads the spool and
// posts each draft verbatim via its inherited GitHub MCP, then marks them filed.
//
// Only the code-assembled draft ({signature, title, body, labels}) is written —
// it is already sanitized at egress, so no raw finding text reaches disk.
//
// Self-contained on purpose (imports only node:*): the CLI's `src/` imports it,
// AND the surfacing hook runs it under bun in a customer repo — the same shape as
// lib/self-report.ts. `SpooledDraft` is structurally the CLI's `RetroDraft`.

import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

/** The four code-assembled, post-egress fields — structurally the CLI's RetroDraft. */
export interface SpooledDraft {
  signature: string;
  title: string;
  body: string;
  labels: string[];
}

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
function toDraft(value: unknown): SpooledDraft | undefined {
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
export function readSpooledDrafts(projectDirectory: string, sessionId: string): SpooledDraft[] {
  let raw: string;
  try {
    raw = readFileSync(draftSpoolPath(projectDirectory, sessionId), 'utf8');
  } catch {
    return [];
  }
  const drafts: SpooledDraft[] = [];
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

/** Serialize one draft to its canonical spool line (only the four code-assembled fields). */
function draftLine(draft: SpooledDraft): string {
  return JSON.stringify({
    signature: draft.signature,
    title: draft.title,
    body: draft.body,
    labels: draft.labels,
  });
}

/**
 * Write `contents` to `file` atomically: write a pid-unique temp sibling, then
 * rename onto the target, so a concurrent reader sees the whole old or whole new
 * file — never a half-written one. Creates the parent dir. Throws on I/O error;
 * callers that must stay fail-open wrap it in their own try/catch. Shared by the
 * spool drain and the nudge marker (retro-nudge.ts).
 */
export function atomicWriteFile(file: string, contents: string): void {
  const temporary = `${file}.${process.pid}.tmp`;
  mkdirSync(nodePath.dirname(file), { recursive: true });
  writeFileSync(temporary, contents);
  renameSync(temporary, file);
}

/**
 * Drain the drafts whose signatures were just filed (by either transport) so they
 * neither re-nudge nor re-file. Rewrites the per-session spool minus the filed
 * signatures — a persisted removal, not an in-memory filter, so a fresh read no
 * longer yields them. Atomic (temp-write + rename) so a concurrent reader sees the
 * whole old or whole new file, never a half-written one. BEST-EFFORT — never
 * throws; on any error the spool is left as-is (a filed draft may re-nudge, which
 * the signature dedupe still catches — the safe direction).
 */
export function markDraftsFiled(
  projectDirectory: string,
  sessionId: string,
  filedSignatures: readonly string[],
): void {
  try {
    const filed = new Set(filedSignatures);
    const remaining = readSpooledDrafts(projectDirectory, sessionId).filter(
      draft => !filed.has(draft.signature),
    );
    const body =
      remaining.length > 0 ? `${remaining.map(draft => draftLine(draft)).join('\n')}\n` : '';
    atomicWriteFile(draftSpoolPath(projectDirectory, sessionId), body);
  } catch {
    // Self-observation must never break the host. Swallow.
  }
}

/** Posts one spooled draft to a tracker (the agent's GitHub MCP, or a REST client). */
export type DraftPoster = (draft: SpooledDraft) => Promise<void>;

/**
 * The agent filing seam (PATH B), as an EXECUTABLE REFERENCE-SPEC. In production the
 * cloud subagent files by reading the spool and calling its GitHub MCP directly,
 * guided by `guides/self-report-filing.md` — there is deliberately NO code caller
 * here (an LLM's MCP calls aren't a TS function). This function pins the contract
 * that guide describes in prose, so it can be tested: read the session spool, post
 * each draft's code-assembled body VERBATIM through `post` (mocked in tests), then
 * drain exactly the drafts that posted. A draft whose post throws stays spooled so a
 * later boundary re-nudges and it retries — findings are never dropped. Returns the
 * posted/failed counts. The spool already holds post-egress bodies, so "verbatim"
 * carries no un-sanitized text. (Covers done_when: the subagent posts each draft
 * verbatim — proven at the spool→transport seam, the MCP call mocked.)
 */
export async function fileSpooledDrafts(
  projectDirectory: string,
  sessionId: string,
  post: DraftPoster,
): Promise<{ posted: number; failed: number }> {
  const filed: string[] = [];
  let failed = 0;
  for (const draft of readSpooledDrafts(projectDirectory, sessionId)) {
    try {
      await post(draft);
      filed.push(draft.signature);
    } catch {
      failed += 1;
    }
  }
  markDraftsFiled(projectDirectory, sessionId, filed);
  return { posted: filed.length, failed };
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
  drafts: readonly SpooledDraft[],
): void {
  try {
    const existing = readSpooledDrafts(projectDirectory, sessionId).length;
    const room = MAX_DRAFTS_PER_SESSION - existing;
    if (room <= 0) return;
    const file = draftSpoolPath(projectDirectory, sessionId);
    mkdirSync(nodePath.dirname(file), { recursive: true });
    const lines = drafts.slice(0, room).map(draft => draftLine(draft));
    if (lines.length > 0) appendFileSync(file, `${lines.join('\n')}\n`);
  } catch {
    // Self-observation must never break the host. Swallow.
  }
}
