---
id: JZ6PNV
slug: keep-built-cli-stable-during-tests
type: patch
subtype: bug-investigated
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/1823
created: 2026-08-12T22:13:03.364Z
last_modified: 2026-08-13T00:23:00.000Z
---

# Keep package tests from deleting the CLI they exercise

**Goal:** Keep the built CLI and preset artifacts stable for the full lifetime of every package test run.

**Why:** Concurrent build-producing tests can clean packages/cli/dist while other tests execute the CLI, creating false-red verification and CI failures.

## Root Cause

The test runner built the CLI under `packages/cli/dist`, then left every CLI subprocess and every
fixture `file:` dependency pointed at that live package directory for the full parallel suite. The
same mutable directory was therefore serving three incompatible roles: build output, executable
under test, and package-install source. The cross-worktree lock serialized wrapper invocations but
did not make those artifacts immutable after the build.

The original issue's cross-worktree deletion theory was too narrow: Git worktrees have separate
`dist` directories, and the Node 24 CI failure happened in one checkout with no second wrapper.
Install-heavy focused runs also passed without mutation. The durable defect is the missing
isolation boundary, regardless of which concurrent source-tree operation exposes it.

## Done When

- The runner snapshots the built publishable package before Vitest starts.
- CLI subprocesses and `file:` package fixtures use that snapshot, while source-oriented tests can
  continue to inspect or mutate the live checkout deliberately.
- The snapshot is removed after success or failure.
- A regression test proves Vitest receives a private snapshot containing the built CLI.
- The install-backed TypeScript validation remains green even if live `dist` disappears after the
  suite starts.

## Work Log

- 2026-08-12T22:13:03.364Z Started: Created ticket JZ6PNV
- 2026-08-12T22:28:00.000Z Investigated: Ruled out overlapping wrapper builds inside the failing Node 24 job and failed to reproduce mutation with the three install-heavy fixtures alone. Confirmed that the full suite executed and installed from the live mutable package directory.
- 2026-08-12T22:28:00.000Z RED: The runner contract failed because `SAFEWORD_TEST_CLI_ROOT` was absent, proving there was no private built-package boundary.
- 2026-08-12T22:29:00.000Z GREEN: The runner now copies the publishable package entries after building, supplies the private root to Vitest, and removes it in `finally`. Shared helpers route both CLI execution and `file:` dependencies through that root.
- 2026-08-12T22:30:00.000Z Regression proof: Temporarily moved the live generated `dist` after Vitest started; all 11 TypeScript install/ESLint tests still passed from the snapshot, then the live directory was restored.
- 2026-08-13T00:20:00.000Z Quality review: Hardened stale-transition recovery, typed lock ownership, snapshot path/symlink containment, argv-safe synchronous CLI execution, timeout classification, and shell-free Windows Vitest resolution. Focused runner/helper suite passed 31/31.
- 2026-08-13T00:20:00.000Z Full verification: 490 files and 7,595 tests passed; 1,469 BDD scenarios/64,549 steps plus 50 proof scenarios/240 proof steps passed; builds, TypeScript, Bun audit, and govulncheck passed. The aggregate verifier exits 2 only because the repository-wide generated type plan incorrectly runs `mypy .` where no Python files exist.
- 2026-08-13T00:23:00.000Z Completed: Verification evidence recorded and PR #2659 opened to close GitHub issue #1823.
