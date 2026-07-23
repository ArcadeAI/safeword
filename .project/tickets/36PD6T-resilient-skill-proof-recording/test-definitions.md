# Test Definitions: Keep skill verification proof working in normal shell commands

Feature source: `features/resilient-skill-proof-recording.feature`

## Rule: resilient-skill-proof-recording.SWM1.R1 — A documented helper command records proof for its requested skill

### Scenario: Recognized helper path records current-session proof on each runtime

- [x] RED 2026-07-22: real Cursor adapter integration rejected the documented helper after macOS resolved the checkout through `/private/var` while the command retained `/var`; the full Codex BDD suite also exposed a regression rejecting its same-root `$CLAUDE_PROJECT_DIR` form.
- [x] GREEN 2026-07-22: Codex and Cursor record both exact relative and installed absolute helpers in `codex-cursor-skill-fallback.test.ts`; the full Codex parity scenario accepts `$CLAUDE_PROJECT_DIR` only when the hook environment proves it names the active root.
- [x] REFACTOR 2026-07-22: path comparison canonicalizes only existing absolute paths; relative and documented project variables remain explicit allow-list entries, while arbitrary variable reassignment is rejected.

## Rule: resilient-skill-proof-recording.SWM1.R2 — Each helper command in one shell command retains its own current-session proof

### Scenario: Distinct chained skills record ordered proof on each runtime

- [x] RED 2026-07-22: `bun run test tests/integration/codex-cursor-skill-fallback.test.ts` — Codex records `verify` but the real following `audit` helper reports `no run identity`.
- [x] GREEN 2026-07-22: the real packaged Codex dispatcher and Cursor adapter record `verify`, then `audit`, in order.
- [x] REFACTOR 2026-07-22: one shared ordered queue removes the former duplicate Codex cache writer.

### Scenario: Repeated chained skill records one proof per invocation on each runtime

- [x] RED 2026-07-22: the old one-entry bridge could retain at most one receipt from a repeated chain.
- [x] GREEN 2026-07-22: the real adapter-to-helper tests record two `verify` receipts on Codex and Cursor.
- [x] REFACTOR 2026-07-22: queue consumption preserves duplicate entries instead of de-duplicating skill names.

### Scenario: Short-circuited chain does not retain proof for its unexecuted tail on each runtime

- [x] RED 2026-07-22: a chained Cursor command was unbound before the root-alias correction; the short-circuit regression now reaches the real helper path.
- [x] GREEN 2026-07-22: `verify && false && audit` retains only `verify` on both runtime adapters.
- [x] REFACTOR 2026-07-22: the parser accepts only the contiguous helper-only `&&` prefix.

## Rule: resilient-skill-proof-recording.SWM1.R3 — Unrecognized paths and missing or expired identities never produce proof

### Scenario: Non-executing or lookalike helper path does not record proof on each runtime

- [x] RED Not applicable: the prior parser already rejected `.bak`; this is a retained fail-closed regression guard.
- [x] GREEN 2026-07-22: both adapters leave no cache for a lookalike command, and the real helper subsequently reports no identity.
- [x] REFACTOR 2026-07-22: exact path checks are centralized in the shared parser.

### Scenario: Foreign-project absolute helper path does not record proof on each runtime

- [x] RED 2026-07-22: the pre-fix generic parser accepted an arbitrary absolute helper path.
- [x] GREEN 2026-07-22: both adapters reject a foreign-root absolute helper and the current-project helper cannot consume a proof.
- [x] REFACTOR 2026-07-22: absolute helper paths must canonicalize to the current project root.

### Scenario: Missing session identity does not record a receipt on each runtime

- [x] RED Not applicable: missing identity was already fail-closed; retain this safety regression guard.
- [x] GREEN 2026-07-22: both adapters with an empty session/conversation id produce no helper receipt.
- [x] REFACTOR 2026-07-22: the shared writer rejects empty identities before it creates a cache.

### Scenario: Expired session identity does not record a receipt on each runtime

- [x] RED Not applicable: expiry was already fail-closed; the queue representation must preserve that behavior.
- [x] GREEN 2026-07-22: unit tests expire both Codex and Cursor queue entries after five minutes.
- [x] REFACTOR 2026-07-22: stale queue heads remove the complete cache rather than leaving a tail behind.

### Scenario: Out-of-order helper request does not record a receipt on each runtime

- [x] RED Not applicable: out-of-order consumption was previously fail-closed; retain it across the new queue representation.
- [x] GREEN 2026-07-22: Codex and Cursor cache tests clear the queue if `audit` asks ahead of queued `verify`.
- [x] REFACTOR 2026-07-22: readers consume only a fresh matching head and never scan ahead.

## Feature-level cross-scenario refactor

- [x] cross-scenario 2026-07-22: shared path trust, queue semantics, and adapter wiring are covered by 55 focused unit/integration tests plus template-to-dogfood parity.
