# Verification: Make each agent's plugin fully self-contained

## Verify Checklist

**Test Suite:** ✓ Full pre-merge verification: 9260/9260 tests pass (14 intentional skips; both root/package plans completed). Combined-tree focused lane: 535 passed / 2 skipped, with its one probe-timeout failure passing unchanged on recheck; release checks: 55/55.
**Gherkin:** ⚠️ Local environment limitation: intermittent full-suite reviewer startup timeout; full root retry and package baseline pass, final reviewer feature passes 37/37, both proof entry points pass 39/39
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 38 scenarios marked complete
**Refactor:** ✅ No change warranted — the cross-scenario review retained the shared state writer and existing profile registry as the narrow common seams
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A (all 6 child tickets are done)
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — the packaged first-use state walkthrough required no installer and preserved authored content
**Surface Evidence:** ✅ 5/5 affected surfaces have recorded proof; interactive host UI activation is not claimed
**Evidence limits:** ⚠️ Desktop hook protection remains unverified for this task. Local Python import-linter and pip-audit coverage is unavailable. Full local acceptance retries had intermittent reviewer-startup timeout failures; the affected feature passes in isolation, documented below. Pre-merge CI is historical evidence; the PR readiness record tracks CI for the final merge commit separately.

Audit passed with documented limitations. The final combined-tree dependency audit found no violations across 475 modules and 886 dependencies. Epic principle trace and configuration sync passed; the earlier learnings/domain checks remain applicable. Python dead-code findings for `ReviewSpecAdapter.evaluate` and `make_reflective_dataset` are callbacks used by GEPA, not unused production paths.

## Current-head evidence

