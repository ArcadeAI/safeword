---
id: PD63KG
slug: prevent-wip-feature-completion
type: task
phase: done
status: done
created: 2026-08-27T15:03:58.791Z
last_modified: 2026-08-27T17:41:17Z
---

# Prevent unfinished BDD features from closing

**Goal:** Block ticket completion when its referenced feature still contains @wip, consistently across supported agent hosts including OpenCode.

**Why:** A completed OpenCode ticket retained @wip, so aggregate BDD results excluded its scenarios while verification claimed they passed.

**Type:** Bug

**Scope:** Make feature completion validate the referenced Gherkin source and block when any Feature, Rule, Scenario, or Examples scope remains tagged `@wip`. Use one shared check across Claude, Cursor, Codex, and OpenCode's enforceable pre-tool boundary, and distinguish an absent test lane from a failed test-plan resolution.

**Out of Scope:** General `@proof.vitest`, `@manual`, or `@live` provenance standardization; changes to Cucumber's development-time tag filters; unrelated done-gate hardening.

**Done When:**

- [x] A feature may use `@wip` while work is active but cannot be marked done while its referenced feature contains `@wip` at any supported Gherkin scope.
- [x] Claude, Cursor, Codex, and OpenCode reach the same unfinished-feature validation contract; blocking diagnostics name the feature and OpenCode exposes a bounded plain recovery message.
- [x] Failure to resolve the test plan blocks completion; a project with genuinely no configured test lane retains the existing fallback behavior.

**Tests:**

- [x] Integration: the shared done-evidence path rejects feature-level and nested `@wip` through a real ticket directory and feature file.
- [x] Integration: Claude's stop gate rejects the same fixture through its host entry point.
- [x] Integration: OpenCode's blocking pre-tool dispatcher rejects the closing edit while the referenced feature remains `@wip`.
- [x] Unit/integration: test-plan resolution failure is distinct from no configured tests and fails closed.
- [x] Regression: a completed feature without `@wip` and legacy ledgers without `Feature source:` preserve current behavior.

## Root Cause

The done gate checked only ledger checkboxes and aggregate test success. Because the acceptance lane intentionally excludes `@wip`, a checked ledger plus a green unrelated Cucumber aggregate could close a feature whose own scenarios never executed. Test-plan resolution errors were also collapsed into the same `skipped` state as a project with no test command.

## Work Log

- 2026-08-27T17:41:17Z VERIFIED: Full CLI suite passed 8,610 tests across 533 files (13 intentional skips); full BDD passed 1,483 scenarios and 68,144 steps (3 scenarios and 4 steps skipped), plus 34 proof tests. Lint, typecheck, release contract, lifecycle contracts, template parity, and diff checks are clean.
- 2026-08-27T17:41:17Z REVIEWED: Refactor review retained the shared validator as the smallest coherent abstraction. Independent quality review approved after adding real generated-plugin wiring coverage and a fail-closed guard for unsupported structured output in OpenCode exit-code mode. Diff-scoped audit passed with no ticket-relevant findings.
- 2026-08-27T15:20:29Z GREEN: OpenCode now preserves edit/write content through its canonical envelope and blocks the closing edit through the same shared unfinished-feature check; 9 focused profile/dispatcher tests pass.
- 2026-08-27T15:19:11Z RED: OpenCode preserved neither edit/write content in its canonical envelope nor the closing-edit guard; the real dispatcher allowed an `@wip` feature to close (2 focused failures). Scope corrected to include OpenCode's enforceable pre-tool boundary because its stop event is observational.
- 2026-08-27T15:08:34Z RED: A resolver process exiting non-zero was still reported as a successful skipped test lane, confirming the fail-open state.
- 2026-08-27T15:08:02Z GREEN: Shared done-evidence validator now rejects exact `@wip` tag lines at all supported Gherkin scopes and reports the referenced feature plus line; 15 focused tests pass.
- 2026-08-27T15:07:20Z RED: Shared done-evidence tests proved Feature-, Rule-, Scenario-, and Examples-level `@wip` all incorrectly allowed completion (4 focused failures).
- 2026-08-27T15:04:18Z Planned: Scoped the repair to shared unfinished-feature validation and fail-closed test-plan resolution; deferred broader proof-lane standardization.
- 2026-08-27T15:03:58.791Z Started: Created ticket PD63KG
