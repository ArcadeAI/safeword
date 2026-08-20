# Test-capacity responsiveness decision

**Status:** Decided
**Date:** 2026-08-12

## Decision frame

How should the package test runner give a focused validation request a prompt, actionable result while preserving the repository-wide rule that no two Vitest processes run concurrently?

## Research plan

| Domain | Question to answer |
| --- | --- |
| Node process control and filesystem coordination | Can the lock holder be safely paused, cancelled, or otherwise preempted without orphaning a test process? |
| Vitest execution model | Does Vitest provide a supported way to insert or prioritize another run without a second process? |
| Scheduling and recovery UX | Which response makes a blocked focused run predictable and recoverable without pretending it executed? |

## Candidate directions

1. Bounded fail-fast: return promptly with the live owner and a retry action; preserve the existing global exclusive lock.
2. FIFO queue: admit waiters fairly after the current owner, but retain the wait for a long full suite.
3. Cooperative preemption: interrupt a lower-priority full suite when a focused run arrives, then resume/retry it later.

## Research findings

- Node can abort or terminate a child process, but its synchronous child APIs wait until a SIGTERM-handling child exits. A lock holder therefore cannot safely guarantee prompt, cross-worktree preemption. [Node child-process docs](https://nodejs.org/api/child_process.html)
- Vitest exposes worker and file-parallelism controls inside a run, but its CLI models `run` and `watch` as whole-run operations. It offers no documented mechanism to inject a focused request into an already-running process. [Vitest CLI](https://vitest.dev/guide/cli)
- Long-running work should state what is happening and how to recover; an indeterminate wait gives no useful decision point. [Apple progress guidance](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)

## Decision

Recommend **a short default fail-fast wait with an explicit longer-wait override** because it gives the blocked developer a prompt, truthful recovery path while preserving the one-Vitest invariant. FIFO queueing is useful for fairness but does not solve the long-owner latency and is already tracked in #2200. Cooperative preemption was rejected: it needs cross-worktree cancellation and can discard or orphan another suite's evidence.

**Premortem:** six months from now this fails if the shorter default causes background verification to abandon too often; mitigate it now by naming the current owner and retaining `SAFEWORD_TEST_LOCK_MAX_WAIT_MS` as the explicit opt-in for a longer wait.

**Next:** write the failing default-wait integration test in `packages/cli/tests/test-runner-lock.test.ts`.

## Revalidation: 2026-08-13

The decision remains live: current `HEAD` still has the 20-minute generic cap, and
12 fresh retro reports collapsed into canonical issue #1484. The worktree-scoped
change remains the smallest correct response.

- **Process safety:** Node documents that `spawnSync()` blocks until the child exits or
  is terminated; terminating a sibling worktree's run is therefore not a safe,
  prompt scheduler. [Node child-process documentation](https://nodejs.org/api/child_process.html)
- **Test-run model:** Vitest's CLI exposes controls for a run's own workers and
  file parallelism, not an API for admitting a focused request into a different
  active run. [Vitest CLI](https://vitest.dev/guide/cli)

Steelman FIFO: it improves fairness among waiters but still leaves the developer
waiting for a long owner and remains separately tracked by #2200. Preemption is
more responsive in theory, but it risks interrupting or orphaning another
worktree's evidence. A bounded, owner-aware fail-fast is correct, minimal, and
preserves the repository's no-concurrent-Vitest invariant.

**Premortem:** the short default could cause unattended work to stop too often;
the explicit `SAFEWORD_TEST_LOCK_MAX_WAIT_MS` override retains a deliberate
long-wait escape hatch.

**Next:** run the scoped independent quality review, then rerun verification when
the shared test capacity is available.

## Revalidation: 2026-08-14

### Figure-It-Out rerun

- **Frame:** choose a response to a blocked focused package-test request that
  stays safe if another worktree owns the only permitted Vitest run; the choice
  is wrong if it starts a second run, interrupts valid evidence, or leaves the
  developer without a clear next action.
- **Options:** bounded owner-aware fail-fast; FIFO scheduling; cooperative
  preemption.
- **Research domains:** Node process termination semantics, Vitest's documented
  concurrency model, and recovery ergonomics for a blocked developer.
- **Evidence:** Node documents that a delivered kill signal is not proof a child
  exited, and that children of children are not terminated by killing their
  parent. Vitest documents worker and file parallelism *within* one run, with no
  cross-process priority or admission mechanism. [Node child-process
  docs](https://nodejs.org/api/child_process.html) · [Vitest
  parallelism](https://vitest.dev/guide/parallelism) · [Vitest
  maxWorkers](https://vitest.dev/config/maxworkers)

**Decision:** retain the 60-second, owner-aware fail-fast. FIFO is the strongest
alternative for fairness but still makes an interactive request wait behind a
long owner and remains correctly scoped to #2200. Preemption loses because a
signal cannot safely establish that another worktree's runner and its children
stopped; it risks corrupting or orphaning its evidence. The bounded wait is the
smallest option that is both truthful and preserves the one-Vitest invariant.

**Premortem:** if unattended verification begins to give up too often, the
60-second default will look too aggressive; the existing
`SAFEWORD_TEST_LOCK_MAX_WAIT_MS` override lets callers deliberately choose a
longer wait without weakening the safe default.

**Next:** run the focused lock-runner integration test, then the task's full
verification and diff audit while the shared lane is free.
