## Verify Checklist

**Test Suite:** ✓ 38/38 surrounding Vitest tests pass after the test-quality follow-up, with no filtered or skipped tests in that run. All 10 targeted preservation checks rejected both controlled broken behaviors by assertion failures. Earlier broader proof remains recorded: 171 focused tests and native completion passed on November 13 morning; full CI passed on af56551c2, including 726 CLI files and 11,661 tests. Historical local timeout and lock-blocked runs remain non-green historical evidence, not relabeled successes.
**Gherkin:** ✅ Scoped formatter acceptance passes 10/10 scenarios and 476 executed steps after restoring production code. The old mutating behavior caused the five affected scenarios to fail; skipping the checker caused all eight TypeScript scenarios to fail. Earlier full package acceptance passed 599 scenarios and 11,786 steps, and all 52 proof-tag checks passed. Root planning acceptance defects were separately reproduced on main, as described below.
**Build:** ✅ Success — the prescribed full verification build lane completed, including CLI, relay, and collector builds.
**Lint:** ✅ Clean — full root lint and Gherkin validation passed after the latest main merge.
**Typecheck:** ✅ Clean — all three packages passed after the latest main merge.
**Scenarios:** All 10 scoped formatter scenarios marked complete by execution; task hook-entry tests cover pending imports, unchanged bytes, diagnostics, markers, and explicit fix-mode compatibility.
**Refactor:** ✅ No change warranted — one optional check-only mode fixes both failure classes without new state or scheduling.
**PR Scope:** ✅ Diff matches ticket scope — post-edit JS/TS preservation, supporting tests, generated mirrors, and evidence only; main's planning changes are merged ancestry rather than this fix's scope.
**Dep Drift:** ✅ Clean — no dependency manifest or lockfile changes relative to main.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — existing shared lint helper and host-toolchain resolution retained.
**Experience:** ⚠️ Accepted formatting tradeoff — walked a developer through adding a pending import and using it in a second edit; worst step is the temporary unused-import warning; edit steps added = 0; formatting is deferred to an explicit command or commit tooling.
**Surface Evidence:** ✅ 3/3 affected surfaces have recorded boundary proof, limited as noted below.
**Evidence limits:** ⚠️ Historical full-local timeout and lock misses remain recorded; the November 13 native completion run passed without a blocking verdict. Root planning acceptance had baseline defects as detailed below. Native interactive host sessions were not rerun; surface proof is bounded to installed hooks and packaged dispatch commands. Earlier unfiltered audit advisories remain historical findings; this fix changes no dependencies relative to merged main.

## November 13 test-quality follow-up

The user explicitly authorized strengthening the weak tests after the earlier closeout. Four installed-hook preservation tests now require successful execution, exact unchanged bytes, and the real ESLint no-var diagnostic, using the existing infrastructure-failure assertion helper. Byte equality is checked before the diagnostic: the mutating control independently fails the byte check, while the no-checker control preserves bytes and fails the diagnostic check. Claude and Cursor hook-entry tests additionally require an external checker witness naming the target file. Cursor markers are cleaned even when an assertion fails. The Biome BDD fixture supplies a project-local executable double instead of accepting a missing-tool warning; every TypeScript scenario requires structured hook context containing its configured checker's distinct diagnostic. Biome and ESLint use different tokens, so ESLint cannot satisfy a Biome scenario. The double writes to the file passed in its arguments when mutation is requested.

| Controlled behavior | Targeted Vitest checks | Formatter BDD scenarios |
| --- | --- | --- |
| Fixed production baseline | 10 passed; 28 unrelated tests filtered | 10 passed |
| Original mutating entrypoints restored temporarily | All 10 failed by assertions | 5 affected scenarios failed; 5 unaffected scenarios passed |
| Checker skipped and replaced with a missing-tool warning | All 10 failed by assertions | 8 TypeScript scenarios failed; JSON and session cases passed |
| Only Biome bypassed; real ESLint still checks the source | Not rerun; this control targets BDD ownership | Both Biome TypeScript scenarios failed; 8 other scenarios passed |
| Production restored; surrounding suites rerun | 38/38 passed, no filtering or skips | 10/10 passed; 476 steps |

The first two counterexamples changed only the two production hook entrypoint calls; the Biome-only control temporarily bypassed that owner in the shared lint helper. Tracked mirrors were synchronized. A finally block restored every original hook byte; the complete tracked working-tree diff and status were also checked against the pre-experiment baseline. All five generated surfaces were current afterward. Raw reports show assertions about rewritten bytes, missing checker witnesses, missing no-var diagnostics, or the wrong checker token, not timeouts or failed fixture setup. An initial orchestration attempt stopped on a Cucumber summary-order assumption and restored production. After fixing the parser and addressing review findings, the final harness reran all three controls and directly generated its summary from those raw reports. The disposable harness and raw reports are ignored scratch artifacts, not shipped product code.

This is present-day regression validation. The original implementation still lacks recorded pre-implementation RED evidence; no historical TDD claim is added. Production behavior is unchanged by this follow-up. Biome and Ultracite compatibility proof remains bounded to external process doubles and existing command-contract tests; full interactive host sessions were not rerun.

## November 13 morning completion (before reopening for test quality)

