# Verification report

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: the complete resolved plan ran two CLI suites under a child PATH selecting Bun 1.4.0 instead of required 1.3.14; 8 generator failures reproduced that explicit version refusal. A second pass also hit one 500ms fake-reviewer deadline assertion. Explicit pinned Bun/Node rerun of all three affected files passed 145/145 tests. Prior frozen production suite passed 10,453 CLI tests; production bytes remain unchanged by this acceptance-fixture/report follow-up. Relay 198/198 and collector 153/153 passed.
**Gherkin:** ✅ Acceptance lane passes — both resolved runs passed 596/596 scenarios and 11,118/11,118 steps; BDD proof 47/47 passed.
**Build:** ✅ Success — complete resolved build plan, including website and detected language projects.
**Lint:** ✅ Clean — root lint and Gherkin lint passed.
**Typecheck:** ✅ Clean — complete resolved typecheck plan, including Astro and Python, passed.
**Scenarios:** ⏭️ Skipped — investigated bug task has no feature scenario ledger; its observable proof matrix is in process-assessment.md. Existing acceptance scenarios were corrected, not newly authored feature behavior.
**Refactor:** ✅ No change warranted — existing packet identity, classifier and normalizer remain authoritative; separate assessment records the rationale.
**PR Scope:** ✅ Diff matches ticket scope — verified exclusion transport, exact authored coverage, coordinator classification and generated delivery; current follow-up repairs the resulting exact-key acceptance contract and records process evidence.
**Dep Drift:** ⚠️ Existing supply-chain scans reported 10 JavaScript advisories (3 high, 4 moderate, 3 low) and 6 urllib3 2.7.0 advisories in the Python experiment. No dependency manifests or lockfiles changed in this PR. This is not a clean dependency scan and no unrelated dependency upgrade was applied.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — existing authenticated coordinator receipt and exact-file coverage mechanisms reused.
**Experience:** ⚠️ Installed 1.0.0 still rejects the valid implement stamp until this fix is deployed. Walked developer through review → receipt → recording using the real source CLI integration; worst step = deployed recorder rejects the generated exclusion; new steps vs before = 0 in the fixed source flow. No killer demo declared for this bug task.
**Surface Evidence:** ⚠️ Source CLI and generated bundle status proof recorded; installed native activation remains unproven and unchanged.
**Evidence limits:** ⚠️ Wrong Bun selected in initial child process and one full-load fake-reviewer deadline failure; all affected files passed with explicitly pinned tools in isolation. Installed 1.0.0 approval-recording limitation remains; no stamp was fabricated or guard bypassed.

Audit passed for the PR-scoped source, dependency boundaries, references and documentation, with the coverage limits in audit.md. Its concrete finding was four obsolete exact-key acceptance expectations; those were fixed without weakening strict equality.

## Surface evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Source review status → receipt → implement gate | Real CLI integration and coordinator/reader/gate regressions | Passed in frozen production suite and targeted 259/259 contract checks |
| Public machine envelope | Full Cucumber acceptance plus schema tests | 596 scenarios / 11,118 steps passed twice |
| Generated plugin runtime | Real approved job queried with regenerated bundled CLI | Approved with verified exclusion field; installed 1.0.0 lacked field |
| Codex/Claude installed approval recorder | Normal installed implement stamp attempt | Failed honestly; requires deployment, not bypassed |

## Commands and durable evidence

The installed verify invocation recorder printed `verify ✓`. The skill's exact
shell block ran from this worktree; its aggregate exited 1, so this report does
not claim an all-green verify verdict. Logs: `/tmp/approval-exclusions-process-verify-final.log`,
`/tmp/approval-exclusions-toolchain-recheck.log`, and the prior evidence named in
ticket.md. Local logs are ephemeral; fresh current-head CI is the durable proof.

Fast smoke passed 101 files / 2,139 tests in
`/tmp/approval-exclusions-process-smoke.log`. Final lint, all five generated
surfaces, 268 parity pairs / 11 contracts, and version-sync passed. Independent
review 70bc740d-3c79-4694-b970-94188d8ac043 approved this scoped follow-up with no
errors.

## Review warning responses

Acceptance exact-key assertions prove public field presence, not authorization;
separate real coordinator/reader/gate tests prove classification, freshness and
coverage. Publishing the field on an exhausted result grants no approval:
receiptGateVerdict rejects every non-approved status before accepting coverage.
The existing outline title is historical wording and was left outside this
minimal expected-data repair. No full-suite pass after this fixture change is
invented; its complete acceptance lane and the actual failed/resolved runs are
reported above.

The invocation recorder writes that the skill was invoked, not the shell
aggregate's result; its successful invocation is not a verification pass. The
aggregate failure is recorded explicitly above. The timing-sensitive fake route
test is recorded for follow-up: its 500ms startup deadline can turn an expected
process_failed into timed_out under full load. Keep the assertion intact and
investigate that fixture separately if fresh CI reproduces it. Deployment and
fresh CI remain required; the review does not grant Ready promotion.

**Next:** Push the reviewed scoped follow-up and inspect fresh CI. Keep the PR Draft and ticket in implement; deployment and the normal installed approval stamp remain outstanding.
