# Verification: Keep native Safeword plugins current

## Verify Checklist

**Test Suite:** ✓ 6370/6370 tests pass (5 skipped)
**Gherkin:** ✅ Acceptance lane passes
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 69 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked NTB through first Codex task enrollment; worst step = restarting Codex before native protection can be proven; new steps vs before = 0 manual setup steps. Walked TBU through explicit Claude scope and version-pin controls; worst step = reloading plugins after an in-session update; new steps vs before = 0 for existing installs.
**Surface Evidence:** ⚠️ 2 limited — Safeword CLI passed the full real CLI suite; Claude Code and Codex passed subprocess/package-boundary integration but their real host startup refresh and cache lifecycle remain manual release acceptance.
**Evidence limits:** ⚠️ Real Claude/Codex host refresh, cache replacement, and public stable promotion were not run because this task explicitly stops before release. The independent quality-review coordinator also exhausted its routes twice: headless Claude timed out and the fallback returned invalid output.

Audit passed — configuration, architecture (279 modules / 403 dependencies), learning references, principle traces, and domain documentation checks reported no errors or warnings.

## Surface evidence

| Affected surface | Proof command or manual check | Result |
| --- | --- | --- |
| Safeword CLI | Exact `$safeword:verify` test plan: full Vitest, Cucumber, typecheck, build, and `bun audit` | Pass |
| Claude Code | `profile-install.test.ts`, scoped lifecycle Cucumber features, generated plugin runtime and release-contract tests | Pass at subprocess/package boundary; real host refresh deferred |
| OpenAI Codex | Bootstrap, migration, project-bootstrap, profile-lock, proof, package-entrypoint, setup, and upgrade integration tests | Pass at subprocess/package boundary; real host refresh deferred |

## Quality-review status

Primary-source review verified Claude's project-scoped environment support, marketplace auto-update behavior, and documented last-known-good marketplace switch. It also verified Codex Git marketplace refresh behavior from the official OpenAI source. The discovered Claude failure-cache gap was fixed and covered by tests.

Formal independent review remains blocked by the host-owned coordinator (`preferred_failure: timed_out`, `fallback_failure: invalid_output`, `independence: none`) after the required exact retry. No substitute approval was created.
