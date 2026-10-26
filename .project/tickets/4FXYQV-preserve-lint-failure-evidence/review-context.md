# Diagnostic repair review context

## Review questions

Does the helper preserve available stdout/stderr on failures without changing
which results fail? Does timeout detection use the Node error code, with a
negative control for misleading message text? Do the tests discriminate the
missing behavior while retaining the real hook proof? Do the records avoid
claiming that better diagnostics repaired the original intermittent stall?

## Frozen code and proof

Code snapshot `2eed79125`, following RED commit `64616e87b`. The three new
diagnostic cases failed before implementation, with six prior cases passing.
After implementation, all 19 cases passed across lint-hook-result and the real
override-survival fixture, exit 0. Root ESLint, Gherkin lint and CLI typecheck
also passed. No assertion was removed or weakened.

The tests compare complete messages through an asymmetric object matcher.
The timeout fixture follows the real Node result: code ETIMEDOUT, null status
and SIGKILL. The non-timeout fixture has code ENOENT and misleading ETIMEDOUT
message text. A pure result-to-error test is appropriate for this helper;
the existing override-survival fixture exercises real installed hook wiring.
The controlled-timeout JSON is actual output from a separate deliberate Node
timeout, not evidence from the historical lint stall. It shows the output
available at the boundary which the helper previously discarded.

This repair adds no entry point, dependency, timeout, pool setting, retry,
production-hook change or shared-review policy change. Local Node 24.18.1's
actual subprocess result and the installed child_process typings are the
primary API evidence; no external version or security claim is needed.

## Unresolved historical stall

The prior canonical verify aggregate remains exit 1 after override-survival
scenario 1.3 hit the existing 30-second lint child limit. The unchanged required
second full pass and subsequent whole-file pass succeeded. This investigation
then ran three files together with external stage instrumentation: 36 cases
passed. One instrumented full run passed all 728 files and 11839 tests, with
12 existing skips, in 963.14 seconds. All 38 traced hooks completed; the
slowest took 8057 ms and scenario 1.3 took 5704 ms. Both actual ESLint calls
and Prettier completed in that scenario.

That successful experiment does not identify the historical stall's cause.
An uninstrumented full regression run of the repaired code is now running;
its final result is not yet claimed. External trace tooling is retained under
`/Users/alex/.local/state/safeword/production-red-gate-B9M6FY/lint-timeout-debug-20261025/`.
No additional synthetic CPU stress or paid qualification was run.

## Authority and snapshot limits

The original 56 paths reviewed at b78e5fcc9 have not changed. This patch adds
two further code/test paths to that historical snapshot. The previous
maintenance receipt used helpers.ts as context and is now historical rather
than a fresh approval of the changed helper. This new review covers the
diagnostic delta; it is not a forged aggregate of those earlier receipts.

Missing original observer RED and all 33 deferrals remain. No original ticket
closure, stale #5857 merge, shared gate/cache edit or PR promotion is authorized.
The task remains open for verification; CQJBSN is not closed by this narrow fix.
