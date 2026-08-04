---
id: 84GNG0
slug: split-github-rest-transport-tests
type: task
phase: intake
status: in_progress
created: 2026-07-31T03:22:03.979Z
last_modified: 2026-07-31T03:22:03.979Z
---

# Make GitHub transport regressions easier to isolate

**Goal:** Separate transport pagination and authentication tests into focused suites

**Why:** The current large test module slows diagnosis and obscures ownership boundaries

**Scope:** Split `github-rest.test.ts` into transport/pagination and
authentication-focused suites, share only fixture helpers, and preserve every
assertion and test name's behavioral intent.

**Out of Scope:** Production transport changes, new authentication behavior, or
reducing coverage to make the split easier.

## Done When

- [ ] Pagination, marker deduplication, comment transport, and auth resolution have clear suite ownership.
- [ ] No test is deleted or weakened during the move.
- [ ] Each focused suite can run independently and the combined runtime does not regress materially.

## Tests

- [ ] Capture the pre-split test inventory and compare it with the post-split inventory.
- [ ] Run both focused suites, the complete retro suite, lint, and typecheck.

## Work Log

- 2026-07-31T03:22:03.979Z Started: Created ticket 84GNG0
- 2026-07-31T03:23:00.000Z Deferred: Release refactor review identified test-ownership debt; production snapshot extraction landed separately in v0.70.
