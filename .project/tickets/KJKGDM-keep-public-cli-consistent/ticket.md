---
id: KJKGDM
slug: keep-public-cli-consistent
type: task
phase: verify
status: in_progress
created: 2026-08-08T15:39:21.216Z
last_modified: 2026-08-08T19:04:31Z
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
- 2026-08-08T19:04:31Z Implemented: Routed both public relay recovery commands through the typed catalog and shared renderer, narrowed retained profile-only alias options, and canonicalized operative install/uninstall language.
- 2026-08-08T19:04:31Z Tested: Added help/catalog bijection, machine-contract, alias parser-boundary, documentation, and acceptance coverage; isolated host profiles in CLI acceptance fixtures.
- 2026-08-08T19:04:31Z Verified: Full tests, affected acceptance features, build, lint, typecheck, dependency analysis, vulnerability audit, and generated plugin parity are green on current main.
- 2026-08-08T19:04:31Z Audited: Diff scope matches GitHub issue #2251; no actionable correctness, security, test-quality, or maintainability findings remain.
