---
id: XTY8FE
slug: resilient-review-cli-resolution
type: task
subtype: bug-investigated
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/2185
created: 2026-08-10T19:23:53.696Z
last_modified: 2026-08-10T19:23:53.696Z
---

# Keep review workflows runnable without a global Safeword binary

**Goal:** Make every Safeword review workflow resolve a compatible CLI in installed projects and source worktrees.

**Why:** Review instructions currently fail before coordination whenever bare safeword is absent from PATH.

## Work Log

- 2026-08-10T19:23:53.696Z Started: Created ticket XTY8FE
- 2026-08-10T19:28:00.000Z Root cause: coordinator-calling skills execute bare `safeword`; the dogfood root and CLI workspace share a package name, so Bun does not create a root `.bin/safeword` self-link. Existing `verify` already demonstrates capability-based local/source/bunx resolution.
- 2026-08-10T19:28:00.000Z Red: strengthened `review/surface-parity.test.ts` to require a review-capable resolver on every coordinator caller and reject bare invocations.
- 2026-08-10T19:32:00.000Z Green: all five canonical coordinator callers now probe local, source-checkout, and bunx routes for `review run` support; synchronized ten dogfood mirrors and five Codex plugin assets. Targeted surface-parity test passes (10 tests).
- 2026-08-10T21:47:00.000Z Verification: parity (252 pairs, 8 contracts), lint, Gherkin lint, and both package typechecks pass. Retro-relay full suite passes (167 passed, 1 skipped). CLI full suite could not start because the repository-wide Vitest lock remained owned by PID 74183 in `/Users/alex/Projects/safeword`; stopped only this worktree's queued wrapper after 5m30s.
- 2026-08-10T19:20:00-05:00 Quality/refactor: centralized five duplicated resolvers in a schema-managed launcher; added bundled-plugin routing, exact-version fallback, strict SemVer validation, bounded capability probes, and real source/plugin wiring tests. Independent coordinator approved the result (degraded same-agent coverage because Claude timed out).
- 2026-08-10T19:20:00-05:00 Done: full lint, typecheck, build, dependency audit, parity, generated-tree checks, repository audit, retro-relay suite, and CLI suite pass. Final CLI result: 479 files, 7,353 passed, 5 skipped.

## Tests

- [x] Every canonical coordinator caller selects a CLI that supports `review run`.
- [x] No canonical coordinator caller invokes bare `safeword review run`.
- [x] Claude dogfood and generated Codex skill copies remain in parity with templates.
- [x] Claude plugin workflows use their bundled, sealed CLI before any registry fallback.
- [x] Capability probes time out and fall through safely; registry fallback is pinned and SemVer-validated.

## Root Cause

Review skills invoked bare `safeword`, but the dogfood workspace root and CLI
package share the same package name, so Bun does not create a root self-link and
interactive shells do not add a project `.bin` directory to `PATH`. Confirmed by
`bun install` leaving `node_modules/.bin/safeword` absent while the source CLI
worked.

Ruled out: the coordinator itself requiring a global binary—the source and built
entry points preserve identical coordinator behavior. Ruled out: missing review
support in the current CLI—the source entry point passes `review run --help`.

Full verification also exposed a separate brittle fixture: the explanation test
gave both the intentionally hanging primary reviewer and the instant fallback an
800 ms attempt ceiling. Under full-suite CPU contention, the fallback sometimes
missed that ceiling and correctly reported `timed_out` instead of the fixture's
intended `invalid_output`. Raising only the fixture budget preserves the behavior
under test without changing production deadlines.
