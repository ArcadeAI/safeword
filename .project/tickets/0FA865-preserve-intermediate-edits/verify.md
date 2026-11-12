## Verify Checklist

**Test Suite:** ⚠️ Full local run: 718/719 files passed; 11,637 tests passed, one JavaScript dependency-install/ESLint test timed out, and 12 skipped. The isolated retry passed 1/1 with 10 filtered tests skipped, and the previously lock-blocked proof check passed 52/52. Focused verification: ✓ 95/95 tests pass. Both full Node CI jobs passed on 4c548cc99. No clean single full-local-run claim is made: the prescribed verification command exited 75 after shared test-lock contention, and the later successful retries do not erase that historical status.
**Gherkin:** ✅ Acceptance lane passes — 599/599 package scenarios and 11,786 steps; scoped formatter acceptance passed 10/10. The final proof-tag check initially could not acquire the shared lock, then passed all 52 checks on retry. Root planning acceptance defects were separately reproduced on main, as described below.
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
**Evidence limits:** ⚠️ Local full-run timeout resolved on the one isolated retry; the original run remains recorded as non-green. Shared-lock misses were recovered by a queued proof retry. Root planning acceptance has baseline defects. Native interactive sessions were not rerun, so surface proof is bounded to installed hooks and packaged dispatch commands. Unfiltered local audits report existing advisories; the repository's CI dependency-audit check passed on the same source head, and this fix changes no dependency declarations.

## Surface proof

| Surface | Proof | Result |
| --- | --- | --- |
| Claude | Installed post-tool-lint hook with real ESLint in a temporary project, adding an import and later using it | Import and unrelated formatting preserved; diagnostic delivered before use and cleared after use; temporary project removed |
| Codex | Packaged command tests in commands/codex-hook.test.ts, included in current 95-test run | File edits and apply_patch use observational linting and preserve contents |
| Cursor | Real after-file-edit hook subprocess in post-edit-preservation.test.ts, included in current run | Imports and bytes preserved for ESLint/Biome/Ultracite; marker retained; diagnostics remain silently handled as before |

## Baseline acceptance findings

Structured root acceptance found one planning-review fixture failure: synthetic review b3f1c2d4-0000-4000-8000-000000000420 cannot be verified. The exact scenario failed identically on an untouched, separately built main checkout at e00ea1e65. A baseline dry run reproduced all 1,786 undefined steps across six unchanged planning features. The current merged branch still reproduces the same fixture error. These results are outside this bug fix and are not counted as green.

## Review and delivery

Completion follow-up: two acceptance failures were traced to inherited hook routing rather than flaky assertions. Injecting CLAUDE_PROJECT_DIR reproduces the profile-priority failure; injecting SAFEWORD_PLUGIN_CLI reproduces the lockfile-receipt failure. The test runner now removes hook project/plugin routes from test subprocesses, extending its existing runtime-identity isolation. A real runTests fixture failed before the change and passed afterward. Both unchanged acceptance scenarios passed through the corrected boundary with injected host variables: 2/2 scenarios, 42/42 steps. Focused Vitest passed 19/19 tests across the new environment regression and existing test-runner suite. Typecheck, formatting, parity, and all five regenerated surfaces passed. Lifecycle fixture result hashes stayed unchanged; only installed-template tree hashes and their manifest moved. The native completion retry passed all 599 acceptance scenarios and 11,786 steps in 6m19s. Its aggregate result still blocked because the proof lane could not acquire the shared test lock (exit 75); no proof test started in that attempt. The ticket is returned to verify/in_progress, not marked done, pending an uncontended completion run.

Independent Claude/Opus approved the follow-up in review 41baa72d-ba05-43ec-b078-81fefd551ad0. The accepted compatibility tradeoff applies to all hosts: suites receive ordinary application environment variables, but not the calling hook's project/plugin routes; a test command can explicitly set its own routes. Existing runtime-identity coverage is retained. The standalone RED fixture and committed regression use the same environment-leak predicate, but are separate executions; no Vitest RED result is claimed while the lock prevents that runner from starting. The scoped audit reran without findings: 538 modules and 915 dependencies, plus config/learning/principle/domain-reference checks.

Independent Claude review 2bad5149-6174-4302-aad0-8fcf7e29bf62 approved the source packet before the latest main merge. The final coordinator receipt and phase-verification stamp are the authoritative final-review record; the PR readiness evidence names that receipt. Optional specificity, silent Cursor feedback, and other-language mutation limits remain disclosed.

All five generated surfaces were regenerated and verified after the latest main merge. Parity passed for 276 pairs and 11 contracts. PR #7158 remains Draft. No Ready promotion, merge, release, or issue closure is claimed.

## Scoped audit

Audit passed with warnings. The four prescribed diff-audit blocks completed; dependency-cruiser found no violations across 527 modules and 906 dependencies, and config-drift, learning, principle-reference, and changed-domain-reference checks reported no findings. No agent configuration or dependency declarations changed. Whole-workspace Knip, clone discovery, and dependency freshness were intentionally skipped by diff-audit policy.

Manual review covered seven changed Vitest/Cucumber test files and the directly affected README and website documentation. The audit found stale automatic-fix promises; those passages were corrected, and the website built all nine pages successfully. Three existing test titles were clarified to describe their preservation assertions; no callbacks or assertions changed. Their first supplemental selection could not acquire the shared lock; the later selection passed 3/3, with 29 other tests filtered out. The project CLI reports the existing Codex 1.2.0 profile protected with current native hook proof; the failed registry CLI retry did not change project hooks.

Non-blocking coverage limits: some older preservation-only tests do not independently prove startup, while the dedicated hook-entry tests assert startup and diagnostics; full native interactive host sessions were not rerun. These are not represented as complete interactive-host coverage.
