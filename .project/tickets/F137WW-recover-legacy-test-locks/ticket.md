---
id: F137WW
slug: recover-legacy-test-locks
type: patch
subtype: bug-investigated
phase: verify
status: in_progress
created: 2026-08-13T06:22:02.946Z
last_modified: 2026-08-13T10:03:30.000Z
---

# Let test queues recover locks created by older runners

**Goal:** Safely recover abandoned package-test locks written by the immediately preceding runner format.

**Why:** A dead legacy owner currently blocks every queued Vitest run until timeout, even though current-format stale locks recover automatically.

## Root Cause

The owner parser marks metadata as valid only when `kind` equals
`safeword-package-test-lock`. The immediately preceding owner schema has the
same PID, timestamp, checkout root, and token fields but no `kind`, so
`removeStaleLock` returns before evaluating whether that readable PID is dead.

Confirmed by subprocess tests through the real runner: a dead legacy owner
failed immediately and four contenders all timed out without starting, while
the equivalent marked dead-owner tests already recover. A current marked dead
owner also rules out PID liveness detection, and the existing abandoned-mutex
and marked contention tests rule out transition arbitration. A live legacy
owner remains protected today because invalid metadata fails closed; the fix
must retain that behavior and must not treat foreign `kind` values as legacy.

## Work Log

