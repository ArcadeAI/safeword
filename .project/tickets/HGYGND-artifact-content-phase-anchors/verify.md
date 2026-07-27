# Verify: Artifact-content phase anchors (HGYGND)

2026-07-08. Evidence from `safeword test-plan` lanes (verify/bdd/build/typecheck/deps),
/lint, and /audit, run at the verify phase on branch
claude/safeword-phase-provenance-gmimm7.

## Verify Checklist

**Test Suite:** ✓ 5006/5006 tests pass (348 files; 7 pre-existing skips)
**Gherkin:** ✅ Acceptance lane passes (353/356 scenarios; 3 pre-existing @wip skips — includes the 26 artifact-content-phase-anchors scenarios and the re-expressed boundary-gate scenarios)
**Build:** ✅ Success (tsup + DTS)
**Lint:** ✅ Clean (eslint + gherkin lint + tsc --noEmit)
**Scenarios:** All 26 scenarios marked complete (R/G/R with per-tick SHAs + cross-scenario refactor row)
**PR Scope:** ✅ Diff matches ticket scope — substrate swap (phase-provenance.ts + parity mirror), boundary engine/command migration, check advisory, test/acceptance-lane migration incl. the declared CDRJTW cross-ticket scenario re-expression, docs (ticket-system SKILL ×3 mirrors, glossary), and this ticket's own artifacts
**Dep Drift:** ✅ Clean (no dependencies added or removed)
**Parent Epic:** N/A (external epic #808; no local parent ticket)
**Reconcile:** ⚠️ 2 deviations, 0 missing uplevel ticket — both recorded in impl-plan.md Known deviations with rationale (verify.md shape probe instead of importing impure done-gate.ts into the pre-tool hot path; reconcileChange 3-arg keeping ledger/anchor oracles separate); neither introduces a divergent sibling pattern needing an uplevel
**Experience:** ✅ No new friction — Walked Safeword Maintainer through a phase advance: writes the artifact path they already know instead of running `git rev-parse HEAD`; worst step = recalling the canonical artifact per phase, mitigated by remediation text naming the exact line to write; new steps vs before = 0. Observed live: this ticket's own advances went from three boundary warnings (invalid-SHA + legality + ledger nags) to zero by the verify-phase commit.
**Evidence limits:** ✅ None (git temp-repo probe passed; full suite ran locally)

Audit passed with warnings — 0 errors. Details: config in sync; depcruise 0 violations
(602 modules, 1870 deps); knip: pre-existing `shellcheck` unlisted-binary advisory only
(tool invoked by lint-staged, deliberately not a package dep); Clones: 423 (8.27%
overall / 3.82% TS) [repo minus .safeword,.project] — new baseline at the pinned scope,
includes the accepted cross-lane impl-plan fixture duplication (unit lane keeps a local
fixture; cli-test and steps lanes each share theirs); outdated: knip 6.24.0→6.25.0
(dev, minor, Low — safe to update, not this ticket); learnings Covers-lines clean;
no documentation drift (anchor convention documented in ticket-system skill + glossary,
both updated in this ticket).

## Issue #904 hardening verification — 2026-07-25 (pre-rebase baseline)

Evidence from the repository-generated test plan after the complete audit,
independent quality review, and refactor ledger, before rebasing this follow-up
onto the current `main`.

## Verify Checklist

**Test Suite:** ✓ 5492/5492 tests pass (366 files; 5 skipped)
**Gherkin:** ✅ Acceptance lane passes (495/498 scenarios; 3 skipped; 15345/15345 executed steps pass)
**Build:** ✅ Success (tsup + DTS)
**Lint:** ✅ Clean (ESLint + Gherkin lint + `tsc --noEmit`)
**Scenarios:** All 37 scenarios marked complete (112/112 R/G/R cells)
**PR Scope:** ✅ Diff matches issue #904 hardening scope: canonical artifact ownership, staged-tree configuration authority, repository-root handling, adversarial path grammar, regression evidence, and behavior-preserving test-fixture/enforcement-seam refactors
**Dep Drift:** ✅ Clean (no dependencies added or removed)
**Parent Epic:** N/A (external epic #808; no local parent ticket)
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — internal boundary-enforcement hardening, not persona-facing
**Evidence limits:** ✅ None

Audit passed with warnings — 0 errors. Config parity is clean; dependency-cruiser
reports 0 violations across 653 modules and 2124 dependencies; Knip and outdated
dependency checks are clean; Go modules are current; learning and namespace-domain
checks are clean; changed-test quality and configured documentation sources
(`README.md`, website docs) show no drift. Clones: 490 (10.55% overall / 3.65%
TypeScript) [repo minus `.safeword`, `.project`] versus the 2026-07-08 baseline
of 423; the broader repository grew substantially and its shipped template/install
mirrors are intentional, while this pass removed duplicated boundary and history
fixtures. Coverage warnings are limited to the pre-existing Python experiment,
which has no import-linter or dead-code executable installed.

## PR review remediation — 2026-07-26

Evidence after addressing all nine unresolved PR review threads:

- The two original public detectors require `PhaseAnchorScope`; the redundant
  scoped wrappers and their fail-open unscoped path are gone.
- All 37 ledger scenarios now have executable Gherkin coverage, including the
  ten ownership/configuration scenarios previously present only in lower lanes.
- Focused Vitest: 76/76 pass across the phase-anchor, boundary engine, real CLI,
  and repository-path suites.
- Full Cucumber: 505/508 scenarios pass, 3 skip; 15,645/15,645 executed steps
  pass. The issue-focused lane is 40/40 scenarios and 1,210/1,210 steps.
- Build succeeds; ESLint, Gherkin lint, `tsc --noEmit`, diff hygiene, and
  template/dogfood parity are clean.
- Full local Vitest: 5,492 pass, 5 skip, with one failure in the untouched
  upstream Astro preset expectation (`astro/no-omitted-end-tags` is `"error"`
  under the installed eslint-plugin-astro 3.0.1 while the test expects it to be
  absent). The Astro preset, test, manifests, and lockfile are unchanged from
  `origin/main`; Node 22 and Node 24 CI passed on remediation head `a36e0d027`.
- Audit: 0 change-scoped errors; config parity clean; dependency-cruiser 0
  violations across 662 modules / 2,166 dependencies; Knip clean; dependencies
  current; domain and learning checks clean. Clones improved from 490 to 455
  (8.37%) at the same `repo minus .safeword,.project` scope. Existing Python
  experiment import-linter/dead-code tool coverage remains a reported
  limitation.

## Final full-skill pass — 2026-07-26

- Full refactor scout completed with no truncated or deferred findings. Three
  isolated commits removed every remaining fixture copy of `WORKSPACE_ROOTS`;
  each passed its focused unit or acceptance lane before commit.
- Three independent quality-review passes used current official Git and Node
  documentation. The first reproduced a namespace-precedence regression; the
  staged-index/`HEAD` fix and real commit/push regressions landed in
  `af26407e6`. Follow-up passes approved with no critical issues or remaining
  suggestions after legacy-only fallback coverage and stronger ownership
  assertions landed.
- Full generated verification ran on the final production code: 5,496 Vitest
  tests passed, 5 skipped, and the sole failure remained the unchanged local
  Astro preset expectation above. The full Gherkin lane passed 505/508
  scenarios with 3 skips and 15,645/15,645 executed steps; build, ESLint,
  formatting, Gherkin lint, and `tsc --noEmit` passed. The final assertion-only
  refinement then passed its complete 51-test detector suite.
- Final audit found no change-scoped architecture, dead-code, dependency,
  domain-doc, learning, documentation, or test-quality errors: config sync and
  Knip were clean; dependency-cruiser reported 0 violations across 662 modules
  and 2,169 dependencies; JavaScript and Go dependencies were current; the Go
  checker passed. The final jscpd run reported 456 clones (8.37%) at the same
  `repo minus .safeword,.project` scope, effectively flat against the prior
  455-clone record. The existing Python experiment still lacks import-linter
  contracts and a dead-code executable.
