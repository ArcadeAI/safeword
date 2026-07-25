---
id: MV2FZH
slug: keep-default-tests-hermetic
type: patch
phase: verify
status: in_progress
created: 2026-07-25T14:34:21.269Z
last_modified: 2026-07-25T15:53:30Z
---

# Keep default tests hermetic

**Goal:** Prevent the default Vitest suite from waiting on live package-manager installs.

**Why:** Reliable local and CI verification must not depend on registry availability.

## Work Log

- 2026-07-25T15:53:30Z Improved: Recorded the three R/G/R loops with durable commit or skip evidence so the ticket ledger passes the boundary gate.
- 2026-07-25T15:51:00Z Fixed: CI exposed that skipped-install fixtures could not run generated BDD scripts. Successful skipped-install setup now links the CLI package's already-installed test dependencies, preserving offline fixture setup.
- 2026-07-25T14:34:21.269Z Started: Created ticket MV2FZH
- 2026-07-25T14:37:00.000Z Found: Default `setupOrThrow` fixtures launched live npm installs; the slow external-install lane is already excluded from the default Vitest config.
- 2026-07-25T14:37:00.000Z Implemented: Default fixture setup now sets `SAFEWORD_SKIP_INSTALL=1`, while caller-provided environment values take precedence.
