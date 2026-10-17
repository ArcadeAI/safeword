# Correct Cursor installation expectations for the new budget

CI run 39050221069 failed at a970c16dc38c71309225eb0fd36cd28af22830b2.
Both Node jobs reported the same two setup-cursor.test.ts assertion failures:
the native hook timeout was 2400, while the tests still expected 90. Each full
CLI run had 680 files: 679 passed / 1 failed, with 11232 tests passed / 2 failed /
10 skipped. The BDD successor was not reached in this failed CI run. Contract,
audit, parity, lint and OpenCode conformance passed. Raw failed logs are retained.

The repair changes only those two expected policy values to `40 * 60` and
clarifies the nearby comment. The assertions still compare exact values; the
complete custom-hook preservation array, failClosed, matcher, hook paths,
ordinary shell timeout and stop loop limit are unchanged. The production code,
templates, generated carriers, acceptance scenarios and rejection rules remain
byte-identical to a970c16.

The full failing CI provides RED evidence. The focused installed-CLI Cursor
setup tests plus physical native-budget checks then passed 19/19 across 2 files
in 6.77 seconds. This extends the final budget's earlier 198-test verification;
it does not relabel either failed full aggregate as passed. The previous actual
source-adapter success remains evidence for unchanged production source. Fresh
exact-head CI is required after this test-only correction.

Independent Claude Opus review 3f2dd4de-53f4-47fc-a835-49b8ff92dc49 approved
the changed test file, with no errors. Its advisory gaps concern existing
Cursor nudge coverage, fresh-install entry counts, a duplicate directory-only
check and placement of shared handbook guidance. These do not affect the two
policy expectations or weaken existing assertions. Broader Cursor-suite cleanup
is outside this surgical correction; no complete Cursor coverage claim is made.

The adjacent timeout-results.md and verify.md retain prior checkpoints. The
PR body is the durable record for final committed-head CI and merge readiness.
