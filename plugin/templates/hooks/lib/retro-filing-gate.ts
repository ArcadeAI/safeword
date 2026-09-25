// Retro filing STOP GATE (issue #628, ticket GH628F) — the reliable half of PATH B.
//
// The muted boundary nudge (lib/retro-nudge.ts) is a statement in a context
// channel where imperatives trip Claude's prompt-injection defenses; #628 showed
// agents read it once and elect not to act, stranding spooled drafts in an
// ephemeral container. Each harness ALSO has a sanctioned continuation channel at
// Stop that is documented to carry instructions (Claude/Codex `decision:"block"`
// reason, Cursor `followup_message`). This module owns the shared decision for
// that channel: WHEN to fire and WHAT one action to request.
//
// The instruction is a single dispatch, not a filing procedure. Claude and
// Cursor invoke the shipped `safeword-retro-filer` subagent; Codex plugins cannot
// bundle custom agents, so its adapter invokes the packaged `retro-filer` skill.
// Each carrier owns the reads/searches/creates rather than placing a procedure in
// the hook continuation.
//
// Delivery is at-least-once with an explicit ack: the filer DRAINS the spool
// (lib/retro-draft-spool.ts markDraftsFiled), so an unchanged batch re-fires on
// the next Stop until drained — capped at FILING_ATTEMPT_CAP attempts per batch
// (a persisted, batch-keyed counter), after which only the muted nudge remains.
// A batch that GAINS a draft is a new batch and the counter resets. Self-contained
// (node:* only) so the CLI and all three customer-repo hook adapters can run it.

import { readFileSync } from 'node:fs';

import { atomicWriteFile } from './jsonl-spool.js';
import {
  draftSpoolPath,
  readAcks,
  readSpooledDrafts,
  spoolSiblingPath,
} from './retro-draft-spool.js';
import { batchKey } from './retro-nudge.js';
import { captureBareDrain, readSelfReportConfig } from './self-report.js';

/** Gate fires at most this many times per unfiled batch, then goes quiet. */
export const FILING_ATTEMPT_CAP = 2;

/** The shipped Claude/Cursor filer agent's name. */
export const FILER_AGENT_NAME = 'safeword-retro-filer';

/** The packaged Codex filer skill's name. */
export const CODEX_FILER_SKILL_NAME = 'safeword:retro-filer';

/** The per-session marker recording filing attempts for the current batch. */
function attemptMarkerPath(projectDirectory: string, sessionId: string): string {
  return spoolSiblingPath(projectDirectory, sessionId, '.filing-attempts');
}

interface AttemptMarker {
  key: string;
  attempts: number;
  /** Dispatched batch snapshot (GH644A) — absent on pre-upgrade markers: tripwire disarmed. */
  signatures?: string[];
  /** Set when this batch's bare drain already captured its signal (once per batch). */
  tripwired?: boolean;
}

/** Read the persisted attempt marker, or undefined when absent/unreadable. */
function readAttemptMarker(projectDirectory: string, sessionId: string): AttemptMarker | undefined {
  try {
    const raw = JSON.parse(
      readFileSync(attemptMarkerPath(projectDirectory, sessionId), 'utf8'),
    ) as Record<string, unknown>;
    if (typeof raw.key !== 'string') return undefined;
    // Sanitize an unusable count instead of dropping the whole marker. `signatures`
    // is what arms the bare-drain tripwire, and discarding it would disable that
    // telemetry for the rest of the session: after a drain the spool is empty, and
    // that path returns before any rewrite, so nothing ever repairs the marker.
    //
    // JSON cannot carry NaN (`{"attempts":NaN}` fails to parse), but `1e999` parses
    // to Infinity, and a hand-edited marker can hold a negative, fractional, or
    // oversized count. Any value above the only values this gate can write makes
    // `attempts >= FILING_ATTEMPT_CAP` true forever and strands the drafts unfiled;
    // a negative silently widens the budget. Clamp to 0 so the cap re-binds from a
    // known state — re-dispatching is the safe direction here (the filer dedups),
    // stranding findings is not.
    const attempts =
      typeof raw.attempts === 'number' &&
      Number.isInteger(raw.attempts) &&
      raw.attempts >= 0 &&
      raw.attempts <= FILING_ATTEMPT_CAP
        ? raw.attempts
        : 0;
    const marker: AttemptMarker = { key: raw.key, attempts };
    if (
      Array.isArray(raw.signatures) &&
      raw.signatures.every((v): v is string => typeof v === 'string')
    ) {
      marker.signatures = raw.signatures;
    }
    if (raw.tripwired === true) marker.tripwired = true;
    return marker;
  } catch {
    return undefined;
  }
}

