---
id: 070
slug: publish-0-27
type: task
status: done
phase: done
---

# Task: Publish safeword 0.27.0

**Type:** Release

**Scope:** Publish the accumulated changes since 0.26.1: dep bumps, publish gate, template sync fix, parity test error message fix.

**Blocked By:** Ticket 069 (commander 14 verification) — should verify CLI works before publishing.

**Done When:**

- [ ] Commander 14 verified (ticket 069)
- [ ] Full test suite passes
- [ ] `bun publish` succeeds (test:release gate passes)
- [ ] Dogfood upgrade works with new version

## Work Log

- 2026-03-28 Created. Current published: 0.26.1. Accumulated changes: dep bumps, publish gate, template sync.
