---
id: TQQGZS
slug: local-acceptance-verification
type: task
phase: done
status: done
created: 2026-07-28T16:16:12.923Z
last_modified: 2026-07-28T20:47:14Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1455
---

# Run acceptance coverage locally for contributors

**Goal:** Give contributors one local command that runs both the unit and acceptance suites.

**Why:** Prevent changes that pass unit checks locally but fail the Gherkin acceptance lane in CI.

**Type:** Improvement

**Scope:** Add one documented root-level test command that runs the existing unit and Gherkin acceptance lanes sequentially.

**Out of Scope:** Changing the meaning or cost of `bun run lint`, altering CI jobs, or modifying Safeword's generated customer scripts.

**Done When:**

- [x] `bun run test:all` runs the root unit suite before the root BDD suite.
- [x] The contributor testing guide identifies `bun run test:all` as the complete local test command.
- [x] A regression test protects both command wiring and documentation.

**Tests:**

- [x] Unit: the root manifest's `test:all` script composes `test` then `test:bdd`.
- [x] Unit: the README directs contributors to `test:all` for complete local coverage.

## Work Log

- 2026-07-28T20:47:14Z COMPLETE: User confirmed TQQGZS can be completed. All listed outcomes and verification checks are recorded in `verify.md`.
- 2026-07-28T16:31:42Z VERIFY: Focused contract test (2/2), root BDD lane, lint/typecheck, configuration sync, whitespace check, and diff-scoped audit passed. The aggregate `test:all` process completed, but the runner did not preserve its final transcript; see `verify.md` for this evidence limit. Ready for user confirmation; ticket remains in progress by policy.
- 2026-07-28T16:18:40Z GREEN: Added the root `test:all` contract and contributor documentation; the deterministic contract check passes.
- 2026-07-28T16:18:05Z RED: The manifest had no `test:all` script and the README called the Vitest suite “All tests”; recorded with the direct deterministic check while the shared Vitest lock was occupied.
- 2026-07-28T16:16:25Z Decision: preserve fast linting; add `test:all` as the explicit unit-plus-acceptance contract after comparing script, CI, test-plan, and acceptance-lane evidence.
- 2026-07-28T16:16:12.923Z Started: Created ticket TQQGZS