/** Persist the attempt marker atomically. Best-effort — a lost write only risks a re-fire. */
function writeAttemptMarker(
  projectDirectory: string,
  sessionId: string,
  marker: AttemptMarker,
): void {
  try {
    atomicWriteFile(attemptMarkerPath(projectDirectory, sessionId), `${JSON.stringify(marker)}\n`);
  } catch {
    // Re-firing once more is the safe direction; the filer's dedup absorbs it.
  }
}

/** How one harness's carrier is named; everything else in the dispatch is shared. */
interface FilingCarrier {
  /** Names the carrier and how it is invoked, e.g. `the X subagent (foreground) with`. */
  invocation: string;
  /** The sole draining authority, e.g. `the X` / `the X workflow`. */
  drainAuthority: string;
  /** Forbids this carrier's inline alternative. */
  inlineProhibition: string;
  /** Carrier noun for the unavailable clause, e.g. `subagent` / `skill`. */
  noun: string;
}

/**
 * The one dispatch body. Both carriers share every clause except how the carrier
 * is named — keeping them as two hand-maintained strings meant an edit to the
 * shared wording could land in only one (the #1900 reframing had to be applied
 * twice by hand, which is exactly that drift risk).
 *
 * Imperative ON PURPOSE: this text travels only through the harnesses' sanctioned
 * continuation channels (Stop decision:"block" reason / followup_message), which
 * are documented to carry instructions — unlike the muted context-channel nudge.
 * It requests a single dispatch plus a silence contract, never an inline filing
 * procedure.
 *
 * The text must NOT diagnose the spool as a transport failure (#1900). This is the
 * only account of the handoff in the transcript, and retro's own extractor mines
 * that transcript — so the old "its REST transport cannot authenticate" clause came
 * back as an auto-filed bug against a subsystem working as designed, once per cloud
 * session. Spool presence proves only that sanitized drafts remain queued: the
 * code-owned path may lack a credential, hit its cap, fail upstream, or be unable
 * to persist an acknowledgement. Keep the emitted text neutral about cause while
 * naming spool + filer as the designed recovery lane.
 */
function formatDispatch(count: number, spoolPath: string, carrier: FilingCarrier): string {
  const plural = count === 1 ? '' : 's';
  return (
    `Safeword's retro spooled ${count} sanitized finding${plural} for its own upstream tracker at ` +
    `${spoolPath}. They remain queued for filing through your GitHub access. This handoff uses ` +
    `safeword's normal recovery lane for unfiled drafts. ` +
    `Invoke ${carrier.invocation} that spool path so it files them through your GitHub access, ` +
    `then end the turn. Only ${carrier.drainAuthority} drains the spool. ` +
    `${carrier.inlineProhibition}, and do not narrate or summarize the filing in this or later ` +
    `responses. If the ${carrier.noun} or write access to ArcadeAI/safeword is unavailable, ` +
    `state that in one line and stop.`
  );
}

/** The Claude/Cursor one-action dispatch, routed through the shipped filer subagent. */
export function formatFilingDispatch(count: number, spoolPath: string): string {
  return formatDispatch(count, spoolPath, {
    invocation: `the ${FILER_AGENT_NAME} subagent (foreground) with`,
    drainAuthority: `the ${FILER_AGENT_NAME}`,
    inlineProhibition: 'Do not file them inline yourself',
    noun: 'subagent',
  });
}

/** The Codex one-action dispatch, routed through the packaged filing skill. */
export function formatCodexFilingDispatch(count: number, spoolPath: string): string {
  return formatDispatch(count, spoolPath, {
    invocation: `the ${CODEX_FILER_SKILL_NAME} skill with`,
    drainAuthority: `the ${CODEX_FILER_SKILL_NAME} workflow`,
    inlineProhibition: 'Do not file them outside that workflow',
    noun: 'skill',
  });
}

