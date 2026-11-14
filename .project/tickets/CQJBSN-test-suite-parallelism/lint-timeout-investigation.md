# Investigate the override-survival lint timeout

## Scope — 2026-10-25

User authorized diagnosis after the full branch quality review. Snapshot
`a91fa841d`; the original 56 reviewed source inputs remain unchanged. This
investigation belongs beside the existing test-parallelism work, without
changing its worker policy or reopening closed maintenance ticket 0G0NHM.

Preserve missing original observer RED and all 33 deferrals. No paid
qualification, stale branch merge, original closure, shared review-gate edit
or plugin-cache mutation.

## Confirmed observations

The earlier canonical first CLI pass failed in override-survival scenario 1.3
with `spawnSync bash ETIMEDOUT` at the existing 30000-ms child boundary. The
required second full CLI pass passed 11839 tests; the subsequent whole-file
reproduction passed all 10 cases in 25.09 seconds. The canonical aggregate
remains exit 1. These successes establish intermittency, not a cause or fix.

Upgrade completed before the failed hook call. The expected no-console
assertion was not reached. The TypeScript hook runs ESLint fix, Prettier and
ESLint check sequentially. The existing exception drops captured child output
and calls every spawn error a failure to start, so it cannot locate the stall.

## Competing hypotheses and disconfirming checks

1. Actual ESLint work slows under contention. Record each real bunx tool start
   and completion; a failure before ESLint starts would refute this account.
2. bunx resolution/cache work stalls before launching the local tool. Compare
   tool timings and inspect the surviving child tree if a boundary times out;
   consistently slow actual ESLint work would count against this account.
3. The Bash pipe or hook startup stalls. Tool starts inside the failing hook
   would rule out a stall entirely before hook execution.

No historical internal-stage timing exists, so no cause is established yet.

## Experiment log

- Temporary diagnostics live outside the checkout under
  `/Users/alex/.local/state/safeword/production-red-gate-B9M6FY/lint-timeout-debug-20261025/`.
  A Node preload intercepts only the existing Bash lint-hook call, preserves
  its inputs and timeout, and prepends an owned bunx tracing wrapper to that
  child's PATH. The wrapper delegates to the same pinned Bun 1.3.14 binary and
  records tool arguments, timing and host load. It adds an observable wrapper
  process, so timing results describe an instrumented experiment.
- Preflight confirmed the preload and wrapper run successfully. No committed
  fixture, assertion, production hook, timeout or pool setting was changed.
- Started one normal-wrapper run of override-survival, golden-path and
  python-golden-path together, retaining the default three-worker pool. It
  waits for the existing package test lock rather than running another Vitest
  concurrently. The unchanged cases provide real workload, not synthetic CPU
  saturation. All 36 cases in three files passed in 33.59 seconds, exit 0.
  The wrapper captured real ESLint/Prettier stages: TypeScript hook calls took
  roughly 2.8–7.0 seconds, with individual ESLint calls about 1.1–4.0 seconds.
  This validates the probe at normal load; it does not reproduce the timeout.
- Started one instrumented full CLI suite, unchanged default three-worker
  configuration. This is the first full run with internal stage timing, not a
  blind retry for a green result. Raw output is retained as `full-trace.log`.
- Extended the external preload to record actual Node ESLint/Prettier entry
  and exit, including CPU usage. A separate version-command preflight proved
  those markers work; existing wrapper-only traces remain distinguishable by
  their event inventory. No source input changed.
- A real controlled child timeout preserved both stdout and stderr in Node's
  result (`timeout-output-proof.json`). The current helper then discards both
  in its error branch. This proves the diagnostic-loss defect independently
  of the intermittent lint stall. Repairing that defect would improve future
  evidence but must not be described as repairing the original timeout.
- The exact scenario 1.3 completed during the instrumented full run in
  5704 ms. Both ESLint executions and Prettier started and ended normally.
  This rules out an always-failing scenario at these inputs, not any candidate
  transient mechanism at the time of the original failure. The remaining full
  run is still active; no aggregate success is asserted yet.

## Next

The instrumented full suite completed: 728 files passed, 11839 tests passed and
12 existing skips, 963.14 seconds, exit 0. All 38 traced hook invocations
completed without a spawn error; the largest took 8057 ms. No historical
failure-stage cause was reproduced, so none is claimed. `result.json` records
the trace inventory and exact scenario timing. The first failed canonical
aggregate remains retained separately.

The bounded diagnostic-loss repair is tracked in
`4FXYQV-preserve-lint-failure-evidence`; it does not solve or close this broader
parallelism workstream. Its tests must fail before its helper changes. The
original three stall hypotheses remain unresolved for the failed occurrence;
normal starts and exits in the successful run cannot rule them out historically.

Keep the external trace probe available for a recurrence. Do not replace
diagnosis with a timeout increase or repeated uninstrumented green runs. A
repair of the original stall still requires evidence of its mechanism.

## Final uninstrumented regression — separate Go failure

The stacked branch's final uninstrumented run after the diagnostic fix exited
1: 727 files passed, one failed; 11841 tests passed, one failed, 12 existing
skips, 978.64 seconds. The original override-survival scenario and all new
diagnostic cases passed. The failure was instead
`lint-go-context.test.ts`, `loads sibling declarations when the edited file is
a package test`, after 30813 ms.

Its separate async runner rejects with `new Error(stderr)` at its child close
handler. The observed stderr/message was empty; the handler did not retain
stdout, exit code or signal. It has its own 30000-ms execFile limit, so the
duration is consistent with that boundary but does not prove why it exited.
This file is unchanged from main and does not use the repaired helper. No Go
source, runner, assertion or budget was changed here.

One whole-file focused reproduction then passed all 18 Go cases in 15.61
seconds, exit 0. Preserve both results. The earlier Bash-only trace did not
instrument this different async runner, so it supplies no failure-stage cause
for the Go event. Follow-up should retain that runner's actual close code,
signal, output and internal tool timing before any repair. Do not call the
full regression green or classify this as the TypeScript timeout recurring.

This is a new observation in the existing reliability workstream, not a change
to the original observer's 33 recorded deferrals or missing historical RED.
