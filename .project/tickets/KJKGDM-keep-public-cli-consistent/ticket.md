---
id: KJKGDM
slug: keep-public-cli-consistent
type: task
phase: intake
status: in_progress
created: 2026-08-08T15:39:21.216Z
last_modified: 2026-08-08T15:39:21.216Z
external_issue: https://github.com/ArcadeAI/safeword/issues/2251
---

# Keep every public CLI command consistent for users and agents

**Goal:** Make every public command discoverable, machine-safe, option-accurate, and canonically documented without deleting retained aliases.

**Why:** Current main exposes commands outside the typed catalog, accepts ignored alias options, and teaches deprecated lifecycle names.

## Work Log

- 2026-08-08T15:39:21.216Z Started: Created ticket KJKGDM
- 2026-08-08T15:39:21.216Z Found: Repository audit identified public relay commands outside the typed catalog, ignored options on retained profile-install aliases, and canonical lifecycle terminology drift.
- 2026-08-08T15:39:21.216Z Tests: Additional BDD and contract coverage is required for help/capabilities completeness, relay machine output, alias option rejection, canonical prose, and alias retention.
- 2026-08-08T15:39:21.216Z Tracked: Filed GitHub bug #2251 before adopting it into this local work ticket.
