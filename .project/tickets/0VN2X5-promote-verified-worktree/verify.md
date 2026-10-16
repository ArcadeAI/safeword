# Verification — promote from the selected worktree

## Verify Checklist

**Test Suite:** ⚠️ Observed full-run timeouts: fresh full CLI run passed 11,109 cases with 4 timeouts and 14 intentional skips. All four timeouts and the two earlier deadline failures passed in isolation (6/6); their cause is not established by that rerun. Final one-worker smoke, readiness, and CLI-contract run: ✓ 2372/2372 tests pass across 114 files.
**Gherkin:** ✅ Resolved package acceptance lane passes — 596/596 scenarios, 11,118/11,118 steps, and 50 proof-tag tests. The duplicate package lane's three build-race failures passed unchanged in exact-name reruns (3 scenarios, 54 steps). Historical root-wide acceptance is a separate lane, described below.
**Build:** ✅ Success — CLI, relay, collector, website, and Go checker.
**Lint:** ✅ Clean — root ESLint/Gherkin lint and final changed-source ESLint.
**Typecheck:** ✅ Clean — all three TypeScript workspaces.
**Scenarios:** All 8 scenarios marked complete in the task test-definition matrix below; 32 command integration cases plus the host delivery matrix exercise the behavior.
**Refactor:** ✅ No change warranted — reused the existing receipt validator; bounded helpers keep command validation and promotion readable without a new abstraction or state store.
**PR Scope:** ✅ Diff matches ticket scope — issue #5511 diagnostics (S7F7PP), checked promotion (0VN2X5), required generated surfaces, tests, docs, and the investigation learning only.
**Dep Drift:** ✅ Clean — no dependency manifest or lockfile changed. Existing security-audit findings remain separate from dependency drift.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — typed CLI catalog/handler, existing receipt authority, normal generators and dogfood mirrors.
**Experience:** ✅ No new friction — walked a developer from a verified delivery worktree through checked promotion using fake GitHub. Worst step: locating the same installed or bundled CLI used for verification. New steps vs before: 0; the checked command replaces the promotion command.
**Surface Evidence:** ✅ 4/4 affected surfaces have recorded proof below.
**Evidence limits:** ⚠️ Broad runs were not uniformly green: timing failures and agent-caused build races are preserved below. Reruns clear those failures; no live GitHub promotion was exercised. The raw Codex hook's missing-workdir limitation and GitHub's non-atomic remote-head race remain explicit.

Audit passed with warnings: diff-scoped dependency architecture check found no
violations (482 modules, 835 dependencies); independent test/code reviews found
no blocking defect. Unchanged dependency audits reported 8 JavaScript findings
(2 high, 3 moderate, 3 low), 6 Python urllib3 findings, and zero Go affected-code
vulnerabilities. These findings were not changed or suppressed for this patch.

## Task test-definition matrix

| Group | Result and proof |
| --- | --- |
| Actual delivery, subdirectory, symlink, explicit --cwd | Pass; fake gh records the real delivery root for inspection and promotion. |
| Verified launch versus unfinished delivery | Pass; no GitHub call and a specific readiness refusal. |
| Missing/stale evidence, wrong head, inspection errors, offline | Pass; specific codes and no Ready mutation. Offline makes no GitHub call. |
| Evidence changes, frozen PR number, already-Ready PR | Pass; commit/reopened-ticket races refuse. Already-Ready PRs refuse without evidence and succeed without mutation when evidence is valid. |
| Failed Ready operation | Pass; failed result with the attempted network effect and no success claim. |
| Canonical and generated guidance | Pass; readiness skill tests require the checked command and bundled-runtime guidance. |
| Unrelated session and inherited Git config | Pass; unrelated state is ignored and injected core.worktree cannot redirect selection. |
| Repository overrides and open-PR state | Pass; overrides, invalid selectors, CLOSED/MERGED PRs, and inconsistent metadata refuse promotion. |

## Surface evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Execution-time CLI | Real built CLI, linked Git worktrees, fake gh; final smoke/contract command includes project-pr-ready.test.ts | Pass; 32 command cases. GitHub is simulated. |
| Codex readiness hook | pr-readiness-delivery-gate.test.ts covers adapter JSON, native JSON, and native exit-code boundaries | Pass; exact evaluated-root labels, recovery, and correctly rooted allow. Host payloads are simulated. |
| Plugin delivery and mirrors | Real Codex install test rerun; all-five generated-surface check; parity checker | Pass; 276 pairs and 11 contracts. Oversized bundles checked by regeneration, not reviewer inspection. |
| CLI reference and workflow docs | Website build, CLI-reference/terminology checks, skill and CLI documentation contract tests | Pass. |

## Full-run limits and corrected evidence

The historical S7F7PP record's 1,625-scenario run used the root-wide
`test:bdd:acceptance` command, including root and workspace features. The current
resolved plan uses `test:bdd`, which delegates to the package's 596-scenario
acceptance lane and its 50 proof-tag tests. These counts are different scopes.
The three historical root-feature failures were baseline-confirmed before main
catch-up; the package pass does not establish that they were fixed. No new
root-wide acceptance pass is claimed here.

- The first full CLI run passed 11,024 cases, failed seven, and skipped 96.
  Five suites and five cases were blocked by stale-build timestamp checks after
  catalogue regeneration; the other two failures were review-routing deadlines.
- The fresh second full CLI run passed 11,109 cases, failed four on timeouts,
  and skipped 14 intentionally. The earlier freshness/deadline failures cleared.
  All four new timeout cases and both earlier deadline cases passed with one
  worker in 19.91 seconds. No assertions or timeouts were weakened.
- The first full acceptance pass was entirely green. During the duplicate
  package acceptance pass, the agent launched a wrapper that rebuilt dist while
  Cucumber used it. Three scenarios failed, including MODULE_NOT_FOUND for
  dist/cli.js. All three passed unchanged in 1.648 seconds with the build stable.
- An initial file-path-only rerun was canceled after Cucumber warned that it
  merges configured and command-line paths. The successful targeted run used
  exact scenario names. No interrupted run is counted as passing evidence.
- The full verification plan exits nonzero, including unchanged dependency
  advisories. Keep the delivery tickets in verify; do not report a uniformly
  green full plan or use this artifact as authorization for Ready promotion.

Logs are retained under `.project/tmp/`: `5511-verify-current.log`,
`5511-isolated-failures-final.log`, `5511-acceptance-rerun-final.log`,
`5511-smoke-contract-final.log`, `5511-final-surfaces.log`, and
`5511-final-parity.log`.

## Independent review

Source approval: `6a5c9ab1-4f0c-4922-b0c1-a8e21f7f7c4c`.
Generated-copy approval: `461ad36d-8327-4a2a-852b-4931ab39fc1c`.
Learning approval: `a9047cb2-f90a-412a-b15c-081e26e60d7f`.
All were Claude/opus reviews independent of the Codex author. The coordinator
excluded the two oversized generated CLI bundles; normal generation and
freshness checks cover them. Its 1 MiB combined-packet limit required separate
reviews and an explicit, recorded phase-stamp aggregation skip; no combined
approval receipt was fabricated.

Implementation is complete locally. No push, PR creation, live Ready mutation,
issue closure, or release was performed. Raw `gh pr ready` remains dependent on
Codex supplying the correct hook cwd; use the checked command for the supported
cross-worktree route after explicit Ready authorization.