Integration update: CI run `33704538993` passed on `e130f285aecd8bc5ffa36efbf4246836959202fe`, including both Node jobs, acceptance, physical install, and release gates. While it ran, main advanced to `258b1055e4be7a3ef71b60c16fd59aef6a210e49` (OpenCode fallback and ranked review routes, PR #3617). The combined tree has completed local verification; the pre-merge CI result is not represented as post-merge evidence. Both native bundles were regenerated, and compatibility recapture passed 12/12 with only three Cursor tree digests changing relative to `e130f285a`; existing result digests remained unchanged.

Combined-tree checks passed root/package TypeScript and the diff audit (475 modules / 886 dependencies, no dependency violations or config drift). The explicit epic principle trace passed; a repository-wide scan found seven baseline dead references in two unrelated unchanged plans, which were left untouched. The focused integration lane recorded 535 passes, two skips, and one capability-probe timeout before the writable-PATH assertion was reached; all compatibility cases passed with update mode disabled. The unchanged targeted recheck passed both writable-PATH cases, and all 55 release checks passed. The original failed aggregate remains recorded, not relabeled green.

Fresh review `32a289fb-4912-4be4-b8d2-db1dbd092020` identified a false-green credential fixture: its successful exit bypassed nonzero-exit diagnostics. The fixture now exits 7, and the leak assertion requires the typed `process_failed` classification. All 37 reviewer scenarios / 699 steps passed on the merged runtime, including the strict three-second deadline. A disposable negative control restored the old successful exit and failed specifically on `invalid_output` versus `process_failed`; it is not shipped. Final-file formatting, lint, and TypeScript passed. The merged packaged-runtime first-use walkthrough also passed: truthful confirmation, one precise ignore rule, unchanged authored note, no installer or project executable runtime.

Final independent review `bbc02ed5-6a0d-4ac2-965b-1811d08b572d` approved with no errors (Claude Opus, cross-agent). Remaining warnings have explicit work-log dispositions. Passing the surrounding reviewer feature is not a claim that every one of its fixtures is maximally discriminating: contract-writing and late-answer Cucumber preconditions, user-config/cache isolation, and minor fixture hygiene remain follow-ups. The lower-level contract-file test directly verifies classified, redacted failure. These limitations do not leave an accepted self-contained-agent-plugins scenario uncovered.

Pre-merge full-verification production source head: `09b9f942131080ed7e29fde48b4bec22c6b20633`. Subsequent reviewer-fixture corrections change no production source or explicit deadline contract; they fund classification cases and make the invalid-model proof discriminating. The main integration's additional runtime changes are covered by the combined-tree evidence above and final-head CI tracked in the PR.

- Both full local CLI passes: 8968 passed, 13 skipped, 551 files. Both relay passes: 186 passed / 1 skipped. Both collector passes: 106 passed. The checklist counts unique executed tests, not duplicate runs.
- All 38 epic scenarios have executable proof registrations and complete RED/GREEN/REFACTOR evidence. Independent scenario gate `a77603b7-0153-44f0-907e-4cef2a675801` approved with no errors.
- Independent code reviews `5c7fa297-48e9-4efc-bf7a-e04141e015a9` and final repair review `4ba1237f-6da0-4400-a9f2-eb2240682de7` approved (Claude Opus, cross-agent). Findings were applied or explicitly answered in the work log.
- Latest focused repair run: 97/97 tests passed across authority validation, actual Cursor installation, lifecycle preservation, isolated planning, compatibility fixtures, and BDD proof provenance.
- Full lint and typecheck passed. Pre-push schema checks passed 865/865. Builds passed for CLI, website, and retro services; TypeScript, Astro, and strict mypy checks passed.
- [CI run 33692911053](https://github.com/ArcadeAI/safeword/actions/runs/33692911053) passed on the verified source head. Both Node 22 and Node 24 jobs passed. Node 24 recorded 8972 CLI tests passed / 9 skipped, 1496 acceptance scenarios and 68600 steps passed, 1 physical-install proof passed, 39 provenance checks passed, and 55 release checks passed.
- Bun audits reported no vulnerabilities. Go reported zero affected vulnerabilities, with one vulnerability in imported packages and nine in required modules whose vulnerable symbols are not called. The missing Python scanner is a coverage limit, not a pass.

## Local acceptance retry

The verbatim full verifier completed with exit 1: its test, build, typecheck, and dependency lanes passed, but root acceptance had 1485 passing scenarios, 3 skipped, and 8 failing reviewer-process fixtures. The package acceptance command was therefore not reached. This is retained as failed-run evidence, not an all-green aggregate.

The eight failures concerned reviewer startup/probe deadlines and exhausted routes during concurrent local workload. All 15 focused cases covering them then passed unchanged in 14.984 seconds (681 steps). The same scenarios also passed in the full CI run. This supports local timing sensitivity; it does not establish a production regression.

The complete root acceptance rerun passed unchanged: 1493 scenarios passed / 3 skipped, 68596 steps passed / 4 skipped, and 39 proof registrations passed. Package acceptance then reproduced four short-deadline classification failures (588 passed / 4 failed). That second observation exposed an incomplete fixture repair: only two classification cases had received the normal probe allowance, while the fixture default remained two seconds. The fixture now shares a five-second attempt and thirty-second run budget, with a forty-second Cucumber step budget; the explicit three-second deadline assertion remains unchanged. All 592 package scenarios and 11046 steps then passed. No production deadlines, assertions, or skip conditions were weakened.

Independent fixture review `8a0b890c-496c-4b65-b57d-773dffa230b9` found a separate non-discriminating invalid-model input: `--help` was intercepted by the fake reviewer's capability probe before launch logging. Replaced it with `invalid model`, so an accidental alternate-model launch is logged and violates the existing assertion. Both model-grammar scenarios passed through the real CLI (38 steps). The fixture process timeout now expires at 35 seconds, inside its 40-second step timeout.

The next full package retry passed 591 scenarios, with one failure: the strict three-second case expired during capability probing instead of after reviewer launch. Its deadline and launch assertions were retained. Package proof provenance passed 39/39 separately. This failed aggregate is not reported as an all-green run.

Fixture review `e1e1d681-ff31-4f80-83ae-8eb124b1caf0` also exposed prefix checks that could miss supporting evidence duplicated into the review-target array. The final fixture captures real reviewer input through the existing permitted prompt-log channel, then checks exact target/context membership for primary and alternate routes. A disposable counterexample injection failed both assertions specifically on the duplicated evidence file. With the counterexample removed, the complete final reviewer feature passed 37 scenarios / 699 steps, including the unchanged strict three-second test. Formatting, lint, and package TypeScript checks passed on this final file. Review `f1175b4f-a99d-4f10-bf25-cf064ce8297e` was correctly marked stale after the capture-channel correction and is not approval evidence. Final review `485a1b8c-1dff-4364-a252-986c809bd363` approved the current file with no errors (Claude Opus, cross-agent); optional findings are answered in the work log.

## Surface evidence

| Affected surface | Proof boundary | Result |
| --- | --- | --- |
| Claude Code | Generated plugin workflow and bundled helper subprocess; native catalogue mutation tests | Passed; no project-runtime dependency |
| Codex | Versioned-cache workflow, real sourced Bash helper, isolated package helpers, release proof through a real Codex plugin install | Passed; package-owned execution and truthful state-write confirmation |
| OpenCode | Installed profile workflow, catalogue identity/digests, copied dispatcher, upgrade/uninstall and conformance contracts | Passed; the package resolver/reviewer subprocess is the controlled external boundary |
| Cursor | Actual installed catalogue and audit/state commands; sourced helper failure and empty-export cases; selected legacy/native removal | Passed; complete project authority preserved without borrowing another host |
| Safeword CLI | Real command and reconciliation tests; exact no-op and explicit project-removal plans; profile-manager boundaries isolated | Passed; selected removal preserves remaining hosts and authored content |

Manual walk: a technical builder invoked the current packaged Codex state helper in an enrolled scratch repository with the state file absent, then repeated it. The helper confirmed the write; Git confirmed one precise ignore rule; authored notes were unchanged and no installer ran. The worst step is obtaining a valid host run identity; no new user step was introduced. Packaged ticket resolution and principle audit also succeeded. Explicit `--agents=none` removed only that scratch project's enrollment, leaving its authored notes and host profiles alone.

These are real process/CLI proofs, not a claim that every host's interactive UI was restarted. The installed Desktop update is not relied on as verified protection.

## Remaining process follow-ups

- Issue #3531: bind a successful executable BDD receipt to implement exit instead of relying on ledger syntax until verify/done.
- Deduplicate root/package verification while retaining entry-point parity proof; the duplicated full suites materially lengthened this run.
- Provide a supported generated-architecture acknowledgement/reconcile command.
- Declare or vendor PyYAML for the system skill validator.
- Optional reviewer observations are retained with dispositions in the work log; they do not expand this epic's accepted behavior matrix.
