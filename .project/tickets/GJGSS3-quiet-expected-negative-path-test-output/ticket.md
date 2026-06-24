---
id: GJGSS3
slug: quiet-expected-negative-path-test-output
type: task
phase: define-behavior
status: in_progress
scope:
  - Capture expected negative-path diagnostics in tests instead of leaking them into passing suite output.
  - Cover the known noisy duplicate-ticket lookup fixture and formatter command fixtures.
out_of_scope:
  - Changing user-facing CLI warning text.
  - Hiding unexpected subprocess failures.
done_when:
  - Expected noisy diagnostics are captured and asserted inside tests.
  - Focused verification passes for the touched tests.
created: 2026-06-24T14:49:00.471Z
last_modified: 2026-06-24T14:56:44.000Z
---

# Quiet expected negative-path test output

**Goal:** Keep passing full test runs quiet when negative-path fixtures intentionally print errors.

**Why:** Expected CLI and tool diagnostics in successful tests make long `dot` reporter runs harder to scan for real failures.

**GitHub:** https://github.com/ArcadeAI/safeword/issues/399

## Problem

During the PR #387 revalidation run, `bun run test -- --reporter=dot` passed, but the successful output included expected negative-path diagnostics such as:

- `go: warning: "./..." matched no packages`
- `no packages to test`
- `Already configured. Run safeword upgrade to update.`
- `CLI v0.55.0 is older than project v99.99.99.`
- `Not configured. Run safeword setup first.`
- `Ambiguous ticket ID "7K9M3P": 7K9M3P, 7K9M3P-spurious`

Those messages are useful assertions inside their tests, but noisy in a successful full-suite run.

## Observed Environment

- Date observed: 2026-06-24
- Worktree: `/Users/alex/.codex/worktrees/222a/safeword`
- Branch: `codex/revalidate-verify-audit-main`
- PR: #387
- Local head when filed: `02c95d351d3392215be21a8db6d9d94d23658e05`
- Base `origin/main`: `48e52173b3a3ec978cebe79793046f6a7afa3d08`
- OS: macOS 26.5.1 (25F80), `arm64`
- Shell: zsh 5.9
- Bun: 1.3.14
- Node: v24.16.0
- Safeword: CLI v0.55.0, project config v0.55.0

## Acceptance Criteria

- [ ] Tests that intentionally exercise error or edge paths capture expected stdout/stderr instead of leaking it into passing test output.
- [ ] Assertions still verify the important user-facing messages for those negative paths.
- [ ] The full CLI suite with `bun run test -- --reporter=dot` is quiet aside from Vitest progress/summary and intentionally documented unavoidable output.
- [ ] Any helper used to silence output is opt-in and does not hide unexpected failures.
- [ ] Focused tests cover the output-capture helper or the highest-volume noisy fixtures.

## Related Files

- `packages/cli/tests/`
- `packages/cli/tests/utils/`
- `packages/cli/scripts/run-vitest-with-build-lock.mjs`

## Root Cause

Several tests invoke real CLI or external tool flows and assert failure behavior, but the expected stdout/stderr is not consistently captured around those calls.

## Work Log

- 2026-06-24T14:56:44Z Filed: Created GitHub issue #399 and linked it here.
- 2026-06-24T14:52:28Z Updated: Added observed environment for the PR #387 full-suite output run.
- 2026-06-24T14:51:30Z Filed: Captured noisy-but-passing full-suite diagnostics from PR #387 revalidation.
- 2026-06-24T14:49:00.471Z Started: Created ticket GJGSS3
