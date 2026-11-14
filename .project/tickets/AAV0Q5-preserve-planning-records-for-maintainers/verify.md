# Preservation delivery verification

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: full CLI passes retain 7 and 2 failed tests plus a failed setup suite; focused rerun passes 186/187, with the native OpenCode version probe still timing out. No clean aggregate local invocation is claimed.
**Gherkin:** ✅ Acceptance lane passes — 599 scenarios / 11786 steps plus 52 proof checks. The runner excludes @wip; archived EP9 scenarios receive no execution credit.
**Build:** ✅ Success — resolved workspace builds, including nine website pages.
**Lint:** ✅ Changed records pass pre-commit checks; current Gherkin lint passes. Final-head CI remains required.
**Typecheck:** ✅ All resolved TypeScript/Python checks and website diagnostics pass.
**Scenarios:** ⏭️ Preservation patch, no new application behavior. Historical feature remains @wip and all 52 ledger rows remain unchecked.
**Refactor:** ✅ No change warranted — records and labels only, no implementation to restructure.
**PR Scope:** ✅ Exactly 34 preservation files beyond current main 3eb5b6f0a. No old implementation, package, hook, template, generated bundle, route or converter dependency change in this PR's own diff.
**Dep Drift:** ✅ Raw Bun audit clears 1173 packages without suppressions. Python audits pass (uv: 39 packages); Go has zero reachable vulnerabilities with 1 imported/14 module notices retained. No scanner-policy change.
**Parent Epic:** #4200 remains incomplete. No original scenario, missing RED or 33-case deferral changed.
**Reconcile:** ✅ No new implementation pattern or architecture decision.
**Experience:** ⏭️ Records preservation, no new product flow or user-study claim.
**Surface Evidence:** ✅ JSON parsing, Gherkin lint, unchanged source comparison and explicit historical/current framing checked. No native-host or qualified recovery proof claimed.
**Evidence limits:** ⚠️ Local full verification exits 1 because of retained timeouts; one native OpenCode probe still fails in isolation. Full run predates main's separately landed #7215 approval fix; its affected integration suite passes afterward. Final-head CI is required separately. Historical implementation and qualification statements remain bound to their historical source.

## Preservation checks

All 26 original 5GK1CN packet/feature files exactly match source c03964335,
excluding the newly added PRESERVATION.md. The new delivery report and
intentionally updated epic handoff labels are not claimed byte-identical to
that old source. All 13 changed JSON files parse (12 inside 5GK1CN and one
parent receipt). All 52 ledger rows remain unchecked; feature first line
retains @wip. Known credential patterns were not found; absolute local evidence
paths are retained as historical locators, not authentication files.

The 33 deferred cases remain exactly MCWV4B 18, FC33HK 12, KKP2R3 2, DRD65E 1.
The archived design approval is historical, not approval of repaired current
scenarios. This delivery grants no eligibility, implementation or completion
credit to 5GK1CN.

Diff-scoped Audit passed against current origin/main: no changed production
source or manifests, no new architecture pattern, no configuration or domain
document drift. Global Knip/clone/freshness discovery is deliberately outside
this archive diff. The supported explicit --ticket AAV0Q5 selector resolves
the delivery; automatic selection previously encountered three changed ticket
files. There is no implementation plan, so principle trace is not applicable.

Independent cross-agent Claude review 80de6945-77aa-4c8f-948e-ccaaa2ccc633
approved the complete original 33-file preservation packet, no exclusions.
Earlier reviews 9bf71921, b705e3de and partial-packet 899409db remain retained;
the partial review correctly could not earn full implement coverage. Actual
intake and implement stamps were earned. Final closing verification review
must include this report and current ticket. Model aliases are not exact-model
qualification evidence.

## Current main and observed verification

The previous local verification (/tmp/AAV0Q5-verify.log) passed both CLI
passes (724 files, 11648 passes, 14 skips each), 599 scenarios, 52 proof checks,
builds/types, but exited 1 for inherited Astro advisories
GHSA-mh32-jxcr-mh9f and GHSA-r3h5-4585-7x3w. That failed aggregate remains.

The separate Astro-only candidate was rejected by review 025564ef because
old root Vite/Zod overrides were below Astro's declared minima. The corrected
bounded fix (Astro 7.4.7, Vite 8.3.5, Zod 4.6.7 and lockfile) was reviewed,
verified and merged as PR #7397, main commit 3eb5b6f0a. Its final-head CI
43565275268 passed without reruns. Converter dependencies remain unchanged;
the unrelated 33-package bulk update #7235 was not adopted.

The preservation worktree first incorporated those same fix commits and ran
the complete packaged block at 6174a963f761a58de32df457b23742044aca612f
(/tmp/AAV0Q5-fixed-verify.log), aggregate exit 1:

- First CLI pass: 720 files passed / 4 failed; 11622 tests passed / 7 failed /
  33 skipped. One setup suite failed before its tests could run.
- Duplicate CLI pass: 722 files passed / 2 failed; 11646 tests passed / 2 failed /
  14 skipped.
- Relay 198 passes / 1 skip; collector 153 passes. Repeated counts overlap.
- All 599 scenarios / 11786 steps and 52 proof checks passed.
- Workspace/site builds, types and raw Bun/Python/Go reachable-code audits pass.

Failures were fixture setup/reset timeouts, package probes, and fake reviewer
compatibility probe timeouts. After that full run completed, the worktree
merged actual main, including separately landed #7215 (50e948760). That fix
rechecks presented plan bytes and review currency after a human prompt.
It is inherited base work, not part of this preservation diff. Post-merge
affected integration suite tests/integration/plan-design-approval.test.ts
passes 47/47 (/tmp/AAV0Q5-main-impact.log).

Post-merge focused rerun covered all five affected files together:
reset, setup-hooks, close-edit-done-gate, review-wiring and OpenCode
host-contract. Four files and 186 tests pass. The single native host test
still times out at bunx --bun opencode-ai@1.18.23 --version
(/tmp/AAV0Q5-fixed-isolated.log), so the batch exits 1. All review-wiring
assertions pass unchanged in that rerun. Precise cause of the native probe
failure is unconfirmed; it is neither erased nor declared fixed. No timeout,
assertion, review route, qualification setting or OpenCode deferral changed.

Final-head CI and independent closing review remain separate Ready gates.
Administrative merge of #7397 and #7368 was explicitly authorized once green;
that authority does not authorize qualification, converter updates, scope
expansion, releases, or cleanup.

Raw logs retain their named basenames under
/Users/alex/Projects/safeword-trials/2026-11-08-main-da2778353-csv/epic-followthrough-2026-11-13/planning-preservation/.
Review packet copies under ignored .project/tmp/ are supporting evidence,
not tracked credentials or replacements for the permanent archive.
