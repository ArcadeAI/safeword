# Impl Plan: GH644A filer-ack-tripwire

**Status:** planned
Authored at scenario-gate exit, before implementation code.

## Approach

Outside-in, one scenario per RGR loop, RED = executed failing vitest run
recorded in the ledger before implementation lands. Build order:

1. **Ack seam** — `ackFilePath`/`readAcks` (shape-only validation, fail-open)
   and post → ack → drain ordering in `fileSpooledDrafts`
   (`lib/retro-draft-spool.ts`). `DraftPoster` widens to return the created
   issue ref (`Promise<{ issue: number | string }>`) so acks can carry
   `{signature, issue}` — the three mocks in `tests/hooks/retro-filing.test.ts`
   update with it. Proves SM2.AC2.
2. **Marker snapshot + tripwire** — `.filing-attempts` marker gains optional
   `signatures[]`/`tripwired`; `decideRetroFilingGate` snapshots on dispatch and
   detects unacked removals via a DEFAULTED injectable `captureBareDrain`
   (default = `recordSignal` mirror of `captureGateEscalation`, errorClass
   `RetroBareDrain`). ORDERING (pre-code review): the tripwire check runs on the
   freshly read marker BEFORE the `drafts.length === 0` early return (the bare
   drain IS the empty-spool case) and BEFORE the dispatch path overwrites the
   marker with a new snapshot (partial drains); the trip persists
   `tripwired: true` even on silent returns. The gate reads `selfReport` config
   ITSELF: `capture` gates tripwire evaluation, `file` gates dispatch emission.
   `recordSignal` does not dedup — once-per-batch is the `tripwired` flag; tests
   assert spool record COUNT. Proves SM1.AC1/AC2/AC3 + outline. Tests:
   `tests/hooks/retro-filing-gate.test.ts`, incl. downgrade-direction marker
   migration (NEW marker through OLD write semantics disarms, never misfires).
3. **Hook wiring / invisibility** — ADAPTERS CHANGE (assessment trigger fired
   at pre-code review): all three drop their `selfReport.file` guards around the
   decide call — the gate now owns config semantics, so a watch-only
   (`file:false`, `capture:true`) install still evaluates the tripwire while
   emitting nothing. TB1.AC1 through the real `stop-retro-filing.ts` subprocess
   (fs-only mocking; two fixtures — tripped vs ack-clean — since the trip
   mutates the marker). Tests: `tests/integration/stop-retro-filing.test.ts`
   (the existing file-off silence test keeps passing: silence is about OUTPUT).
4. **Prompts/guide** — filer md/toml ack instructions, dispatch-text drain
   prohibition (`formatFilingDispatch`), guide inline-fallback ack paragraph.
   Proves SM2.AC1. Tests: `tests/hooks/retro-filer-agent-defs.test.ts`.
5. Cross-scenario refactor → /verify → /audit → verify.md → done.

## Decisions

Carried from the 2026-07-03 figure-it-out pass (recorded on #644/#658): ack
file `<session>.acks.jsonl` beside the spool, `{signature, issue}` per line,
appended per post; tripwire signal through the existing self-report lane
(allowlist-only, deduped via `signatureOf`), once per batch via `tripwired`;
`selfReport.capture` (not `file`) gates the tripwire; ack validation
shape-only (no network); rejected alternatives: GitHub-search verification
(proxy 403 + indexing lag), synthetic retro-draft loss reports (loop risk).

## Arch alignment

Follows the GH628F module shapes exactly: self-contained node:* template libs
shared by CLI and hook adapters, atomic-write markers, JSONL spools via
`jsonl-spool.ts` helpers, thin hook adapters over one decision function,
`captureGateEscalation` as the telemetry precedent. No new layers, deps, or
patterns; parity-check keeps template↔dogfood pairs synced.

## Known deviations

- Ack file is agent-appended (shell), so it is uncapped — accepted; gate reads
  are fail-open and per-session files die with the container. A session id
  literally named `x.acks` could collide with session `x`'s ack file
  (`spoolName` keeps dots) — real ids are UUIDs; noted, not mitigated. The marker schema change is additive/optional (pre-upgrade
markers disarm the tripwire — fail-open, no migration step).

## Assessment triggers

Re-plan if: the tripwire needs state beyond the marker+ack files (would break
the single-decision-function shape); adapters turn out to need changes for
TB1.AC1 (wiring assumption wrong); or ack writes require jsonl-spool changes
that affect the self-report spool's cap semantics.