- 2026-08-13T06:22:02.946Z Started: Created ticket F137WW
- 2026-08-13T06:25:28.000Z Investigation: Reproduced the compatibility failure at the real runner boundary. Two RED tests prove dead legacy owners cannot recover singly or under contention; live legacy and foreign-owner cases define the fail-closed boundary.
- 2026-08-13T06:55:00.000Z Implemented: Recognize only the exact immediately preceding owner schema (absolute checkout root, valid timestamp, positive PID, UUID token, and no unknown fields). Recovery still runs inside the existing transition mutex.
- 2026-08-13T06:56:00.000Z Verified: Full lock-runner suite passes 30/30; Retro Relay passes 170 with one intentional skip; targeted ESLint, Prettier, TypeScript, whitespace, dependency audit, and diff-scoped architecture/config audit are clean. No Gherkin added because this internal mutex protocol is fully exercised through real subprocess integration tests rather than a user-facing CLI behavior.
- 2026-08-13T07:25:00.000Z Found: Post-rebase contention replay exposed #2751 in the existing transition arbitration: a nested recovery directory could race recursive transition removal, failing all four contenders. This directly blocked #2674's serialized-recovery acceptance boundary, so the dependency was included rather than weakening the test.
- 2026-08-13T07:32:00.000Z Fixed: Replaced the orphanable nested recovery mutex with atomic transition-directory renames. Recovery evaluates abandonment before mutation, exactly one contender can move an abandoned transition, and release moves its owned transition before deletion. Added an abandoned empty-transition subprocess case.
- 2026-08-13T07:38:46.000Z Revalidated: Rebased onto current `origin/main` (`28e66a53e`). Retro Relay passes 170 with one intentional skip; the lock-runner suite passed 32/32; TypeScript, ESLint, Prettier, whitespace, and `bun audit` were clean. The canonical repository verification completed successfully across tests, Gherkin, build, typecheck, and dependency lanes before the rebase; main's intervening files do not overlap this patch, and affected-surface proof was rerun after rebase.
- 2026-08-13T07:48:56.000Z Quality review: Closed the remaining stale-observation window by revalidating abandonment while holding the recovery marker. Transition ownership now carries the run's UUID token, and leave refuses to remove a transition whose PID/token identity changed. Tightened event partition assertions to compare exact parent PIDs.
- 2026-08-13T07:56:56.000Z Quality review: Closed #2755's false-green package boundary with the narrow fail-fast policy: manifests must declare a non-empty literal `files` list, unsupported glob/negation entries name themselves in the error, and missing literal entries fail directly. Made default-lock test temp routing portable across Windows environment conventions and bounded its child wait.
- 2026-08-13T08:05:14.000Z Quality review: Preserved unowned lock paths on POSIX by refusing candidate rename whenever the target already exists, including an empty-directory regression case. Raised the four-contender stress cap to measure serialization rather than machine load. Final affected suites pass 36/36 and 170 passed with one intentional skip.
- 2026-08-13T08:21:19.000Z Quality review: Transition owners now carry their own Safeword kind. Custom lock paths fail closed on unreadable/unmarked sibling transitions, while the Safeword-owned default temp namespace retains empty-transition recovery. Added a custom foreign-transition preservation case and a real multi-entry manifest snapshot happy path; increased the bounded cadence fixture's owner duration and removed a vestigial assertion. Final affected suites pass 38/38 and 170 passed with one intentional skip.
- 2026-08-13T08:29:46.000Z Quality review: Made transition publication atomic with its own candidate directory, so no new transition is ever observable without owner metadata and stale revalidation cannot hijack a fresh transition. Normal rename contention now handles both `EEXIST` and `ENOTEMPTY`; stale-lock age probes tolerate concurrent disappearance. The bespoke protocol remains for backward compatibility in this patch; replacement with an OS/advisory lock deserves a separate design ticket rather than an unbounded mechanism swap here. Final lock suite passes 38/38.
- 2026-08-13T08:44:58.000Z Quality review: Routed both initial and post-reap lock publication through one contention-safe helper, so a preceding-format runner that republishes during mixed-version rollout returns the current runner to its bounded wait instead of throwing. Repo-root path rebasing now treats split and `=`-joined flag spellings consistently, with real subprocess proof. Final lock suite passes 38/38.
- 2026-08-13T08:58:30.000Z Quality review: Transition release now reports a controlled failure and returns false instead of throwing from acquisition/release cleanup; no successful token or primary status is masked by a `finally` exception. Timeout guidance names the exact lock and safe manual-removal condition. Added real subprocess proof that direct runner invocation falls back to package-local Vitest when PATH has no Vitest, while the existing suite continues to prove a PATH-provided stub wins. Final lock suite passes 39/39.
- 2026-08-13T09:18:00.000Z Quality review: Replaced candidate-directory publication with atomic `mkdir` claims so POSIX cannot replace an older runner's empty directory. Interrupted empty lock/transition publication recovers after a bounded age, transition ownership is re-entrant for the same PID/token during cleanup, and timeout guidance names both paths. Removed the fixture-only manifest fallback; copied checkouts now use the real package contract. Package snapshots live under ignored `node_modules/.cache`, and the suite proves the real packaged CLI runs there with external dependencies. Added explicit non-zero build and Vitest status propagation. Final lock suite passes 44/44; TypeScript, ESLint, Prettier, whitespace, and dependency audit remain clean.
- 2026-08-13T09:22:30.000Z Quality review: Restored the fail-closed custom-path boundary for both empty and non-empty unmarked transition directories, with complementary subprocess cases. While holding the package lock, snapshot creation now removes only orphaned `safeword-test-package-*` siblings from the ignored cache before creating the next snapshot. Final lock suite passes 46/46; TypeScript, ESLint, Prettier, whitespace, and dependency audit remain clean.
- 2026-08-13T09:34:30.000Z Quality review: Made the fixed source-only GitHub live-smoke exemption explicit in the no-stale-dist guard instead of letting its wrapper evade Vitest-script discovery. Extracted and directly proved case-preserving Windows PATH selection plus the production default Node executable for Windows Vitest shims. Final lock suite remains 46/46; TypeScript, ESLint, Prettier, and whitespace checks are clean.
- 2026-08-13T09:42:30.000Z Quality review: Nested runners now preserve the enclosing run's canonical `SAFEWORD_TEST_CLI_ROOT` while reaping other orphaned snapshots; the regression covers macOS `/var` versus `/private/var` aliases. Default-namespace recovery now also handles an aged, truncated transition owner while custom paths remain fail-closed. Final lock suite passes 47/47; TypeScript, ESLint, Prettier, whitespace, and dependency audit are clean.
- 2026-08-13T09:55:30.000Z Quality review: Transition recovery markers now carry their own PID/token identity, never expire while that PID is alive, and are renamed only by their owner before deletion. Added a live-but-aged marker regression. Snapshot cleanup now tolerates concurrently disappearing entries and only reaps snapshots older than six hours, preventing runs with divergent custom lock paths from deleting each other's fresh snapshots. Final lock suite passes 48/48; TypeScript, ESLint, Prettier, whitespace, and dependency audit are clean.
- 2026-08-13T09:57:30.000Z Quality review: Moved the Windows runner rewrite behind a pure platform-injectable collaborator and directly proved Path-key selection, the literal Vitest command guard, Node executable selection, and module-before-test argument ordering on POSIX CI. Final lock suite remains 48/48; TypeScript, ESLint, Prettier, and whitespace checks are clean.
- 2026-08-13T10:03:30.000Z Quality review: Default-namespace residue recognition now admits only Safeword's `owner.json` and `recovery` entries, allowing the owned recovery-marker logic to unwind a crash between marker creation and transition-owner publication. Added the exact truncated-owner plus abandoned-marker subprocess regression. Final lock suite passes 49/49; TypeScript, ESLint, Prettier, whitespace, and dependency audit are clean.
