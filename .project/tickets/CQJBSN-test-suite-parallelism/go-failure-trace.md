# Trace the Go lint-context subprocess failure

## Scope and prior evidence

User authorized continuation on 2026-10-25 at source snapshot `597f44825`.
The earlier stacked full regression failed in the sibling-declarations Go case
after 30813 ms; its async runner reported an empty error and discarded the exit
code, signal and stdout. The subsequent whole-file rerun passed all 18 cases.
Neither observation proves the historical cause. The TypeScript diagnostic
repair remains separate, and both failed aggregates remain retained.

Do not change the existing 30000-ms deadline, worker policy, assertions,
production hooks, shared review gates or plugin cache. Preserve missing
historical observer RED and all 33 deferrals. No paid qualification, original
closure or stale branch merge.

## Competing hypotheses

1. The parent terminated a still-running hook. Require the actual
   `Timeout.delayedKill` stack before classifying it as the 30000-ms deadline;
   a maxBuffer overflow can also call child.kill but follows a different stack.
   A parent kill request alone does not prove a timeout. If the timer fired,
   the internal tool trace must then locate the remaining work.
2. The hook exited unsuccessfully itself. A nonzero code before any timer kill
   and captured output distinguishes this from the outer deadline.
3. An external signal killed the hook. A signal exit without a recorded parent
   kill request distinguishes this from that parent's timeout mechanism.

If the deadline fires, possible inner stages include tool discovery/version,
Go configuration/package resolution, formatting or package lint. A successful
run cannot rule out any of these at the historical failure time.

## Instrumentation and preflight

External probe root:
`/Users/alex/.local/state/safeword/production-red-gate-B9M6FY/go-timeout-debug-20261025/`.

A Node preload observes only direct Bun post-tool-lint execFile calls in the
Go-context fixtures. It records parent kill requests, close code/signal,
elapsed time and captured streams. The original deadline and stdin behavior
are unchanged. A golangci-lint wrapper records real tool starts/exits and
forwards signals to its owned child. Delegation restores the original PATH so
the mise shim follows its original resolution instead of recursing.

The real executable resolves through the existing shim to golangci-lint
2.13.2, built with Go 1.27.0; the selected Go executable is 1.25.14. Both original
and wrapped version checks returned the same version. `mise which` alone said
the linter was inactive, but the existing shim command executed successfully;
no installation or version change was needed.

A separate controlled probe deliberately withheld stdin from a hook with a
1000-ms experimental deadline. It recorded Node's timer kill, null exit code,
SIGTERM and `killed: true`. This validates the observer; it is not a reproduction
or explanation of the historical failure. Symbol metadata on execFile is
preserved so promisified callers retain their original contract.

## Live experiment

Started one normal-wrapper run of lint-go-context, golang-golden-path and
go-lint/config with the normal three-worker pool. SAFEWORD_REQUIRE_GO_LINT=1
requires actual Go tooling rather than silently skipping it. External wrappers
add process overhead; no synthetic CPU load or source mutation was introduced.
Raw output: `three-file-trace.log`; completed results are recorded below.

The focused experiment completed: all 47 cases in three files passed, exit 0,
21.60 seconds. All 23 observed Go-context hook calls closed normally; the
largest took 1923 ms and was the first sibling-declarations case. It recorded
two version calls, formatting and package lint, all with code 0. Later cases
intentionally produce lint findings while the hook itself still closes 0.

Started one full instrumented run on the preserved stacked checkout at
`e8e64c1eb`, where the historical full failure occurred. This avoids treating
the isolated branch's different source tree as the failing context. The probe
now also samples only owned process descendants every five seconds, retaining
CPU time, memory, state and executable names without command arguments. No
synthetic delay or resource saturation was introduced. The source tree,
deadlines and worker configuration remain unchanged. Raw output: `full-trace.log`.

## Historical next step before the full run

Inspect close and per-tool events. If the historical failure does not recur,
record non-reproduction rather than assigning a cause from a successful trace.
Only propose a repair after identifying an actual failing mechanism.

## Completed full-run observations

