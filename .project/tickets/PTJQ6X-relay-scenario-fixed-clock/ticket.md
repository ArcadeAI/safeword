---
id: PTJQ6X
slug: relay-scenario-fixed-clock
type: task
phase: intake
status: in_progress
created: 2026-08-20T05:05:34.901Z
last_modified: 2026-08-20T14:05:00.000Z
---

# Stop the retro relay wiring test failing under CI load

**Goal:** Make `[ORR-001]` in `packages/retro-relay/tests/cli-wiring.integration.test.ts` survive a single transient first-attempt delivery failure, so it stops reddening CI on commits that cannot have caused it

**Why:** The scenario asserts a one-shot delivery run accepts the request first try. Any transient failure on that first attempt schedules a retry `RELAY_RETRY_BACKOFF_MS` (60s) out; the run is single-shot, so it ends with the request still spooled — scoring exactly `accepted: 0, retryable: 1`. The test tolerates zero transient failures, which is why it is load-sensitive

## Observed failure

PR #3205, run `32328980749`, `test (node 22.23.2)`:

```
AssertionError: expected { accepted: +0, …(4) } to deeply equal { accepted: 1, …(4) }
-   "accepted": 1,      +   "accepted": 0,
-   "retryable": 0,     +   "retryable": 1,
```

A re-run of the identical commit passed. Node 24 passed the same commit. Not reproducible locally on node 24.16.0 or node 22.23.2 (full suite, 185 passed, both).

## Investigation — three hypotheses ruled out

Recording these so the next person does not repeat them.

1. **Store lease slipped under load** (the original filing). Wrong. The claim gate is
   `julianday(now) < julianday(retry_deadline_at)`, and `RELAY_RETRY_WINDOW_MS` is 24 hours,
   with `accept()` capping at `accepted_at + 1 day`. No CI run slips a 24-hour window.

2. **Inject a fixed clock into the scenario.** Inert. The relay config *already* pins
   `now: new Date('2026-07-26T00:00:00.000Z')`, and delivery does not use it —
   `retro.ts` passes `now: () => Date.now()` to `deliverRelayRequests`. There is no
   frozen-vs-real mismatch between the retry schedule writer and its reader; both use
   the same real clock.

3. **The 750ms overall drain budget.** Not demonstrated. `deliverRelayRequests` bounds the
   loop at `monotonicNow() + (deadlineMs + RELAY_OVERALL_HEADROOM_MS)`, and the test inherits
   production's `DEFAULT_RELAY_REQUEST_DEADLINE_MS` (500ms) + 250ms. Forcing `deadlineMs: 1`
   (a 251ms budget) locally still passed all six `[ORR-001]` cases, so the budget is not
   binding at anything near that scale. It remains a theoretical contributor under extreme
   load but was not shown to be the cause, so no fix was shipped for it.

**Key disambiguation:** `retryable` is computed as the count of spool files still present at
the end (`parsePrimary` / `parseMaterializing` / `parseClaim`), i.e. a generic "was not
delivered" signal. It does **not** fingerprint any particular failure path, which is why the
counters alone cannot identify the cause.

## Where to go next

The remaining candidate is a transient failure inside the first delivery attempt (HTTP to the
in-process server, SQLite contention, or claim contention), which then defers behind the 60s
backoff. Suggested approach:

- Instrument the scenario to capture *why* the first attempt failed, rather than only the
  final counters — the current assertion discards the cause.
- Then either remove that failure source, drain retries within the scenario, or shrink
  `RELAY_RETRY_BACKOFF_MS` for the test.
- Do **not** widen production's 500ms request budget to make a test pass; that ceiling is a
  deliberate product choice (a Stop hook must not stall on the network).

## Work Log

- 2026-08-20T05:05:34.901Z Started: Created ticket PTJQ6X
- 2026-08-20T13:52:00.000Z Corrected the original diagnosis (hypothesis 1) — see above.
- 2026-08-20T14:05:00.000Z Ruled out hypotheses 2 and 3 as well; hypothesis 3 was disproved by
  experiment (`deadlineMs: 1` still passes). Reverted the speculative `deadlineMs` change rather
  than shipping a fix for an unproven cause — a placebo would have left the flake live while
  reading as resolved. Ticket stays open with the dead ends and a reproduction strategy recorded.
