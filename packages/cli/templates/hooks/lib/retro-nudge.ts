// Retro cloud-filing nudge decision (ticket BNGK9W, issue #568).
//
// PATH B: in a cloud container the retro's REST transport 401s, so the sanitized
// drafts stay SPOOLED (lib/retro-draft-spool.ts) and the live agent must file them
// via its inherited GitHub MCP. The async Stop hook that spools them is backgrounded
// and surfaces nothing (ZFGWS1), so a SEPARATE surfacing-capable boundary hook
// (SessionStart / UserPromptSubmit) checks for unfiled drafts and emits ONE factual
// line — a system-reminder the model reads, invisible to the user in chat.
//
// Muted by design (user steer 2026-07-01): the line is a STATEMENT, never an
// imperative — imperative phrasing trips Claude's prompt-injection defenses and gets
// surfaced verbatim instead of acted on (https://code.claude.com/docs/en/hooks).
//
// Fires ONCE per unfiled batch: a persisted, signature-keyed marker is compared to
// the current unfiled set on every (fresh) evaluation, so an unchanged batch stays
// silent while a batch that GAINS a draft nudges again. Self-contained (node:* only)
// so both the CLI and the customer-repo hook can run it — like lib/self-report.ts.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { draftSpoolPath, readSpooledDrafts } from './retro-draft-spool.js';

/** The per-session marker recording the last unfiled batch already surfaced. */
function nudgeMarkerPath(projectDirectory: string, sessionId: string): string {
  return draftSpoolPath(projectDirectory, sessionId).replace(/\.jsonl$/, '.nudged');
}

/** Stable key for an unfiled batch — order-independent over its signatures. */
function batchKey(signatures: readonly string[]): string {
  const canonical = [...new Set(signatures)].sort((a, b) => a.localeCompare(b)).join('\n');
  return createHash('sha256').update(canonical).digest('hex');
}

/** Read the last-surfaced batch key, or undefined when none is recorded. */
function readNudgeMarker(projectDirectory: string, sessionId: string): string | undefined {
  try {
    const value = readFileSync(nudgeMarkerPath(projectDirectory, sessionId), 'utf8').trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Persist the batch key just surfaced, atomically. Best-effort — never throws. */
function writeNudgeMarker(projectDirectory: string, sessionId: string, key: string): void {
  try {
    const file = nudgeMarkerPath(projectDirectory, sessionId);
    const temporary = `${file}.${process.pid}.tmp`;
    mkdirSync(nodePath.dirname(file), { recursive: true });
    writeFileSync(temporary, `${key}\n`);
    renameSync(temporary, file);
  } catch {
    // A nudge marker that fails to persist just risks a re-nudge — the safe direction.
  }
}

/**
 * The factual, single-line nudge: names how many unfiled drafts there are and
 * where they sit, and points at the filing procedure — with NO imperative marker
 * (run / file / please / you must / should) so the model treats it as context.
 */
export function formatRetroNudge(count: number, spoolPath: string): string {
  const plural = count === 1 ? '' : 's';
  return (
    `Safeword's retro spooled ${count} unfiled finding${plural} from this session at ${spoolPath}; ` +
    `its GitHub REST transport could not authenticate them into the tracker, so they remain ` +
    `queued for the live agent's GitHub access. The filing procedure is in ` +
    `.safeword/guides/self-report-filing.md.`
  );
}

/**
 * Decide whether a boundary should surface the cloud-filing nudge. Returns the one
 * factual line when unfiled drafts exist AND this batch has not already been
 * surfaced; otherwise undefined. On a surface, persists the batch marker so the
 * same unchanged batch stays silent next time. Best-effort — reads are fail-open.
 */
export function decideRetroNudge(projectDirectory: string, sessionId: string): string | undefined {
  const drafts = readSpooledDrafts(projectDirectory, sessionId);
  if (drafts.length === 0) return undefined;
  const key = batchKey(drafts.map(draft => draft.signature));
  if (readNudgeMarker(projectDirectory, sessionId) === key) return undefined;
  writeNudgeMarker(projectDirectory, sessionId, key);
  return formatRetroNudge(drafts.length, draftSpoolPath(projectDirectory, sessionId));
}
