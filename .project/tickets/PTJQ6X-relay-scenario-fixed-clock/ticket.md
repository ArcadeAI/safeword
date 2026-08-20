---
id: PTJQ6X
slug: relay-scenario-fixed-clock
type: task
phase: intake
status: in_progress
created: 2026-08-20T05:05:34.901Z
last_modified: 2026-08-20T05:05:34.901Z
---

# Stop the retro relay wiring test failing under CI load

**Goal:** Inject a fixed clock into createRelayScenario so [ORR-001] no longer depends on wall-clock timing

**Why:** The scenario builds its request with now: Date.now against a real store; when a loaded runner slips the next_attempt_at lease the request is classified retryable instead of accepted, reddening CI on an unrelated commit

## Work Log

- 2026-08-20T05:05:34.901Z Started: Created ticket PTJQ6X
