---
id: B17GEZ
slug: stale-readiness-receipt
type: patch
phase: done
status: done
created: 2026-10-06T03:45:11.999Z
last_modified: 2026-10-06T03:45:11.999Z
---

# Stop a stale readiness receipt from blocking another PR's Ready

**Goal:** Ignore a readiness receipt whose ticket is not on this branch so Ready is judged on the branch's own ticket (#5418)

**Why:** A checkout reused for a second PR was blocked by the first PR's leftover receipt, and the denial named a ticket the agent had never seen.

## Work Log

- 2026-10-06T03:45:11.999Z Started: Created ticket B17GEZ
- 2026-10-06T03:46:00.000Z Found: fix already shipped in PR #5434 (b69220ac9); receipt fallback now requires the ticket to exist in this checkout. Verified: 10,449 tests pass, build and typecheck clean, audit clean.
- 2026-10-06T03:46:11.943Z Phase: intake → done
