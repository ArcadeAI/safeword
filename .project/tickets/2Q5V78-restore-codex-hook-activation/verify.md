# Verify: 2Q5V78 restore-codex-hook-activation

## Verify Checklist

**Test Suite:** ✓ 9032/9032 tests pass (14 intentional skips); release configuration adds 43/43 passing contract tests
**Gherkin:** ✅ Acceptance lane passes — 1493 scenarios (1490 passed, 3 skipped), 68465 steps (68461 passed, 4 skipped)
**Build:** ✅ Success — CLI, relay, collector, and website production builds pass
**Lint:** ✅ Clean — ESLint, Gherkin lint, TypeScript, and Astro diagnostics pass
**Scenarios:** All 4 scenarios marked complete
**Refactor:** ✅ Completed — migration messaging now consumes the result contract directly; no broader structural change was warranted
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean — no runtime dependency changes
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — walked a Codex user through install, restart, partial proof, and missing-dispatch flows; worst step = the required host restart; new steps vs before = 0, and completed restarts no longer loop back to the same instruction
**Surface Evidence:** ✅ 3/3 affected surfaces have recorded proof
**Evidence limits:** ✅ None

Audit passed with warnings — no change-local release blockers; repository-wide baseline warnings were limited to pre-existing orphan/dead-code, duplication, experiment-tooling, and outdated-development-dependency findings.

Independent quality review approved the final behavior with no errors. Review `6f6e031e` confirmed that the identity-bound restart receipt, partial-proof guidance, observed-empty host handling, and conservative unavailable-observation behavior are coherent.

## Surface evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Codex migration/status classification | Full Vitest suite, including migration, profile-proof, command, and headless activation tests | Pass |
| Real packaged hook subprocess boundary | `codex-hook.test.ts` with disposable `CODEX_HOME` and real-profile immutability regression | Pass |
| User-facing install/restart flow | Full Cucumber acceptance corpus, including install-while-closed, partial activation, missing dispatch, and successful handoff | Pass |

## BDD gap assessment

The regression exposed two missing state transitions in the prior BDD model:

1. `SessionStart` can retire the pending marker and create an identity-bound restart receipt before `PostToolUse` and `Stop` have had an opportunity to run. The old scenarios jumped from restart-pending directly to complete proof, so they could not catch a false total-activation-failure message during the first healthy turn.
2. A successful install-time process scan can observe zero Codex hosts when Codex is closed. The old fixtures covered an unavailable scan and a running host, but not an observed-empty set followed by the next app start.

Both transitions now have executable regression coverage. The original completed-restart/no-dispatch branch is also pinned in the human and schema-2 status matrices, so a future change cannot silently reintroduce the false restart loop.