The instrumented full CLI run exited 1: 727 files passed and one failed;
11839 tests passed, one failed and 14 were skipped, in 1022.17 seconds.
The skip count is two higher than the prior run's 12, retained in
[the diagnostic repair's raw excerpts](../4FXYQV-preserve-lint-failure-evidence/evidence/verification-excerpts.txt); the default output does
not identify those cases, so no cause or proof credit is assigned to them.
No test skip was added or changed by this investigation. These are separate
from the original observer's 33 deferrals.

The Go-context file was not the failing file. All 23 observed hook calls
closed with code 0, no signal, `killed: false` and no parent kill request. The
maximum was 1258 ms. The first observed hook took 1075 ms; its two version
calls, formatting and package lint all exited 0. Other cases deliberately
produce lint findings while the hook still exits 0. The normal caller's own
assertions remained in place.

No observed hook reached the five-second process-sampling interval. The process
sampler was separately checked against an owned Node process; that does not
provide a process snapshot from the historical failure. The controlled
one-second stall validates timer observation only. Neither control recreates
the historical Go event or proves its cause.

The full-run failure was instead native-planning-copy-dispatch's
claude/product-plan case. Its initial canonical command returned null status
with empty displayed streams after the case ran for 24405 ms. That helper has
a 20000-ms spawnSync limit, but the test assertion did not capture or display
the result's `error` or `signal` fields; their absence from the log is not
evidence that they were absent from the result. A timeout
is therefore consistent with the evidence, not established. The later drift
assertions were not reached in that failed case. One uninstrumented whole-file
repeat in the same preserved stacked checkout at `e8e64c1eb` then passed all six
cases in 26.27 seconds, exit 0. This does not prove
a root cause or a shared cause with the Go failure. No shared review code was
changed.

## Retained proof and limits

Evidence is under [evidence/go-failure-trace-20261025](evidence/go-failure-trace-20261025):

- `focused-result.json` and `full-result.json`: measured hook inventory and
  separate command outcomes. Exit codes are observed tool-completion metadata,
  not signed execution attestations.
- `controlled-timeout.jsonl`: the deliberately stalled control, including
  Node's actual `Timeout.delayedKill` stack and SIGTERM close.
- `first-sibling-case.jsonl`: the first observed full-run Go hook's raw events.
- `log-excerpts.txt`: verbatim focused, full-failure and native-repeat tails.
- `source-snapshot.json`: hashes for six Go pipeline files in both workspaces,
  which match, and the external probe's source hashes.
- `probe-*.txt`: snapshots of the probe source for provenance, not installed or
  portable launchers. The executable probe remains at the external path above.

The original stacked checkout remained at `e8e64c1eb`; no Go implementation,
test, timeout or worker-setting change was made. The original failed Go and
TypeScript aggregates remain failed. Passing reruns are not retrospective
failure evidence and do not close the original work.

The probe only observes commands explicitly launched with its preload; it is
not a permanent repair of the async runner's missing diagnostics. A cause of
the historical stall remains unproved. No further blind full-suite rerun or
timeout increase is justified by these successful Go traces.

## Probe improvement after review

The original probe did not time the promisified `go test .` calls before the
first two hook cases. The historical 30813 ms is the entire case duration, not
an observed hook duration; it cannot be split retrospectively. The successful
full run also has this blind spot.

The external `preload-v2.cjs` retains the first probe's hook observer and adds
observation around Node's original promisify implementation. It returns the
original Promise and child without changing invocation, output or deadline.
A separate single-file validation passed all 18 cases in 18.53 seconds, exit
0, recording 23 normal hook closes and both pre-hook Go commands. Those Go
commands took 1150 ms and 48 ms and both exited 0. This improves the next
capture; it does not add missing timings to the prior full run.

`v2-focused-result.json`, two `go-test-*.jsonl` records and `probe-v2.cjs.txt`
retain this separate validation. `source-snapshot.json` now also records
post-run Git commit observations for both workspaces, explicitly not a sealed
start-of-run attestation. The full run still used the original probe snapshot.

For the next warranted run, use the v2 preload at the external probe root.
No repository implementation or test was changed by either observer.

**Next:** Retain the Go failure as unresolved and use `preload-v2.cjs` from the
external probe root on the next warranted full run. An actual recurrence must
capture the kill origin, close code/signal, streams and active tool stage.
Keep the native-planning observation separate and coordinate it with the
existing branch-review work.