Merged origin/main through fd784a2fd as 4ea11f5e5. Conflicts were confined to six generated files; all five surfaces were regenerated and verified. The fix sources did not change. Installed pinned Bun 1.4.4 dependencies with the prescribed freshness acknowledgment. All 171 focused tests across seven suites, all package typechecks, parity, and the four scoped audit blocks passed (541 modules / 923 dependencies, no violations).

Repeated the installed-hook walkthrough with real ESLint: the pending import and unrelated formatting survived both edits, the unused-import finding appeared before use, and cleared after use. The real source CLI Codex Stop command then returned an empty successful decision and changed status to done at 2026-11-13T14:43:35.433Z. This supersedes the earlier pending-proof and verify/in_progress state described in the historical follow-up below. No configured test lane was bypassed or replaced with an isolated retry.

## Surface proof

| Surface | Proof | Result |
| --- | --- | --- |
| Claude | Installed post-tool-lint hook with real ESLint in a temporary project, adding an import and later using it | Import and unrelated formatting preserved; diagnostic delivered before use and cleared after use; temporary project removed |
| Codex | Packaged command tests in commands/codex-hook.test.ts, included in the November 13 morning 171-test run | File edits and apply_patch use observational linting and preserve contents |
| Cursor | Real after-file-edit hook subprocess in post-edit-preservation.test.ts, included in current run | Imports and bytes preserved for ESLint/Biome/Ultracite; marker retained; diagnostics remain silently handled as before |

## Baseline acceptance findings

Structured root acceptance found one planning-review fixture failure: synthetic review b3f1c2d4-0000-4000-8000-000000000420 cannot be verified. The exact scenario failed identically on an untouched, separately built main checkout at e00ea1e65. A baseline dry run reproduced all 1,786 undefined steps across six unchanged planning features. The current merged branch still reproduces the same fixture error. These results are outside this bug fix and are not counted as green.

## Earlier review and delivery

Completion follow-up: two acceptance failures were traced to inherited hook routing rather than flaky assertions. Injecting CLAUDE_PROJECT_DIR reproduces the profile-priority failure; injecting SAFEWORD_PLUGIN_CLI reproduces the lockfile-receipt failure. The test runner now removes hook project/plugin routes from test subprocesses, extending its existing runtime-identity isolation. A real runTests fixture failed before the change and passed afterward. Both unchanged acceptance scenarios passed through the corrected boundary with injected host variables: 2/2 scenarios, 42/42 steps. Focused Vitest passed 19/19 tests across the new environment regression and existing test-runner suite. Typecheck, formatting, parity, and all five regenerated surfaces passed. Lifecycle fixture result hashes stayed unchanged; only installed-template tree hashes and their manifest moved. The native completion retry passed all 599 acceptance scenarios and 11,786 steps in 6m19s. Its aggregate result still blocked because the proof lane could not acquire the shared test lock (exit 75); no proof test started in that attempt. The ticket is returned to verify/in_progress, not marked done, pending an uncontended completion run.

Independent Claude/Opus approved the follow-up in review 41baa72d-ba05-43ec-b078-81fefd551ad0. The accepted compatibility tradeoff applies to all hosts: suites receive ordinary application environment variables, but not the calling hook's project/plugin routes; a test command can explicitly set its own routes. Existing runtime-identity coverage is retained. The standalone RED fixture and committed regression use the same environment-leak predicate, but are separate executions; no Vitest RED result is claimed while the lock prevents that runner from starting. The scoped audit reran without findings: 538 modules and 915 dependencies, plus config/learning/principle/domain-reference checks.

Independent Claude review 2bad5149-6174-4302-aad0-8fcf7e29bf62 approved the source packet before the latest main merge. The final coordinator receipt and phase-verification stamp are the authoritative final-review record; the PR readiness evidence names that receipt. Optional specificity, silent Cursor feedback, and other-language mutation limits remain disclosed.

All five generated surfaces were regenerated and verified after the latest main merge. Parity passed for 276 pairs and 11 contracts. PR #7158 remains Draft. No Ready promotion, merge, release, or issue closure is claimed.

## Scoped audit

Audit passed with warnings. The four prescribed diff-audit blocks completed; dependency-cruiser found no violations across 527 modules and 906 dependencies, and config-drift, learning, principle-reference, and changed-domain-reference checks reported no findings. No agent configuration or dependency declarations changed. Whole-workspace Knip, clone discovery, and dependency freshness were intentionally skipped by diff-audit policy.

Before the test-quality follow-up, manual review covered seven changed Vitest/Cucumber test files and the directly affected README and website documentation. That audit found stale automatic-fix promises; those passages were corrected, and the website built all nine pages successfully. The earlier documentation pass clarified three test titles without changing assertions; the later test-quality follow-up above strengthens the assertions themselves. The original supplemental selection was lock-blocked, then passed 3/3 with 29 tests filtered out. The existing Codex 1.2.0 profile was protected; the failed registry CLI retry did not change project hooks.

The four identified preservation-only integration tests now prove hook/checker execution through real lint findings, and the hook-entry tests independently prove checker execution for both Claude and Cursor. Remaining limits: full native interactive host sessions were not rerun, external tool doubles do not prove every Biome/Ultracite version, and original pre-implementation RED evidence is absent. These limits are not represented as completed coverage or repaired history.
