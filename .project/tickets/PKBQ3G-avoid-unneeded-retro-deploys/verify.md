# Verification: Avoid retro production deploys during CLI releases

## Verify Checklist

**Test Suite:** ✓ 10522/10522 tests pass across 612 files on the final full-suite retry; 14 additional tests skipped. The focused workflow suite passed 12/12. The first full-suite run had one failure in the unchanged OpenCode timeout test (probe timed out before the expected route); that exact test passed in isolation before the full retry passed.
**Gherkin:** ✅ The authoritative acceptance lane passed 596/596 scenarios and 11118/11118 steps; the proof test passed 47/47 after the other checkout released the shared Vitest lock.
**Build:** ✅ Success.
**Lint:** ✅ Clean.
**Typecheck:** ✅ Clean.
**Scenarios:** ⏭️ Skipped — this CI patch adds no feature scenarios.
**Refactor:** ✅ Completed within implementation commit 5f10fba45 — three repeated workflow selectors became one tested script; no separate structural pass was needed.
**PR Scope:** ✅ Diff matches ticket scope; the change covers only retro deployment selection and this ticket's evidence.
**Dep Drift:** ✅ Clean — no dependency changed.
**Parent Epic:** N/A.
**Reconcile:** ✅ No pattern deviation.
**Experience:** ⏭️ N/A — this patch changes CI deployment selection, not a user-facing flow.
**Surface Evidence:** ✅ PR #5636 run 37817704552 passed at code-and-test head 5b135dfd8, including Node 22 and 24 suites and all three retro deployment-input jobs. The actual merged 1.1.0 diff returned deploy=false for all three retro services. The added selector and workflow wiring assertions passed 12/12. A closure-only commit will receive a new CI run before PR promotion.
**Evidence limits:** ⚠️ The unpublished 1.1.0 runtime cannot witness review 41437087 for a phase stamp; the supported logged skip records that limitation. A manually dispatched or scheduled CI run has no push `before` SHA, so its retro deployment selector returns false; the separate protected manual deployment workflows remain the operator route. A broader root-level Gherkin command discovered 1625 scenarios and failed three in files byte-identical to origin/main: "Evidence over budget cannot look complete or ready," "Plugin hook commands never point at repo-local hook scripts," and "Release check proves the packed package contains the plugin and hook entrypoints." They were not rerun on the base commit. The authoritative local and CI lanes passed 596/596, with local proof 47/47.

Independent reviews 41437087, 8a64cbb2, and 71ddef9e found no blocking errors, including review of the final assertions and ticket record. The reviews warned that the selector's CLI entry point is not exercised directly by an automated test; the actual merged 1.1.0 diff was exercised through that entry point and produced three deploy=false results. PR #5636 stays Draft until supported ticket closure and CI for that closure commit complete.
