---
id: A9TQCD
slug: bdd-line-selectors
type: patch
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/7688
created: 2026-11-17T07:51:57.979Z
last_modified: 2026-11-17T07:51:57.979Z
---

# Run only the selected scenario when a BDD feature path has a line number

**Goal:** `test:bdd -- file.feature:12` runs only that scenario in scaffolded lanes

**Why:** The lane config missed Cucumber line selectors, so default globs merged in and every feature ran (#7688)

## Scope

- `templates/cucumber/cucumber.mjs`: a `.feature` path followed by `:<line>` selectors counts as a command-line feature path, so the default globs are dropped.
- New template hash in `cucumber-template-revisions.ts`; dogfood sync and regenerated surfaces.

## Out of scope

- Option values mistaken for feature paths (`--name checkout.feature`): predates this fix; proposed as a separate task.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-17T07:51:57.979Z Started: Created ticket A9TQCD
- 2026-11-17T07:55:00.000Z Implemented red-first: real-runner lane test (unselected scenario throws) fails on the old matcher with 2 scenarios and passes with 1. Refactored the test onto `runTestBdd`. Codex quality-review cf475e44: one pre-existing finding, out of scope. Verify and audit passed (see verify.md). PR #7687.
- 2026-11-17T07:55:00.000Z Phase: intake → done
