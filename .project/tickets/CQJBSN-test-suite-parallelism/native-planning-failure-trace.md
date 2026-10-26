# Trace native-planning subprocess failures

## Scope and failure under investigation

User authorized continuation on 2026-10-25 from `bc67245ef`. The prior
instrumented full run on preserved stacked `e8e64c1eb` failed the native
claude/product-plan canonical command: null status and empty displayed streams,
case duration 24405 ms. Its caller has a 20000-ms spawnSync deadline but did
not display error or signal. A later uninstrumented whole-file repeat passed
all six cases. Neither result establishes the cause.

Capture actual process outcomes and stage evidence before proposing a repair.
No deadline, assertion pass/fail condition, worker policy, production code,
shared review gate or plugin cache change. Preserve all failed aggregates, missing historical RED
and the original 33 deferrals. No paid qualification or stale branch merge.

## Competing hypotheses

1. The parent process deadline or another spawn failure produced null status.
   Capture `error.code` and `signal`; do not infer ETIMEDOUT from duration alone.
2. Review work was still running when the parent stopped. Observe only the
   fixture's job states, worker PID, reviewer call count and process tree to
   distinguish pre-dispatch, reviewer execution and result publication.
3. A completed job was not delivered promptly to the foreground caller.
   A completed record before a still-pending parent would support this path;
   a job still running would refute that specific explanation.

No historical job snapshot or omitted process fields can be recovered from
the original empty assertion output.

## Observer and controls

External probe root:
`/Users/alex/.local/state/safeword/production-red-gate-B9M6FY/native-timeout-debug-20261025/`.

A Node preload observes only the native-copy fixture's review spawnSync calls.
It returns the original result unchanged, retains error/code/signal/streams,
and records invocation order. An owned external monitor is necessary because
the parent's event loop is blocked by spawnSync. It samples selected job
fields and process metadata every 500 ms. It reads no signing keys, tokens,
environment values or packet bodies and writes no review records. The
canonical child's restricted environment is passed through unchanged.

The monitor stops after the observed call or at a bounded deadline. It adds
overhead, so these are instrumented experiments, not an unmodified runtime.
A separate deliberate 1500-ms control captured null status, SIGTERM,
ETIMEDOUT and both test output streams. This validates capture only, not the
historical cause.

## Experiments

The first instrumented run covered native-planning-copy-dispatch and
installed-planning-copy-admission together with the normal worker pool. All
18 cases passed in 46.27 seconds, exit 0. The native fixture made 24 observed
commands: six canonical approvals, twelve deliberate drift refusals and six
post-restoration approvals. Normal approvals took roughly a second; the
deliberate refusals are expected nonzero exits, not harness failures.

The combined native-copy, Go-context and override-survival validation passed all 34 cases in three files in 29.81 seconds,
exit 0. The observers coexist without changing fixture results. One full run
then started on the clean preserved checkout at `e8e64c1eb`, with all three
known failure families observed. `full-start.json` records the actual commit,
clean status and pre-run trace inventory before launch.

A separate local Bun 1.3.14 control checked a possible missed spawn-event race
with short-lived children and listener-attachment delays of 0, 10, 50 and
150 ms. All 20 children emitted spawn and exited 0. This counts against that
specific primitive-race explanation; it does not rule out every job lifecycle
race or explain the historical failure. It was a controlled experiment, not
synthetic load applied to the verification runs.

## Final observations and diagnostic repair

The combined instrumented full run exited 0: 728 CLI files passed, 11840 tests
passed and 14 skipped, in 992.23 seconds. This ran on preserved stacked
`e8e64c1eb1c9929e9ead31d762ec0aa78b7c8c69`, not the isolated diagnostic
branch. All 24 native calls returned their expected statuses: twelve approvals
and twelve intentional refusals, with no error or signal. Maximum observed
native call duration was 1454 ms. The failure did not recur; its cause remains
unknown. This successful experiment does not erase prior failed aggregates,
prove the isolated branch's full suite, supply missing RED, or qualify a release.
The 14 runtime skips are separate from the original 33 deferrals.

On `codex/preserve-lint-failure-evidence`, five existing process-status
assertion messages now use Node's `inspect` on the complete process result.
The prior messages retained only stdout/stderr, hiding error and signal when
status was null. All matchers, commands, environments and deadlines remain
unchanged. `depth: 2` includes Error properties; `maxStringLength: Infinity`
preserves complete stream strings. A real controlled timeout verified that
this representation retains ETIMEDOUT, SIGTERM and both streams. This fixes
reporting only; the control does not establish the original failure's cause.
No new entry point, dependency or formatting-only test was added.

The modified six-case integration file passed in 26.38 seconds. Its log is
retained alongside the full-run result, all 24 bounded result records, probe
hashes and controlled-timeout output in
`evidence/native-planning-trace-20261025/`. Complete external raw traces remain
at the probe root above. Targeted ESLint and CLI typecheck passed (observed exit 0); all 56 original
reviewed stacked inputs still match their prior hashes. Independent Claude
review `b77373f9-42bd-4fac-90c8-bd0d7e720129` approved with no errors. Its
warning about the missing-copy status message was applied. The pre-existing
negative `.not.toBe(0)` checks accept null before later JSON parsing fails;
this limits diagnostics for those paths, but cannot make the entire test pass
on empty output. Changing those predicates is outside this reporting patch.
Final independent Claude review `9075542e-1b30-4391-a5dc-1a06869f18ee`
approved with no errors and retained that non-blocking negative-path limitation.
The reviewer checked the exact patch and confirmed unchanged pass conditions.

## Next

Retain the improved failure reporting and investigate an actual recurrence
using its error, signal and job-stage evidence. Do not change shared review
gates, deadlines or worker policy based on the successful experiments.