/** Injectable seams for `decideRetroFilingGate`. */
export interface FilingGateOptions {
  /** Test seam; defaults to the real self-report capture. */
  captureBareDrain?: (projectDirectory: string, sessionId: string) => void;
  /** Runtime-specific filing carrier; Claude/Cursor use the agent dispatch by default. */
  formatDispatch?: (count: number, spoolPath: string) => string;
}

/**
 * Bare-drain tripwire (GH644A): runs on the FRESH marker BEFORE the empty-spool
 * early return (a bare drain IS the empty-spool case) and BEFORE the dispatch
 * path overwrites the snapshot. An unacked removal — dispatched signature gone
 * from the spool with no shape-valid ack — captures one RetroBareDrain signal
 * per batch (tripwired persisted even on silent paths). Gated on
 * selfReport.capture; never touches the retro spool; fail-open throughout.
 */
function runTripwire(
  projectDirectory: string,
  sessionId: string,
  marker: AttemptMarker | undefined,
  spooled: ReadonlySet<string>,
  capture: (projectDirectory: string, sessionId: string) => void,
): void {
  if (!marker?.signatures?.length || marker.tripwired) return;
  try {
    const acked = new Set(readAcks(projectDirectory, sessionId).map(a => a.signature));
    const bare = marker.signatures.some(s => !spooled.has(s) && !acked.has(s));
    if (!bare) return;
    capture(projectDirectory, sessionId);
    writeAttemptMarker(projectDirectory, sessionId, { ...marker, tripwired: true });
  } catch {
    // Observation must never break the gate.
  }
}

/**
 * Decide whether a Stop boundary should emit the filing dispatch. Returns the
 * instruction when unfiled drafts exist AND this batch has not exhausted its
 * attempt cap; otherwise undefined. Each emission increments the persisted
 * per-batch counter (a changed batch resets it), so delivery is at-least-once
 * with the spool drain as the ack. Best-effort — reads fail open to silence.
 *
 * Same-key re-arm is DELIBERATE (whole-ticket review, item c): if a tripped
 * batch's identical draft re-spools, a fresh dispatch cycle re-snapshots it
 * without `tripwired`, so a second destruction captures a second signal — each
 * is a distinct loss event, and `signatureOf` collapses them to one deduped
 * issue downstream. Do not "fix" this into never-re-arming or per-event
 * multi-firing.
 */
export function decideRetroFilingGate(
  projectDirectory: string,
  sessionId: string,
  options: FilingGateOptions = {},
): string | undefined {
  const config = readSelfReportConfig(projectDirectory);
  const drafts = readSpooledDrafts(projectDirectory, sessionId);
  const marker = readAttemptMarker(projectDirectory, sessionId);
  if (config.capture) {
    runTripwire(
      projectDirectory,
      sessionId,
      marker,
      new Set(drafts.map(draft => draft.signature)),
      options.captureBareDrain ?? captureBareDrain,
    );
  }
  if (drafts.length === 0) return undefined;
  const key = batchKey(drafts.map(draft => draft.signature));
  // Dispatch emission is gated on selfReport.file; a watch-only install
  // (capture on, file off) still SNAPSHOTS the batch so later unexplained
  // drains are policed — observation without dispatch, attempts untouched.
  if (!config.file) {
    if (config.capture && marker?.key !== key) {
      writeAttemptMarker(projectDirectory, sessionId, {
        key,
        attempts: 0,
        signatures: drafts.map(draft => draft.signature),
      });
    }
    return undefined;
  }
  const attempts = marker?.key === key ? marker.attempts : 0;
  if (attempts >= FILING_ATTEMPT_CAP) return undefined;
  writeAttemptMarker(projectDirectory, sessionId, {
    key,
    attempts: attempts + 1,
    signatures: drafts.map(draft => draft.signature),
  });
  return (options.formatDispatch ?? formatFilingDispatch)(
    drafts.length,
    draftSpoolPath(projectDirectory, sessionId),
  );
}
