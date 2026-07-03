# Impl Plan: GH644A filer-ack-tripwire

**Status:** planned
Authored at scenario-gate exit, before implementation code.

## Approach

Outside-in, one scenario per RGR loop, RED = executed failing vitest run
recorded in the ledger before implementation lands. Build order:

1. **Ack seam** — `ackFilePath`/`readAcks` (shape-only validation, fail-open)
   and post → ack → drain ordering in `fileSpooledDrafts`
   (`lib/retro-draft-spool.ts`). Proves SM2.AC2. Tests:
   `tests/hooks/retro-filing.test.ts`.
2. **Marker snapshot + tripwire** — `.filing-attempts` marker gains optional
   `signatures[]`/`tripwired`; `decideRetroFilingGate` snapshots on dispatch and
   detects unacked removals, calling an injected `captureBareDrain` (a
   `recordSignal` mirror of `captureGateEscalation`, errorClass
   `RetroBareDrain`). Proves SM1.AC1/AC2/AC3 + outline. Tests:
   `tests/hooks/retro-filing-gate.test.ts`.
3. **Hook wiring / invisibility** — TB1.AC1 through the real
   `stop-retro-filing.ts` subprocess (fs-only mocking); adapters expected
   unchanged (same decide call). Tests:
   `tests/integration/stop-retro-filing.test.ts`.
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

None planned. The marker schema change is additive/optional (pre-upgrade
markers disarm the tripwire — fail-open, no migration step).

## Assessment triggers

Re-plan if: the tripwire needs state beyond the marker+ack files (would break
the single-decision-function shape); adapters turn out to need changes for
TB1.AC1 (wiring assumption wrong); or ack writes require jsonl-spool changes
that affect the self-report spool's cap semantics.
