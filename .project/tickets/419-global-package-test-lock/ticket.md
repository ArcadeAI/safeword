---
id: "419"
slug: global-package-test-lock
type: task
phase: done
status: done
scope:
  - Serialize default `packages/cli` package test runs across safeword checkouts on one machine.
  - Keep `SAFEWORD_TEST_LOCK_DIR` as an explicit isolation override for tests.
  - Bound lock waiting so a non-reapable holder cannot block every checkout indefinitely.
out_of_scope:
  - Changing Vitest worker counts or suite partitioning.
  - Adding OS-level CPU or memory throttling.
  - Changing package scripts other than the existing test runner wrapper.
done_when:
  - Default test runner invocations in different checkouts share one lock and serialize.
  - Override lock directories still isolate test runner checks.
  - Dead-owner stale locks are reaped.
  - Waiters proceed with a warning after a configurable cap.
created: 2026-06-24T17:02:00-07:00
last_modified: 2026-06-24T17:15:13-07:00
---

# Serialize package tests across checkouts

**GitHub:** https://github.com/ArcadeAI/safeword/issues/419

**Type:** Bug

**Scope:** The `packages/cli` test wrapper should prevent multiple safeword checkout/worktree package test runs from competing for the same local CPU/RAM by sharing one default machine-wide lock.

**Out of Scope:** Suite speed work, Vitest pool configuration, OS priority tuning, and broader process management.

## Figure-It-Out Decision

Decision: choose a machine-global mutex for `bun run --cwd packages/cli test`.

Options considered:

- Machine-global mutex: use one constant default lock name for all safeword checkouts.
- Capacity semaphore: allow N concurrent runs through multiple lock slots.
- OS priority throttling: lower runner priority with `nice`/similar scheduling controls.

Recommend the machine-global mutex because the observed safe concurrency is exactly one and the existing wrapper already has the correct atomic lock and stale-lock reaper primitives. A semaphore is only justified after measured evidence that N>1 is stable under full load; priority throttling does not control memory pressure.

Premortem: the mutex could over-serialize short focused runs behind a long full suite, so keep the wait notice clear and add a configurable bounded wait escape hatch.

Next: edit `packages/cli/scripts/run-vitest-with-build-lock.mjs` and extend `packages/cli/tests/test-runner-lock.test.ts`.

## Tests

- [x] Default lock path is stable across distinct checkout roots.
- [x] Concurrent package test runners serialize when using the default global lock.
- [x] `SAFEWORD_TEST_LOCK_DIR` still isolates focused test cases.
- [x] A dead-owner lock is reaped before acquiring.
- [x] A held lock stops blocking after the configured wait cap and emits a warning.

## Work Log

- 2026-06-24T17:02:00-07:00 Started from GitHub issue #419 after syncing to `origin/main` (`abe156a`).
- 2026-06-24T17:06:00-07:00 Revalidated current bug with two temporary checkout-shaped runner copies: default pre-fix locks overlapped because the key was derived from each checkout root.
- 2026-06-24T17:15:13-07:00 Implemented constant default lock name plus `SAFEWORD_TEST_LOCK_MAX_WAIT_MS`; verified with `bun run --cwd packages/cli test tests/test-runner-lock.test.ts --reporter=dot`, `bun run lint`, and `git diff --check`.
