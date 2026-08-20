---
id: PTJQ6X
slug: relay-scenario-fixed-clock
type: task
phase: intake
status: in_progress
created: 2026-08-20T05:05:34.901Z
last_modified: 2026-08-20T13:52:00.000Z
---

# Stop the retro relay wiring test failing under CI load

**Goal:** Give the `[ORR-001]` relay wiring scenario a delivery budget wide enough that it tests delivery semantics rather than machine speed, by setting `deadlineMs` on its relay config instead of inheriting production's 500ms default

**Why:** `deliverRelayRequests` bounds its drain loop at `monotonicNow() + (deadlineMs + RELAY_OVERALL_HEADROOM_MS)` and breaks on `monotonicNow() >= overallDeadline`. The test sets no `deadlineMs`, so it inherits `DEFAULT_RELAY_REQUEST_DEADLINE_MS` (500ms) plus 250ms headroom — a 750ms wall-clock budget for a loop that drains a real HTTP server, a real SQLite store, and payload crypto. On a loaded runner the loop breaks before delivering, and the undelivered request scores `retryable: 1, accepted: 0`, reddening CI on commits that cannot have caused it

## Work Log

- 2026-08-20T05:05:34.901Z Started: Created ticket PTJQ6X
- 2026-08-20T13:52:00.000Z **Corrected the diagnosis — the original one was wrong.** This ticket was filed claiming the cause was `now: Date.now` letting a loaded runner slip the store's `next_attempt_at` lease, with "inject a fixed clock into createRelayScenario" as the fix. Reading the code to implement that showed it is not the mechanism and the fix would have been inert:
  - The lease gate is `julianday(now) < julianday(retry_deadline_at)`, and `RELAY_RETRY_WINDOW_MS` is 24 hours (`accept()` further caps at `accepted_at + 1 day`). No CI run slips a 24-hour window.
  - The test's relay config **already** pins a fixed clock: `now: new Date('2026-07-26T00:00:00.000Z')`. Injecting another one changes nothing.
  - The real bound is `monotonicNow()`, which no injected `now` reaches. Real cause: the 750ms overall budget above, at `packages/cli/src/retro/relay-delivery.ts:2631` and `:2638`.

  Anyone who had picked this up as written would have injected a clock, watched the flake survive, and had to redo the investigation. Observed failure: PR #3205 run 32328980749, node 22 job, `expected { accepted: +0 } to deeply equal { accepted: 1 }` with `retryable: 1`; a re-run of the identical commit passed.
- Fix direction: set a generous `deadlineMs` on the test's relay config only. Production's 500ms ceiling is a deliberate product choice — a Stop hook must not stall on the network — and must not be widened to make a test pass.
