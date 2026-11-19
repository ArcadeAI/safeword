// Retro draft spool (ticket BNGK9W — cloud filing transport).
//
// The invisible retro extracts + sanitizes findings into code-assembled drafts,
// then tries to file them via the REST transport. The spool persists POST-EGRESS
// drafts before that attempt so anything unfiled survives a missing credential,
// upstream failure, filing cap, or acknowledgement failure. The agent-filing path
// (PATH B) reads the spool and
// posts each draft verbatim via its inherited GitHub MCP, then marks them filed.
//
// Only the code-assembled draft ({signature, title, body, labels}) is written —
// it is already sanitized at egress, so no raw finding text reaches disk.
//
// The per-session JSONL I/O (append+cap, read-skip-torn, atomic rewrite) lives in
// lib/jsonl-spool.ts, shared with the self-report spool; this module owns only what
// is retro-specific: the subdir, the draft schema, and the drain/filing semantics.
// Self-contained (node:* only): the CLI's `src/` imports it AND the surfacing hook
// runs it under bun in a customer repo. `SpooledDraft` is structurally `RetroDraft`.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import nodePath from 'node:path';

import {
  appendJsonlRecords,
  atomicWriteFile,
  readJsonlRecords,
  tryAppendJsonlRecords,
} from './jsonl-spool.js';

/** The code-assembled, post-egress fields — structurally the CLI's RetroDraft. */
export interface SpooledDraft {
  signature: string;
  /**
   * Code-derived canonical identity from a current CLI draft. Optional so old
   * JSONL records remain readable. It is usable for matching only when its
   * exact marker is also present in the code-assembled body.
   */
  canonicalSignature?: string;
  title: string;
  body: string;
  labels: string[];
  /**
   * Seal over the body as it was assembled post-egress (JDK0F0): the CLI's
   * `shortHash(body)`. Optional because pre-seal spool lines have no digest —
   * those stay fileable (fail-open), but a PRESENT digest that no longer
   * matches means the body was modified after sanitization, and the filing
   * seam refuses it.
   */
  bodyDigest?: string;
  route?: 'direct-v2' | 'server-v3';
}

/** Per-session spool cap — bounds a crash-looping or runaway session's disk use. */
const MAX_DRAFTS_PER_SESSION = 20;

/** The working copy lives under the project's `.safeword/`, inside the agent's workspace. */
const SPOOL_DIR = nodePath.join('.safeword', 'retro-drafts');

/** The extension every retro spool name carries and every sibling marker replaces. */
const SPOOL_EXTENSION = '.jsonl';

/** Collapse a session id to one safe filename component (no path escape).
 * FG6V57: the rule is pinned byte-identical with triage.ts and self-report.ts
 * by a parity contract. */
function spoolName(sessionId: string): string {
  return `${sessionId.replaceAll(/[^\w.-]/g, '_').slice(0, 80) || 'unknown'}${SPOOL_EXTENSION}`;
}

/**
 * Absolute path of the per-session working copy: the spool the filer is handed,
 * reads, acknowledges beside, and drains. It stays in the project so the filer
 * never needs write access outside its workspace.
 */
export function draftSpoolPath(projectDirectory: string, sessionId: string): string {
  return nodePath.join(projectDirectory, SPOOL_DIR, spoolName(sessionId));
}

/**
 * The durable copy's directory: `<git common dir>/safeword/retro-drafts/` (#5467).
 * Every worktree of a repository shares the common dir, so drafts written here
 * survive the worktree they were written in, however it is removed. Git itself
 * resolves the common dir, so worktree link formats stay its concern. Outside
 * git (or with a git too old for `--path-format`), the working copy's directory.
 */
function durableSpoolDirectory(projectDirectory: string): string {
  const result = spawnSync(
    'git',
    ['-C', projectDirectory, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 },
  );
  const commonDirectory = result.status === 0 ? result.stdout.trim() : '';
  return commonDirectory.length > 0
    ? nodePath.join(commonDirectory, 'safeword', 'retro-drafts')
    : nodePath.join(projectDirectory, SPOOL_DIR);
}

/** Absolute path of the per-session durable copy. Hooks and the CLI write it; the filer never does. */
export function durableDraftSpoolPath(projectDirectory: string, sessionId: string): string {
  return nodePath.join(durableSpoolDirectory(projectDirectory), spoolName(sessionId));
}

