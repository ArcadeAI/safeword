---
id: HWVKKQ
slug: prevent-false-go-lint-errors
type: task
phase: implement
subtype: bug-investigated
status: in_progress
created: 2026-10-21T16:51:50.189Z
last_modified: 2026-10-21T16:51:50.189Z
---

# Prevent false lint errors for Go developers

**Goal:** Lint complete Go packages in their module context while preserving customer configuration and bounded edits

**Why:** Resolve issues #4733, #5105 and #5427 without replacing package-loading failures with config or diagnostic regressions

## Work Log

- 2026-10-21T16:51:50.189Z Started: Created ticket HWVKKQ

## Scope and completion

Implement the independently approved design in design.md. Resolve issues 4733,
5105, and 5427 together. Preserve Go configuration context, report package scope honestly,
format only the edited file, and retain warnings alongside errors. No unrelated
language changes, dependency upgrades, or new Cursor notification mechanism.

Completion requires real package-loading regressions, config-base/resource
negative controls, helper/host wiring, cleanup/signal tests, version-matrix CI,
typecheck/lint, generated-surface and dogfood parity checks, and code review.

## Root Cause

The shared hook passes one Go file to golangci-lint and inherits project-root cwd.
The first omits sibling definitions; the second loses nested-module import context.
Confirmed with real Go/linter fixtures and the current source hook. Ruled out:
invalid package code (go test passed), tool absence (linter ran), and independent
host defects (the shared source hook reproduced both errors). Changing cwd alone
also changes config bases and resource paths; design.md preserves that context.

## Test plan

Integration tests exercise the real source hook and CLI, using real Go and
 golangci-lint for package/config loading; process stubs cover signals and command
cwd/argv. See design.md for the complete proof matrix. Local missing-tool skips
are explicit; CI must provision tools and fail rather than skip the proof lane.

## Work Log (continued)

- 2026-10-21 Implementation authorized after independent proposal approval.
- 2026-10-21 Starting with RED tests for same-package tests and nested imports.
- 2026-10-21 RED: the original source hook failed four real regression checks,
  including sibling test declarations and nested-module imports.
- 2026-10-21 GREEN: 88 focused tests passed, including Claude/Codex/Cursor process
  boundaries, config normalization, signal cleanup, and fallback ownership.
- 2026-10-21 Compatibility: 28 tests passed on golangci-lint v2.0.0 with Go 1.24.13.
  The test harness clears inherited GOROOT only when explicitly selecting a
  different Go binary; production Go environment remains inherited.
- 2026-10-21 Checkpoint committed to satisfy the change-size gate. Final delivery
  will include the new configuration module and the latest generated bundles.
- 2026-10-21 Final compatibility probe found unsupported config-path expansion
  on golangci-lint v2.0.0. Corrected with installed-version gating; added a
  native-output regression test and obtained another independent approval.
- 2026-10-21 Final source passed 24/24 manual real-linter checks across both
  versions. All 601 acceptance scenarios passed. Build, lint, typecheck, parity
  and generated-surface checks passed. Full CLI/smoke/proof-tag Vitest checks
  were lock-limited; dependency audit flagged unchanged dependencies. See
  verify.md for exact evidence and remaining verification. Not marked done.
- 2026-10-21 Remote verification completed successfully in run 39667499218:
  11626 CLI tests per Node lane, 30 tests per Go lane, 601 acceptance scenarios,
  51 proof-tag tests and 83 release tests per Node lane. Audit fixed oversized
  Codex warning feedback; two behavior-preserving refactors were committed.
  Independent reviews approved the implementation and inventory correction.
  All CI checks pass; verify.md supersedes the earlier local limitations.
- 2026-10-21 Test-quality follow-up: strengthened five policy tests with finding-producing
  controls; automated genuine sibling type errors, retained fixable misspellings,
  malformed-policy warnings, spawn failure cleanup, report failure handling,
  cleanup failure reporting, and partial-write cleanup under a child-only OS
  file-size limit. All 37 focused tests pass with real v2.13.2/Go 1.25 tooling.
  Two temporary source mutations were detected: suppressing findings failed all
  five policy controls; omitting partial-write cleanup failed its regression.
  Source was restored after both experiments. ESLint and TypeScript pass.
