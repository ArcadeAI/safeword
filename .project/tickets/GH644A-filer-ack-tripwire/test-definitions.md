# Test Definitions: Filer ack + bare-drain tripwire

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

Feature source: `packages/cli/features/filer-ack-tripwire.feature` (@manual —
vitest-proven). Spec: `spec.md`. Dimensions: `dimensions.md`.

test-definitions.md is the R/G/R ledger. RED means an EXECUTED failing run
(command + observed failure), not an asserted counterfactual.

## Rule: Unacked removals trip once per batch; acked or pending removals stay silent

### Scenario: A dispatched signature vanishing without an ack captures one RetroBareDrain signal (SM1.AC1)

- [x] RED — executed 2026-07-03T15:47Z (batch): 5 behavioral failures observed in
  `tests/hooks/retro-filing-gate.test.ts` pre-implementation (spy never called).
- [x] GREEN — executed 2026-07-03T15:55Z: 54/54 across gate + neighbor suites.
- [x] REFACTOR — tripwire isolated in `runTripwire` (fail-open try/catch); marker
  fields additive/validated; watch-only snapshot path documented.

### Scenario: A tripped batch does not trip again (SM1.AC1)

- [x] RED — executed 2026-07-03T15:47Z (batch): 5 behavioral failures observed in
  `tests/hooks/retro-filing-gate.test.ts` pre-implementation (spy never called).
- [x] GREEN — executed 2026-07-03T15:55Z: 54/54 across gate + neighbor suites.
- [x] REFACTOR — tripwire isolated in `runTripwire` (fail-open try/catch); marker
  fields additive/validated; watch-only snapshot path documented.

### Scenario: A new dispatched batch re-arms the tripwire after an earlier trip (SM1.AC1)

- [x] RED — executed 2026-07-03T15:47Z (batch): 5 behavioral failures observed in
  `tests/hooks/retro-filing-gate.test.ts` pre-implementation (spy never called).
- [x] GREEN — executed 2026-07-03T15:55Z: 54/54 across gate + neighbor suites.
- [x] REFACTOR — tripwire isolated in `runTripwire` (fail-open try/catch); marker
  fields additive/validated; watch-only snapshot path documented.

### Scenario: Removals covered by shape-valid ack lines trip nothing (SM1.AC2)

- [x] RED — executed 2026-07-03T15:47Z (batch): 5 behavioral failures observed in
  `tests/hooks/retro-filing-gate.test.ts` pre-implementation (spy never called).
- [x] GREEN — executed 2026-07-03T15:55Z: 54/54 across gate + neighbor suites.
- [x] REFACTOR — tripwire isolated in `runTripwire` (fail-open try/catch); marker
  fields additive/validated; watch-only snapshot path documented.

### Scenario: Torn ack lines are skipped; the partially acked batch still trips once (SM1.AC2)

- [x] RED — executed 2026-07-03T15:47Z (batch): 5 behavioral failures observed in
  `tests/hooks/retro-filing-gate.test.ts` pre-implementation (spy never called).
- [x] GREEN — executed 2026-07-03T15:55Z: 54/54 across gate + neighbor suites.
- [x] REFACTOR — tripwire isolated in `runTripwire` (fail-open try/catch); marker
  fields additive/validated; watch-only snapshot path documented.

### Scenario: Dispatched signatures still sitting in the spool trip nothing (SM1.AC2)

- [x] RED — executed 2026-07-03T15:47Z (batch): 5 behavioral failures observed in
  `tests/hooks/retro-filing-gate.test.ts` pre-implementation (spy never called).
- [x] GREEN — executed 2026-07-03T15:55Z: 54/54 across gate + neighbor suites.
- [x] REFACTOR — tripwire isolated in `runTripwire` (fail-open try/catch); marker
  fields additive/validated; watch-only snapshot path documented.

## Rule: Absent or pre-upgrade state fails open

### Scenario Outline: Degraded marker or ack state disarms the tripwire without changing gate behavior (SM1.AC3 — 4 examples)

- [x] RED — executed 2026-07-03T15:47Z (batch): 5 behavioral failures observed in
  `tests/hooks/retro-filing-gate.test.ts` pre-implementation (spy never called).
- [x] GREEN — executed 2026-07-03T15:55Z: 54/54 across gate + neighbor suites.
- [x] REFACTOR — tripwire isolated in `runTripwire` (fail-open try/catch); marker
  fields additive/validated; watch-only snapshot path documented.

### Scenario: Capture-off suppresses the tripwire; file-off alone does not (SM1.AC3)

- [x] RED — executed 2026-07-03T15:47Z (batch): 5 behavioral failures observed in
  `tests/hooks/retro-filing-gate.test.ts` pre-implementation (spy never called).
- [x] GREEN — executed 2026-07-03T15:55Z: 54/54 across gate + neighbor suites.
- [x] REFACTOR — tripwire isolated in `runTripwire` (fail-open try/catch); marker
  fields additive/validated; watch-only snapshot path documented.

## Rule: The filer acks before it drains

### Scenario: The filing seam records each ack after its post and before any drain (SM2.AC2)

- [x] RED — executed 2026-07-03T15:44Z: `npx vitest run tests/hooks/retro-filing.test.ts`
  → 1 failed / 3 passed; `readAcks` missing, seam returns no acks
  (`expected undefined to deeply equal [{signature, issue}]`).
- [x] GREEN — executed 2026-07-03T15:44Z: 4/4 pass. `FiledAck`/`ackFilePath`/`readAcks`
  (shape-only, fail-open) + per-post ack append in `fileSpooledDrafts` before
  `markDraftsFiled`; `DraftPoster` returns `{issue}`; three existing mocks widened.
- [x] REFACTOR — reuses `readJsonlRecords`/`appendJsonlRecords`; ack file uncapped
  by design (documented in impl-plan Known deviations); no duplication added.

### Scenario: Shipped prompts and the guide carry the ack procedure and drain prohibition (SM2.AC1)

- [x] RED — executed 2026-07-03T16:07Z: 4 failures in retro-filer-agent-defs.test.ts
  (no ack instructions, no drain prohibition, no guide paragraph).
- [x] GREEN — executed 2026-07-03T16:10Z: 24/24; both agent defs, dispatch text,
  and guide fallback updated; dogfood synced via parity-check.
- [x] REFACTOR — ack step numbered into the existing procedure; no duplication.

## Rule: The tripwire observes; it never surfaces or loops

### Scenario: A tripped evaluation emits nothing and decides exactly as an ack-clean one (TB1.AC1 — real Stop hook entry, fs-only mocking)

- [x] RED — executed 2026-07-03T16:02Z: 3 failures in stop-retro-filing.test.ts
  (stale dogfood libs + adapter file-guards blocked the watch-only path).
- [x] GREEN — executed 2026-07-03T16:04Z: 9/9 through the real hook subprocess;
  three adapters shed their file-guards (gate owns config semantics).
- [x] REFACTOR — decision-parity asserted against an ack-clean twin fixture.

### Scenario: The captured signal is allowlist-shaped and the retro spool is untouched (TB1.AC1)

- [x] RED — executed 2026-07-03T16:02Z (same batch): allowlist/spool assertions failed.
- [x] GREEN — executed 2026-07-03T16:04Z: RetroBareDrain record allowlist-only,
  retro spool byte-identical through a partial-drain trip.
- [x] REFACTOR — field allowlist pinned as an explicit key set in the test.