/** The durable copy's path when it is a separate file, else undefined. */
function separateDurablePath(projectDirectory: string, sessionId: string): string | undefined {
  const durable = durableDraftSpoolPath(projectDirectory, sessionId);
  return durable === draftSpoolPath(projectDirectory, sessionId) ? undefined : durable;
}

/**
 * Path of a sibling file sharing the spool's session-derived basename — the acks
 * ledger, the nudge marker, the filing-attempt marker. Three modules previously
 * each did their own `draftSpoolPath(...).replace(/\.jsonl$/, ...)`; a regex that
 * failed to match would silently no-op and hand back the SPOOL's own path, so the
 * marker write would overwrite the drafts it exists to protect. Appending when the
 * extension is absent makes that collision unrepresentable instead of relying on
 * `spoolName` never changing.
 */
export function spoolSiblingPath(
  projectDirectory: string,
  sessionId: string,
  suffix: string,
): string {
  const spool = draftSpoolPath(projectDirectory, sessionId);
  const base = spool.endsWith(SPOOL_EXTENSION)
    ? spool.slice(0, -SPOOL_EXTENSION.length)
    : /* istanbul ignore next — unreachable while spoolName appends the extension */ spool;
  return `${base}${suffix}`;
}

/** A parsed spool line is a draft only when the required code-assembled fields are present. */
function toDraft(value: unknown): SpooledDraft | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const { signature, canonicalSignature, title, body, labels, bodyDigest, route } = record;
  if (
    typeof signature !== 'string' ||
    typeof title !== 'string' ||
    typeof body !== 'string' ||
    !Array.isArray(labels) ||
    !labels.every((label): label is string => typeof label === 'string')
  ) {
    return undefined;
  }
  // The seal is optional (legacy lines predate it) but must be a string when present.
  if (bodyDigest !== undefined && typeof bodyDigest !== 'string') return undefined;
  if (canonicalSignature !== undefined && typeof canonicalSignature !== 'string') return undefined;
  if (route !== undefined && route !== 'direct-v2' && route !== 'server-v3') return undefined;
  return {
    signature,
    ...(canonicalSignature === undefined ? {} : { canonicalSignature }),
    title,
    body,
    labels,
    ...(bodyDigest === undefined ? {} : { bodyDigest }),
    ...(route === undefined ? {} : { route }),
  };
}

/** A draft's identity: route plus signature, as markDraftsFiled and markDraftsAcceptedByServer use. */
function draftKey(draft: SpooledDraft): string {
  return `${draft.route ?? 'direct-v2'}\0${draft.signature}`;
}

/** A direct draft whose signature carries a filed ack; server-routed drafts never are. */
function isFiled(draft: SpooledDraft, filedSignatures: ReadonlySet<string>): boolean {
  return draft.route !== 'server-v3' && filedSignatures.has(draft.signature);
}

/**
 * The session's drafts across both copies: the working copy, then each durable
 * draft it does not hold. A draft the removal ledger names is skipped in either
 * copy, because removals are recorded before any copy is rewritten: a staging
 * write that raced a drain cannot bring a removed draft back. A durable draft
 * with a filed ack is skipped too (filed, even if a sandbox kept the ledger
 * from being written); a working draft with an ack stays, so the filer can
 * drain it.
 */
function readAllSpooledDrafts(projectDirectory: string, sessionId: string): SpooledDraft[] {
  const working = readJsonlRecords(draftSpoolPath(projectDirectory, sessionId), toDraft);
  const durable = separateDurablePath(projectDirectory, sessionId);
  if (durable === undefined) return working;
  const removals = sessionRemovals(projectDirectory, sessionId, durable);
  const pending = working.filter(draft => !removals.has(draftKey(draft)));
  const known = new Set([...pending.map(draftKey), ...removals]);
  const filed = new Set(readAcks(projectDirectory, sessionId).map(ack => ack.signature));
  const additions: SpooledDraft[] = [];
  for (const draft of readJsonlRecords(durable, toDraft)) {
    if (known.has(draftKey(draft)) || isFiled(draft, filed)) continue;
    known.add(draftKey(draft));
    additions.push(draft);
  }
  return [...pending, ...additions];
}

/**
 * Read the drafts spooled for one session, or `[]` when the spool is absent,
 * unreadable, or torn. Fail-open by construction — a partial/malformed line is
 * skipped, never thrown, so the filing path never crashes on a bad spool.
 */
export function readSpooledDrafts(projectDirectory: string, sessionId: string): SpooledDraft[] {
  return readAllSpooledDrafts(projectDirectory, sessionId).filter(
    draft => draft.route !== 'server-v3',
  );
}

