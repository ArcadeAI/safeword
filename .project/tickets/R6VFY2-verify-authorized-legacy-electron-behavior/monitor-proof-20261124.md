# Whole-test exception correction — November 24

The review found a real false positive after renderer readiness. The original
installed extended bundle accepted a selected mutant that both removed package
metadata and scheduled an uncaught renderer error. Its sole Playwright assertion
failed at the declared line 39, so the JSON-only evaluator accepted the execution.
No independent review, row authorization or VERIFIED entry was requested for that
diagnostic. It remains explicitly uncredited evidence.

The real original execution returned `observed` at delivery HEAD
`a1ba355a9787b897387f59aed0c7aec5507dce65`. The exact before/after request and
actual raw output are committed under the delivery ticket as
`renderer-after-readiness.rejected-request.json` and
`renderer-after-readiness.before-monitor.result.json`. The older module-load
throw diagnostic was correctly refused, but did not cover this later event.

The portable public-runner regression in f1ece78f3 emitted the actual public
BrowserContext event from its controlled external Electron fixture. The old
runner resolved instead of rejecting: one failed / 13 passed in
`/tmp/issue163-unreported-exception-red-valid.log`. The earlier malformed fixture
attempt is retained separately and is not claimed as RED. Initial fixture code
had an escaped-quote syntax error; fixing that fixture restored the 13 existing
passes and isolated the actual false-positive failure.

Decision research covered public browser error APIs, Node/Electron preload
semantics, exception handling, source immutability and lifecycle ownership.
Checking stderr alone misses renderer events. Patching the archived test helper
would alter reviewed executable inputs. The fixed runner-owned preload captures
public events without changing those files. Playwright 1.62.1 strips NODE_OPTIONS
for Electron, so the wrapper adds only the owned main `-r` monitor argument.
The main monitor does not swallow exceptions. PID-specific startup, renderer
arming and completed close records are all required. Missing or malformed
telemetry cannot supply positive evidence. This remains trusted-project
monitoring, not an OS sandbox against malicious code running as the same user.

Independent implementation-plan review 6109fa78 approved this decision. Execution
review 20089b00 approved the current RED, implementation and final replay sequence.
Both use separate headless Claude review. Their warnings are nonblocking:
root test filters do reach CLI after the two preceding package suites; the direct
packages/cli invocation is used for focused work to avoid repeating those suites.
P-regression and P-full include the monitor file even though the original
P-contract command does not list it separately.

The first focused protection run passed 32 tests. Expanded process/authorization
protection passed 45. An actual source-CLI rerun of the exact real diagnostic
then returned `blocked` with `RETROSPECTIVE_OBSERVATION_FAILED` and
`Electron uncaught exception or renderer crash: Error: SAFEWORD_DIAGNOSTIC_AFTER_READINESS_EXCEPTION`.
Its logs are `/tmp/issue163-source-monitor-real-negative.json` and the matching
stderr log. This proves the source implementation boundary; supported generated
installation and final all-17 closing remain separate delivery checks.

No earlier observation is rewritten to claim this monitoring. The new runner
strengthens enforcement of the existing uncaught-exception rule; final closing
must execute every original and mutant through it at the final committed HEAD.
