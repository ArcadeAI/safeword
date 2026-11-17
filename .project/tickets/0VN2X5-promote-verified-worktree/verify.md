# Verification — promote from the selected worktree

## Main integration verification — 2026-10-17 UTC

The earlier closure head conflicted after main advanced to `31befd189` (#5898).
The primary task was reopened for verification, main was merged, and all six
generated metadata conflicts were regenerated from the combined canonical tree.
All 13 issue-specific canonical targets remain byte-identical to green source
`088d06595`; no readiness behavior rework was required.

**Full CI:** ✅ [Run 38992939896](https://github.com/ArcadeAI/safeword/actions/runs/38992939896)
passes at `b4b7e2ead991717736f07dc99d5339754f48f6bb`. Both Node jobs pass
11,152 CLI cases across 673 files (10 intentional skips), physical installation,
and 81 release checks. Node 24 also passes 596 scenarios, 11,118 steps, and
50 proof-tag tests. All ten applicable jobs pass; PR deployment jobs are skipped.

**Local integration:** ✅ 339 readiness/review regression cases pass across eight
files, with two Linux-only process-group cases skipped on macOS. Typechecks,
lifecycle regeneration/verification, all five generated surfaces, and 276 parity
pairs/11 contracts pass. The scoped TypeScript architecture check reports no
violations across 485 modules and 841 edges; the previously disclosed optional
Python analysis limits remain. The current Bun plugin walkthrough passes using
real linked worktrees and simulated GitHub.

The CI watch process lost its network route and exited nonzero; a fresh API read
and downloaded terminal logs independently confirm the successful run above.
This does not alter any historical interrupted/failed local result below.
The re-closure commit changes ticket documentation only and must earn its own
green current-head CI before Ready. The PR body remains the durable readiness
record. Scenario coverage is the same eight task-definition groups; the final
operational-failure case explicitly checks the inspected-PR recovery guidance.

## Delivery source verification — 2026-10-17 UTC

**Full CI:** ✅ [Run 38990046582](https://github.com/ArcadeAI/safeword/actions/runs/38990046582)
passed at `088d065952cb3ea0678a09a1a221e41cc28eb452`: both Node 22.23.2 and
24.18.1 jobs passed 11,131 CLI cases in 672 files (10 intentional skips), relay,
collector, physical installation, and 81 release checks. Acceptance runs on
Node 24 only: 596 scenarios, 11,118 steps, and 50 proof-tag tests passed.
All ten applicable jobs passed. The three deployment jobs
were intentionally skipped on a PR; their deployment-input checks passed.

**Local checks:** ✅ Final command/skill/catalog verification passes 65/65
(46 command cases). The earlier three-file readiness run passes 155/155. All
30 observed failures from the interrupted CLI run pass unchanged in recovery
runs: eight in the readiness file and 22 across eleven other files. A subsequent
hook/schema run passed 2,074 cases and timed out three architecture-staging
cases at the 60-second test deadline; those three pass unchanged in isolation
in 2.78 seconds. This identifies the deadline failure, not its underlying
process-delay cause. No assertion, timeout, or test selection was weakened.

**Acceptance:** ✅ Local package acceptance passes 596 scenarios, 11,118 steps,
and 50 proof-tag tests. Builds, full ESLint, typechecks, all five generated
surfaces, and 276 parity pairs/11 contracts pass. Interrupted runs below remain
incomplete evidence; hosted CI supplies the complete current-source result.

**Audit and review:** ✅ No TypeScript dependency violations; learning and domain
documentation checks pass. Python architecture/dead-code coverage limits are
explicit in delivery-review.md. Independent Claude/Opus reviews
`760ee197-8c4b-422c-a953-58c8efaa2879` and
`52ee81ea-f073-4fa4-ba7d-5293f952d8ee` approve canonical code and the final
changed targets with no blocking errors. Applied failed-promotion recovery
guidance; the remaining suggestions have explicit dispositions.

**PR Scope:** ✅ Diff matches accepted scope: issue #5511 diagnostic and checked
promotion, tests, documentation, required generated surfaces, and the disclosed
urllib3 development-lock security repair. Python audits are clean after
2.7.0 → 2.8.0. Raw JavaScript audit still has eight advisories; existing CI policy
passes with its two pre-existing unpatched-advisory exceptions. No new audit
suppression or policy change was introduced. Go reports zero affected-code
vulnerabilities.

**End-user execution:** ✅ The generated Codex Bun runtime was exercised with
real linked worktrees and a fake GitHub executable at this source head. Inspection
and promotion both used the actual delivery root despite launch-root hints.
This proves the execution boundary; GitHub was simulated in this walkthrough.

Ticket closure changes documentation only. Its new head must pass CI before
Ready promotion and the authorized admin merge. [PR #5911](https://github.com/ArcadeAI/safeword/pull/5911)
holds the current-head readiness record; later CI does not retroactively turn
interrupted local invocations green. Raw Codex hook metadata loss and the
non-atomic remote-head race remain disclosed limits.

## Historical implementation checklist — before delivery follow-up

**Test Suite:** ⚠️ Observed full-run timeouts: fresh full CLI run passed 11,109 cases with 4 timeouts and 14 intentional skips. All four timeouts and the two earlier deadline failures passed in isolation (6/6); their cause is not established by that rerun. Final one-worker smoke, readiness, and CLI-contract run: ✓ 2372/2372 tests pass across 114 files.
**Gherkin:** ✅ Resolved package acceptance lane passes — 596/596 scenarios, 11,118/11,118 steps, and 50 proof-tag tests. The duplicate package lane's three build-race failures passed unchanged in exact-name reruns (3 scenarios, 54 steps). Historical root-wide acceptance is a separate lane, described below.
**Build:** ✅ Success — CLI, relay, collector, website, and Go checker.
**Lint:** ✅ Clean — root ESLint/Gherkin lint and final changed-source ESLint.
**Typecheck:** ✅ Clean — all three TypeScript workspaces.
**Scenarios:** All 8 scenarios marked complete in the task test-definition matrix below; 32 command integration cases plus the host delivery matrix exercise the behavior.
**Refactor:** ✅ No change warranted — reused the existing receipt validator; bounded helpers keep command validation and promotion readable without a new abstraction or state store.
**PR Scope:** ✅ Diff matches ticket scope — issue #5511 diagnostics (S7F7PP), checked promotion (0VN2X5), required generated surfaces, tests, docs, and the investigation learning only.
**Dep Drift:** ✅ At this historical checkpoint no dependency manifest or lockfile changed; the later delivery section records the urllib3 lock update. Existing security-audit findings remain separate from dependency drift.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — typed CLI catalog/handler, existing receipt authority, normal generators and dogfood mirrors.
**Experience:** ✅ No new friction — walked a developer from a verified delivery worktree through checked promotion using fake GitHub. Worst step: locating the same installed or bundled CLI used for verification. New steps vs before: 0; the checked command replaces the promotion command.
**Surface Evidence:** ✅ 4/4 affected surfaces have recorded proof below.
**Evidence limits:** ⚠️ Broad runs were not uniformly green: timing failures and agent-caused build races are preserved below. Reruns clear those failures; no live GitHub promotion was exercised. The raw Codex hook's missing-workdir limitation and GitHub's non-atomic remote-head race remain explicit.

Audit passed with warnings: diff-scoped dependency architecture check found no
violations (482 modules, 835 dependencies); independent test/code reviews found
no blocking defect. Unchanged dependency audits reported 8 JavaScript findings
(2 high, 3 moderate, 3 low), 6 Python urllib3 findings in that earlier scan, and zero Go affected-code
vulnerabilities. These findings were not changed or suppressed for this patch.
The later delivery scan reported three advisory identifiers; these are different
scan snapshots, not a claim that six and three are equivalent counts. Both
current frozen-lock Python scanners report no vulnerabilities after the update.

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

## Historical surface evidence — before the delivery refactor

Follow-up test-quality improvements: all four audit findings are addressed.
The command suite now passes 44/44 cases, with 174/174 passing across five
focused readiness/catalog files and no pending tests. Ten targeted mutation
runs covering nine distinct changes all fail the intended assertions. Added
cases isolate HEAD equality, sanitized child environments, and malformed fields;
operational failures assert exit status and exact attempted network effects.
CLI typecheck, targeted ESLint, formatting, and diff checks pass. Full details
and logs are in `test-quality-audit.md`; the original matrix and broad-run
qualifications above remain historical evidence, not a new full-plan pass.

The table below records the original 32-case checkpoint. The delivery source
verification at the top records the final 46 command cases and later proofs.

| Affected surface | Proof | Result |
| --- | --- | --- |
| Execution-time CLI | Real built CLI, linked Git worktrees, fake gh; final smoke/contract command includes project-pr-ready.test.ts | Pass; 32 command cases. GitHub is simulated. |
| Codex readiness hook | pr-readiness-delivery-gate.test.ts covers adapter JSON, native JSON, and native exit-code boundaries | Pass; exact evaluated-root labels, recovery, and correctly rooted allow. Host payloads are simulated. |
| Plugin delivery and mirrors | Real Codex install test rerun; all-five generated-surface check; parity checker | Pass; 276 pairs and 11 contracts. Oversized bundles checked by regeneration, not reviewer inspection. |
| CLI reference and workflow docs | Website build, CLI-reference/terminology checks, skill and CLI documentation contract tests | Pass. |

## Historical full-run limits and corrected evidence

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
  advisories. At that checkpoint the delivery tickets stayed in verify; those
  runs could not authorize Ready. The delivery source verification at the top
  supersedes this historical next action while preserving the run limits.

Logs are retained under `.project/tmp/`: `5511-verify-current.log`,
`5511-isolated-failures-final.log`, `5511-acceptance-rerun-final.log`,
`5511-smoke-contract-final.log`, `5511-final-surfaces.log`, and
`5511-final-parity.log`.

## Historical independent review — before delivery follow-up

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

## Delivery verification and review follow-up

The user authorized verification, audit, refactor, quality review, CI, Ready
promotion after passing gates, and admin merge. This section supersedes the
historical next-action statements above; it does not erase earlier run limits.

- Fresh verification passed relay (198, one skip), collector (153), acceptance
  (596 scenarios and 11,118 steps), and 50 proof-tag tests. All build and
  typecheck lanes passed. The full CLI run was interrupted after more than
  three hours with 30 observed failures in 12 files and no final diagnostic
  traces. Its duplicate invocation and unchanged duplicate acceptance pass were
  also interrupted. None of those interrupted invocations is counted green.
- Readiness recovery verification passes 155/155 cases across the command,
  shared evaluator, and delivery hook tests, clearing the eight observed
  delivery-file failures. Other observed broad-run failures still need complete
  hosted CI evidence; they are not assumed to be environmental.
- Three isolated refactors were tested and committed: accurate attempt naming,
  one local network-effect builder, and independent success/refusal fixtures.
  Final command verification passes 46/46 cases.
- Diff-scoped TypeScript architecture, learning, and domain documentation checks
  pass. Optional Python architecture/dead-code analysis is unavailable: no
  import-linter contract and a same-named Go `deadcode` executable. No Python
  source changed; dependency checks cover the lock update. See delivery-review.md.
- Updated only urllib3's transitive Python development lock from 2.7.0 to 2.8.0;
  frozen synchronization and Python audits now report no known vulnerabilities.
  Go reports zero affected-code vulnerabilities. Raw JavaScript audit retains
  eight advisories; the repository's existing high/critical CI policy passes
  with its two pre-existing unpatched-advisory exceptions. No new suppression
  or audit-policy change was introduced.
- End-user walkthrough runs the generated Codex plugin runtime under Bun with
  real linked worktrees and a fake GitHub executable. It successfully promotes
  from the actual worktree despite launch-root environment hints. This exercises
  the shipped execution boundary without mutating a live PR.
- At that checkpoint independent quality review and exact-head hosted CI were
  pending. The delivery source verification above records their completed
  results. All seven current-head readiness gates still control Ready and merge;
  detailed dispositions and log paths are in delivery-review.md.