/** Read server-routed drafts retained until collector acceptance. */
export function readServerSpooledDrafts(
  projectDirectory: string,
  sessionId: string,
): SpooledDraft[] {
  return readAllSpooledDrafts(projectDirectory, sessionId).filter(
    draft => draft.route === 'server-v3',
  );
}

/** Serialize one draft to its canonical spool line (only the code-assembled fields). */
function draftLine(draft: SpooledDraft): string {
  return JSON.stringify({
    signature: draft.signature,
    canonicalSignature: draft.canonicalSignature,
    title: draft.title,
    body: draft.body,
    labels: draft.labels,
    // JSON.stringify drops an undefined seal, so legacy drafts stay four-field.
    bodyDigest: draft.bodyDigest,
    route: draft.route,
  });
}

/** Return a canonical identity only when the immutable body carries its exact marker. */
export function canonicalSignatureForDraft(draft: SpooledDraft): string | undefined {
  if (draft.canonicalSignature === undefined) return undefined;
  const marker = `<!-- safeword-retro-canonical: ${draft.canonicalSignature} -->`;
  return draft.body.includes(marker) ? draft.canonicalSignature : undefined;
}

/** Remove canonical metadata when it disagrees with the code-assembled body. */
function draftForPosting(draft: SpooledDraft): SpooledDraft {
  if (canonicalSignatureForDraft(draft) !== undefined || draft.canonicalSignature === undefined) {
    return draft;
  }
  const { canonicalSignature: _canonicalSignature, ...withoutCanonicalSignature } = draft;
  return withoutCanonicalSignature;
}

/**
 * True unless the draft carries a seal that no longer matches its body. The
 * digest algorithm MUST stay byte-identical to the CLI's `src/retro/hash.ts`
 * `shortHash` (sha256, hex, first 12 chars) — this module is self-contained
 * (node:* only; hooks run it under bun in customer repos), so it cannot import
 * that definition. `draft.test.ts` pins the two implementations together.
 */
