## Verify Checklist

**Test Suite:** ✅ PR-review focus is green: 145/145 dispatcher, migration, classifier, retry-budget, and relay tests passed together; the added recovery-advisory regression passed 1/1 on the exact final source. The earlier rebased full run reached 6,795 passing tests and 5 intentionally skipped tests before its two remediated failures; fresh full-matrix CI will run after push.
**Re-verified on `b2ec69855`:** ✅ The review pass after this checklist was written added one commit (a plugin-mode factory fix plus its regression test). On that head: claude-plugin suite 114/114, the automatic-migration lane 29/29 scenarios, `bun run lint` (eslint + Gherkin lint + `tsc --noEmit`) clean, and the regenerated plugin bundle reproduces with no drift. The evidence below was recorded one commit earlier and otherwise stands.

**Gherkin:** ✅ The exact final automatic-migration lane passes 29/29 scenarios and 1,166/1,166 steps. The earlier rebased full run reached 1,092 passing scenarios and 3 intentional skips before 12 shared-lock contention failures; its affected lanes passed in isolation.
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 75 RED/GREEN/REFACTOR checks across 25 ticket scenarios are marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked the Non-Technical Builder through native plugin proof → automatic cleanup → preserved unknown content → one advisory; worst step = reading the one repair sentence when authored content prevents complete contraction; new steps vs before = 0. The fixture-proven rave moment lands locally, while the real RC host walk remains recorded below as an evidence limit.
**Surface Evidence:** ⚠️ 1 unproven/limited; 1/2 affected surfaces have recorded proof
**Evidence limits:** ⚠️ Authenticated disposable-profile Claude RC lifecycle, mid-session reload observation, host-kill observation, and five-run cold benchmark require a release candidate and were intentionally not run because this session stops before release. On current main, the earlier all-in-one verification lane overloaded Retro Relay's shared run/port locks; the affected features pass cleanly in isolation. The exact final tree was submitted to both independent coordinators: each exhausted its routes (`assigned_reviewer: claude`, preferred process failed, fallback output invalid, independence `none`). This is recorded as unavailable independent review, not approval; objective verification and the local adversarial review are green.

Repository audit passed with no errors. Final baselines: dependency-cruiser 0 errors/1 known string-addressed hook warning; 939 clones at repository scope; no stale Knip configuration hint; JS dependencies current; Go dependencies current. Existing repository advisories remain for generated/string-addressed plugin files, two unused methods and missing import-cycle tooling in the experimental Python corpus, and unavailable local `python`/`pip` executables. Learning metadata, principle traces, and namespace domain references are clean.

## Surface Evidence

| Affected surface | Proof command or manual check | Result |
| --- | --- | --- |
| Safeword CLI | Current PR-review focus, exact automatic-migration Cucumber lane, build, lint/typecheck, release-contract generator, and prior repository audit | ✅ Current focus passes 146 tests in the combined-plus-new-regression evidence, 29/29 scenarios and 1,166/1,166 steps; lint/typecheck and the Claude plugin release contract are healthy. Fresh full-matrix CI will run after push. |
| Claude Code | Generated dispatcher integration tests cover exact proof, historical cleanup, damaged cache/proof writes, scope overlap, legacy-marker retirement, sibling-output conflicts, and single-response prompt framing | ⚠️ Local protocol coverage passes; authenticated disposable-profile RC lifecycle and cold benchmark remain to run immediately before release. |

## Agent's next actions

- Create a disposable release-candidate profile and run the documented Claude host lifecycle acceptance sequence, including project and user scope enrollment.
- Run five cold first-prompt contractions against released 0.68/0.69/0.72 fixtures and confirm the 1,500 ms RC threshold under Claude's 2,000 ms hook budget.
- Exercise mid-session plugin reload and forced host termination during migration, then record the resulting recovery evidence before release.
