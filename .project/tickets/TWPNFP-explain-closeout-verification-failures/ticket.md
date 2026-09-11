---
id: TWPNFP
slug: explain-closeout-verification-failures
type: task
phase: verification
status: in_progress
created: 2026-09-11T00:16:46.744Z
last_modified: 2026-09-11T01:42:00Z
---

# Explain closeout verification failures to maintainers

**Goal:** Make closeout identify unavailable tools and failed verification commands with bounded actionable output before cleanup.

**Why:** Closeout collapsed missing dependencies and command failures into one opaque local-verification blocker, forcing manual reconstruction.

## Scope

- Preserve the locked Python runner in generated test plans even when it is unavailable.
- Capture a bounded tail from verification command output.
- Include the unavailable runner or failed command, working directory, exit status, and useful output in closeout blockers.
- Keep the generic blocker as a compatibility fallback when no detailed failure is available.

## Out of Scope

- Installing project dependencies during closeout.
- Changing which verification kinds closeout runs.
- Changing cleanup authorization or deletion safety rules.

## Scenarios

- Given a uv-locked project without `uv`, when Safeword resolves mypy, then it emits `uv run mypy .` as unavailable instead of borrowing global mypy.
- Given a verification command that fails, when closeout builds its cleanup plan, then the blocker names the command, cwd, exit status, and bounded diagnostic tail.
- Given an unavailable verification entry, when closeout builds its cleanup plan, then the blocker names the runner and recovery context without executing cleanup.
- Given an older observation with no detailed failures, when verification failed, then closeout retains the existing generic blocker.

## Test Plan

- Add focused resolver coverage for a missing uv runner.
- Add focused process coverage for captured and truncated stdout/stderr.
- Add cleanup-plan coverage for detailed and backward-compatible verification blockers.
- Run closeout guard, test-plan resolver, parity, typecheck, and formatting checks.

## Root Cause

The exact-tree lifecycle fixtures were refreshed before the final closeout hardening commits. Those later commits changed the generated closeout script on Cursor's managed delivery surface, so the fixture's tree digest no longer described the branch head. The existing byte-for-byte contract reproduced the CI failure locally and passed after regenerating the fixtures from the final source tree.

Ruled out: a Node 24 compatibility regression, because the lifecycle result digests were identical and the same stale tree digest reproduced locally; locale-dependent ordering, because both the default locale and `LC_ALL=C` produced the same current digest.

The release lane then exposed a separate `prefer-const` violation in the installed closeout script. The repository lint did not report it because the root CLI override intentionally relaxes that rule, while the release contract correctly applies Safeword's shipped host preset to the installed customer surface. Moving the timer declaration to its single assignment fixed the source template without changing behavior; regenerated dogfood and plugin copies now pass the release validation.

## Work Log

- 2026-09-11T00:16:46.744Z Started: Created ticket TWPNFP
- 2026-09-11 Defined: Preserve locked runners and surface bounded per-command diagnostics without auto-installing from closeout.
- 2026-09-11 Implemented: Kept locked Python invocations visible, reported the actual unavailable toolchain, and added bounded per-command closeout diagnostics.
- 2026-09-11 Hardened: Closeout now settles on command exit so an output-inheriting descendant cannot hold verification open indefinitely.
- 2026-09-11 Verified: Focused resolver and closeout unit tests pass; all 27 host-adapter integration tests pass with registry access.
- 2026-09-11 Audited: No change-scoped architecture or test-quality error; evidence recorded in verify.md.
- 2026-09-11 CI debug: Refreshed the Cursor lifecycle tree fixtures after the final generated-script changes; the 13-case origin/main contract now passes at the branch head.
- 2026-09-11 Release debug: Fixed the installed-surface `prefer-const` error at the template source, regenerated every managed copy, and passed the four-case shipped TypeScript validation plus the refreshed 13-case lifecycle contract.