export function verifyDraftBody(draft: SpooledDraft): boolean {
  if (draft.bodyDigest === undefined) return true;
  return createHash('sha256').update(draft.body).digest('hex').slice(0, 12) === draft.bodyDigest;
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
function removeDrafts(
  projectDirectory: string,
  sessionId: string,
  removedSignatures: readonly string[],
  routeMatches: (draft: SpooledDraft) => boolean,
): void {
  const removed = new Set(removedSignatures);
  const isRemoved = (draft: SpooledDraft): boolean =>
    removed.has(draft.signature) && routeMatches(draft);
  const durable = separateDurablePath(projectDirectory, sessionId);
  if (durable !== undefined) {
    // The durable copy is append-only, so a concurrent writer's append is never
    // lost to a rewrite: its removals live in the ledger beside it instead.
    const keys = readAllSpooledDrafts(projectDirectory, sessionId)
      .filter(draft => isRemoved(draft))
      .map(draftKey);
    appendRemovals(removalLedgerPath(projectDirectory, sessionId), keys);
    appendRemovals(durableRemovalPath(durable), keys);
  }
  const working = draftSpoolPath(projectDirectory, sessionId);
  // Busy: leave the drafts; the ledger already hides them and the next drain retries.
  withWorkingCopyLock(
    working,
    () => rewriteSpool(working, draft => !isRemoved(draft)),
    () => undefined,
  );
}

/**
 * The removal ledger: one `{key}` line per draft removed from the session (filed
 * or server-accepted), beside each copy. Reads filter the durable copy by it,
 * since that copy is never rewritten; the working copy stays authoritative for
 * what it holds. Each copy's ledger is mirrored to the durable one at handoff,
 * for a removal made where the durable ledger could not be written.
 */
const REMOVED_SUFFIX = '.removed.jsonl';

function removalLedgerPath(projectDirectory: string, sessionId: string): string {
  return spoolSiblingPath(projectDirectory, sessionId, REMOVED_SUFFIX);
}

/** A durable spool's sibling with `suffix` in place of the spool extension. */
function siblingOf(durableSpool: string, suffix: string): string {
  return `${durableSpool.slice(0, -SPOOL_EXTENSION.length)}${suffix}`;
}

/** The durable copy's removal ledger, beside the durable spool. */
function durableRemovalPath(durableSpool: string): string {
  return siblingOf(durableSpool, REMOVED_SUFFIX);
}

/** Copy the working copy's removals into the durable ledger. Best-effort; never throws. */
function mirrorRemovals(projectDirectory: string, sessionId: string, durableSpool: string): void {
  appendRemovals(durableRemovalPath(durableSpool), [
    ...readRemovals(removalLedgerPath(projectDirectory, sessionId)),
  ]);
}

function toRemovalKey(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { key } = value as Record<string, unknown>;
  return typeof key === 'string' && key.length > 0 ? key : undefined;
}

function readRemovals(file: string): Set<string> {
  return new Set(readJsonlRecords(file, toRemovalKey));
}

/** Append the keys a ledger lacks. Best-effort; never throws. */
function appendRemovals(file: string, keys: readonly string[]): void {
  const recorded = readRemovals(file);
  const missing = [...new Set(keys)].filter(key => !recorded.has(key));
  tryAppendJsonlRecords(
    file,
    missing.map(key => JSON.stringify({ key })),
    Number.POSITIVE_INFINITY,
  );
}

/** Every removal recorded beside either copy. */
function sessionRemovals(
  projectDirectory: string,
  sessionId: string,
  durable: string,
): Set<string> {
  return new Set([
    ...readRemovals(removalLedgerPath(projectDirectory, sessionId)),
    ...readRemovals(durableRemovalPath(durable)),
  ]);
}

/** Rewrite one spool file to the drafts `keep` accepts. Best-effort; never throws. */
function rewriteSpool(file: string, keep: (draft: SpooledDraft) => boolean): void {
  try {
    if (!existsSync(file)) return;
    const drafts = readJsonlRecords(file, toDraft);
    const remaining = drafts.filter(draft => keep(draft));
    if (remaining.length === drafts.length) return;
    atomicWriteFile(file, serializeDrafts(remaining));
  } catch {
    // Self-observation must never break the host. Swallow. The removal ledger
    // already hides these drafts, and the next drain retries the rewrite.
  }
}

function serializeDrafts(drafts: readonly SpooledDraft[]): string {
  return drafts.length > 0 ? `${drafts.map(draft => draftLine(draft)).join('\n')}\n` : '';
}

/** How long a working-copy writer waits for the lock, and when a held lock counts as abandoned. */
const LOCK_WAIT_MS = 2000;
const LOCK_STALE_MS = 10_000;
const LOCK_POLL_MS = 20;

/**
 * Run `operation` holding the working copy's lock (a sibling directory, since
 * mkdir is atomic). Staging, the drain's rewrite and the fallback append take
 * it, so a rewrite can never replace a file another writer just appended to.
 * A lock older than LOCK_STALE_MS was abandoned by a killed process and is
 * cleared. When the lock cannot be taken in `waitMs`, or cannot be created at
 * all, `onBusy` decides.
 */
function withWorkingCopyLock<T>(
  file: string,
  operation: () => T,
  onBusy: () => T,
  waitMs = LOCK_WAIT_MS,
): T {
  const lock = `${file}.lock`;
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      mkdirSync(nodePath.dirname(file), { recursive: true });
      mkdirSync(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') return onBusy();
      if (lockIsStale(lock)) {
        rmSync(lock, { recursive: true, force: true });
        continue;
      }
      if (Date.now() >= deadline) return onBusy();
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_POLL_MS);
    }
  }
  try {
    return operation();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

function lockIsStale(lock: string): boolean {
  try {
    return Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS;
  } catch {
    return false;
  }
}

/**
 * Bring the session's durable drafts into the working copy and return its path
 * — the one place a spool path is handed to the filer (Stop gate, nudge,
 * closeout). This hook-side step also copies the working copy's acks and
 * removals beside the durable copy, for a filer that ran where the durable copy
 * could not be written. Returns undefined when the
 * working copy does not end up holding every pending draft, so no caller hands
 * the filer a spool that is missing the findings it was dispatched for.
 */
export function stageRetroSpool(projectDirectory: string, sessionId: string): string | undefined {
  const working = draftSpoolPath(projectDirectory, sessionId);
  const durable = separateDurablePath(projectDirectory, sessionId);
  if (durable === undefined) return working;
  try {
    mirrorAcks(projectDirectory, sessionId, durable);
    mirrorRemovals(projectDirectory, sessionId, durable);
    // The handed-off file holds exactly the pending drafts: every durable
    // addition, and no draft the removal ledger names.
    return withWorkingCopyLock(
      working,
      () => {
        const drafts = readAllSpooledDrafts(projectDirectory, sessionId);
        const pending = drafts.map(draftKey).join('\n');
        const physical = (): string => readJsonlRecords(working, toDraft).map(draftKey).join('\n');
        if (physical() === pending) return working;
        atomicWriteFile(working, serializeDrafts(drafts));
        return physical() === pending ? working : undefined;
      },
      () => undefined,
    );
  } catch {
    // The next handoff retries the staging.
    return undefined;
  }
}

export function markDraftsFiled(
  projectDirectory: string,
  sessionId: string,
  filedSignatures: readonly string[],
): void {
  removeDrafts(projectDirectory, sessionId, filedSignatures, draft => draft.route !== 'server-v3');
}

/** Remove server-routed diagnostic recovery after durable collector acceptance. */
export function markDraftsAcceptedByServer(
  projectDirectory: string,
  sessionId: string,
  acceptedSignatures: readonly string[],
): void {
  removeDrafts(
    projectDirectory,
    sessionId,
    acceptedSignatures,
    draft => draft.route === 'server-v3',
  );
}

/** One filed-draft ack: the signature and the tracker issue it landed on (GH644A). */
export interface FiledAck {
  signature: string;
  issue: number | string;
}

/** Ack file beside the spool: `<session>.acks.jsonl`, one FiledAck per line. */
export function ackFilePath(projectDirectory: string, sessionId: string): string {
  return spoolSiblingPath(projectDirectory, sessionId, '.acks.jsonl');
}

/** A filed ack names a non-empty signature and a meaningful tracker destination. */
function isFiledAck(value: unknown): value is FiledAck {
  if (typeof value !== 'object' || value === null) return false;
  const { signature, issue } = value as Record<string, unknown>;
  if (typeof signature !== 'string' || signature.length === 0) return false;
  if (typeof issue === 'number') return Number.isSafeInteger(issue) && issue > 0;
  return typeof issue === 'string' && issue.trim().length > 0;
}

/** Parse only records that satisfy the same contract used to authorize a drain. */
function toAck(value: unknown): FiledAck | undefined {
  return isFiledAck(value) ? value : undefined;
}

/**
 * Read the session's filed-draft acks, `[]` when absent/unreadable/torn. The
 * gate's tripwire (lib/retro-filing-gate.ts) treats these as the ONLY proof
 * that a removed draft was filed — local contract validation, no network.
 */
export function readAcks(projectDirectory: string, sessionId: string): FiledAck[] {
  const working = readJsonlRecords(ackFilePath(projectDirectory, sessionId), toAck);
  const durable = separateDurablePath(projectDirectory, sessionId);
  if (durable === undefined) return working;
  const seen = new Set(working.map(ackKey));
  return [
    ...working,
    ...readJsonlRecords(durableAckPath(durable), toAck).filter(ack => !seen.has(ackKey(ack))),
  ];
}

function ackKey(ack: FiledAck): string {
  return `${ack.signature}\0${String(ack.issue)}`;
}

/** The durable copy's ack ledger, beside the durable spool. */
function durableAckPath(durableSpool: string): string {
  return siblingOf(durableSpool, '.acks.jsonl');
}

/**
 * Copy the working copy's acks into the durable ledger, so a filed draft stays
 * filed after its worktree is deleted. Best-effort: a sandboxed filer cannot
 * write it, and the next hook-side staging copies them instead.
 */
function mirrorAcks(projectDirectory: string, sessionId: string, durableSpool: string): void {
  const ledger = durableAckPath(durableSpool);
  const recorded = new Set(readJsonlRecords(ledger, toAck).map(ackKey));
  const missing = readJsonlRecords(ackFilePath(projectDirectory, sessionId), toAck).filter(
    ack => !recorded.has(ackKey(ack)),
  );
  tryAppendJsonlRecords(
    ledger,
    missing.map(ack => JSON.stringify({ signature: ack.signature, issue: ack.issue })),
    Number.POSITIVE_INFINITY,
  );
}

/**
 * Persist one filed-draft acknowledgement. Returns true only when the complete
 * record was written, so callers can retain the draft instead of performing an
 * unacknowledged drain when local storage fails.
 */
export function recordFiledAck(
  projectDirectory: string,
  sessionId: string,
  ack: FiledAck,
): boolean {
  if (!isFiledAck(ack)) return false;
  const appended = tryAppendJsonlRecords(
    ackFilePath(projectDirectory, sessionId),
    [JSON.stringify(ack)],
    Number.POSITIVE_INFINITY,
  );
  if (!appended) return false;
  return readAcks(projectDirectory, sessionId).some(
    recorded => recorded.signature === ack.signature && recorded.issue === ack.issue,
  );
}

/** Drain only drafts with a reader-visible, destination-bound acknowledgement. */
export function drainAcknowledgedDrafts(projectDirectory: string, sessionId: string): void {
  const durable = separateDurablePath(projectDirectory, sessionId);
  if (durable !== undefined) mirrorAcks(projectDirectory, sessionId, durable);
  markDraftsFiled(
    projectDirectory,
    sessionId,
    readAcks(projectDirectory, sessionId).map(ack => ack.signature),
  );
}

/**
 * Posts one spooled draft to a tracker (the agent's GitHub MCP, or a REST
 * client) and returns the issue the draft landed on, so the ack can name it.
 */
export type DraftPoster = (draft: SpooledDraft) => Promise<{ issue: number | string }>;

/**
 * The agent filing seam (PATH B), as an EXECUTABLE REFERENCE-SPEC. In production the
 * cloud subagent files by reading the spool and calling its GitHub MCP directly,
 * guided by `guides/self-report-filing.md` — there is deliberately NO code caller
 * here (an LLM's MCP calls aren't a TS function). This function pins the contract
 * that guide describes in prose, so it can be tested: read the session spool, post
 * each draft's code-assembled body VERBATIM through `post` (mocked in tests), then
 * drain exactly the drafts that posted. A draft whose post throws stays spooled so a
 * later boundary re-nudges and it retries — findings are never dropped. A draft
 * whose body no longer matches its seal (JDK0F0) is REFUSED — never posted, left
 * spooled for a human to inspect, counted in `rejected`. Returns the counts. The
 * spool already holds post-egress bodies, so "verbatim" carries no un-sanitized
 * text. (Covers done_when: the subagent posts each draft verbatim — proven at the
 * spool→transport seam, the MCP call mocked.)
 */
export async function fileSpooledDrafts(
  projectDirectory: string,
  sessionId: string,
  post: DraftPoster,
): Promise<{ posted: number; failed: number; rejected: number }> {
  let posted = 0;
  let failed = 0;
  let rejected = 0;
  for (const draft of readSpooledDrafts(projectDirectory, sessionId)) {
    if (!verifyDraftBody(draft)) {
      rejected += 1;
      continue;
    }
    try {
      const { issue } = await post(draftForPosting(draft));
      // Ack IMMEDIATELY after the post, before any drain (GH644A): a crash
      // between post and drain must read as "posted but undrained", never as a
      // bare drain. Uncapped by design — the filer appends, the gate reads.
      if (!recordFiledAck(projectDirectory, sessionId, { signature: draft.signature, issue })) {
        failed += 1;
        continue;
      }
      posted += 1;
    } catch {
      failed += 1;
    }
  }
  drainAcknowledgedDrafts(projectDirectory, sessionId);
  return { posted, failed, rejected };
}

/**
 * Append post-egress drafts to the session spool (writing ONLY the
 * code-assembled fields). BEST-EFFORT and capped at `MAX_DRAFTS_PER_SESSION` — both
 * handled by the shared `appendJsonlRecords`.
 */
export function spoolDrafts(
  projectDirectory: string,
  sessionId: string,
  drafts: readonly SpooledDraft[],
): void {
  // The durable copy first; where it cannot take a draft (an agent sandbox that
  // confines writes to the workspace, or its cap), the working copy keeps
  // today's behavior for exactly the drafts the durable copy does not hold.
  const durable = separateDurablePath(projectDirectory, sessionId);
  let fallback = drafts;
  if (durable !== undefined) {
    const lines = drafts.map(draft => draftLine(draft));
    if (tryAppendJsonlRecords(durable, lines, MAX_DRAFTS_PER_SESSION)) return;
    const held = new Set(readJsonlRecords(durable, toDraft).map(draftKey));
    fallback = drafts.filter(draft => !held.has(draftKey(draft)));
  }
  const working = draftSpoolPath(projectDirectory, sessionId);
  const append = (): void =>
    appendJsonlRecords(
      working,
      fallback.map(draft => draftLine(draft)),
      MAX_DRAFTS_PER_SESSION,
    );
  // Wait past LOCK_STALE_MS, so the append always ends up holding the lock (a
  // held lock is released or goes stale first) and staging cannot replace it.
  // onBusy runs only when no lock can be created, so staging cannot take one either.
  if (fallback.length > 0)
    withWorkingCopyLock(working, append, append, LOCK_STALE_MS + LOCK_WAIT_MS);
}
