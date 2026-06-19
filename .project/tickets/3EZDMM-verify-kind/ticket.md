---
id: 3EZDMM
slug: verify-kind
type: task
phase: done
status: done
created: 2026-06-18T19:57:25.840Z
last_modified: 2026-06-18T19:57:25.840Z
---

# add --kind verify to test-plan for complete done-gate coverage

**Goal:** Add `--kind verify` to `safeword test-plan` so the `/verify` skill runs the full authoritative test suite instead of the fast `test:done` subset.

**Why:** `/verify` was resolving to `test:done` (8-second subset), silently skipping `tests/commands/` where session changes live — the done gate passed on green tests that never ran.

## Work Log

- 2026-06-18T19:57:25.840Z Started: Created ticket 3EZDMM
