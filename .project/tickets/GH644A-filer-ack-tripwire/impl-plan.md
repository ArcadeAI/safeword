# Impl Plan: GH644A filer-ack-tripwire (authored at scenario-gate exit, pre-code)

## Proof plan / build order (outside-in, one scenario per RGR loop)

1. **Ack read/write lib** (`lib/retro-draft-spool.ts` or new `lib/retro-ack.ts`):
   `ackFilePath`, `readAcks` (shape-only validation, fail-open), ack-append in
   `fileSpooledDrafts` (post → ack → drain ordering). Proves SM2.AC2 seam
   scenario. Test: extend `tests/hooks/retro-filing.test.ts`.
2. **Marker snapshot + tripwire decision** (`lib/retro-filing-gate.ts`): marker
   gains optional `signatures[]`/`tripwired`; `decideRetroFilingGate` snapshots
   on dispatch; new detection path computes unacked removals and calls an
   injected `captureBareDrain` (default: `recordSignal` mirror of
   `captureGateEscalation`). Proves SM1.AC1/AC2/AC3 scenarios + outline. Test:
   `tests/hooks/retro-filing-gate.test.ts` (fresh fs per test).
3. **Hook wiring** (`stop-retro-filing.ts` + codex/cursor adapters use the same
   decide call — no adapter changes expected beyond none; verify). Proves
   TB1.AC1 invisibility via `tests/integration/stop-retro-filing.test.ts`
   (real hook subprocess, fs only).
4. **Prompts/guide**: filer md/toml ack instructions, dispatch-text prohibition
   line (`formatFilingDispatch`), guide inline-fallback ack paragraph. Proves
   SM2.AC1 via `tests/hooks/retro-filer-agent-defs.test.ts` extensions.
5. Cross-scenario refactor → /verify → /audit → verify.md → done.

## Constraints carried from figure-it-out

Fail-open everywhere; no network; allowlist-only signal (errorClass
RetroBareDrain); once per batch via `tripwired`; migration-safe optional marker
fields; capture (not file) gates the tripwire; tripwire never writes the retro
spool; ack validation shape-only.

## RED discipline

Each scenario's RED is an executed failing vitest run recorded in the ledger
before implementation lands.
