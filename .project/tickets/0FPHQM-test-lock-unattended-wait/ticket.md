---
id: 0FPHQM
slug: test-lock-unattended-wait
type: patch
phase: done
status: done
created: 2026-10-04T23:51:19.730Z
last_modified: 2026-10-04T23:51:19.730Z
---

# Let unattended checks wait out the shared test lock

**Goal:** A busy package test lock is reported as lock contention and the closeout guard waits it out, instead of failing verification

**Why:** Closeout previews were blocked by 'local verification failed' that was purely lock contention (#5311)

## Work Log

- 2026-10-04T23:51:19.730Z Started: Created ticket 0FPHQM
- 2026-10-04T23:52:45.865Z Phase: intake → done
