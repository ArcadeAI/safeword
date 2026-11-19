# #4200 completion work — November 19, 2026

Base: fetched `origin/main` at `bf28376319a0ace6d2bb0afa03de961a35d24f45`.
This descends from the prior assessment at `8974a7ad6`. The active dispute
checkout, unpublished assessment outputs and old recovery checkout were read
in place. Their evidence and edits remain in those checkouts.

| Accepted outcome | Owners | Evidence and remaining work |
| --- | --- | --- |
| Decisions complete and execution startable | G1C9PP, 7CAMAD | November 9 receipts 827f4999 and 683e7af9 explicitly pass focused decision reviewability. Actual plan repair, subsequent RED and implementation are recorded in the [completion inventory](../completion-evidence-2026-11-09.md). The November 14 Claude archive adds an Implementation Plan with five recorded decisions and an Execution Plan with concrete first proof. It later needed fixes for four output-path failure modes. This supports use of both artifacts and a real repair loop. A cold start that needs no further behavior-shaping decisions remains open. |
| Selective review and human approval | 5F5ZZA | #7077 carries the public-CLI Work Log and contract-reference controls. The enabled-human cases in `plan-design-approval.test.ts` cover reuse and fresh approval after changed approach bytes. `execution-upstream-planning-context.test.ts` covers dependent Execution currency. Keep the actual host observation and exact fixture partitions distinct. |
| Preserve accepted work through upgrades | YCFFNC, ZSHVEB, CGRX0H | The existing markerless transition and Product Plan parity tests cover their named fixtures. The migration feature's written examples require carrying accepted legacy decisions and tests across resume and returning to the current contract on replan. Before the accepted scope edits, the selected migration, proportionality and recovery features reported 256 undefined scenarios in the explicit-path Cucumber binding check. No in-flight upgrade or Product Plan version transition is credited from those examples. |
| Keep small work proportional | 3EG00H | The small-work feature records routing and preservation of completed proof on promotion. The binding check leaves these scenarios undefined. Existing lean task observations support the task path only. A real promotion through the phase that owns the newly discovered decision remains open. |
| Give a concrete next action at every stop | K3EBHB | The shared verification gate now names the failed check and tells the user to fix the errors in the verification report and rerun verification. The earlier trial logs retain actual stop text and intervention. The recovery feature's undefined walkthroughs and the lack of a nontechnical participant leave comprehension open, including pending scope and dispute outcomes. |
| Complete verification, checklist and PR preparation | A639WN, 6XW8H7, T3E4NS, YCFFNC | November 9 Codex and November 14 Claude provide real but assisted native trials. The latter recorded 87 app tests and 20 acceptance scenarios passing, five lint errors and two dependency advisories. Its ticket was marked done with ten contributor checklist rows open and no PR. The lint repair below closes one false-success path. The slicing rubric and fixture checks establish mechanics. Independently reviewable multi-PR delivery and a clean native feature journey through completed checklist and review-ready PR evidence remain open. |

## Replayed first plan step

The archived Claude trial's Execution Plan is unchanged from plan commit
`1a0df6f1` through delivery commit `6601f3e5`. Its first named RED is
“Fail mode leaves an existing output file unchanged.” I ran the plan's named
Cucumber scenario from three disposable Git snapshots with the archived
dependencies. At `7b7619a3` the command exits 1 and names the missing CLI
entry point exactly as the plan predicts. At walking-skeleton `ef65ad28` it
exits 1 at the real exit-code assertion, with actual 0 and expected 1. At
`db16c0da` it exits 0, with all six steps passing. This is an executable
replay of the first step and a behavioral negative control. It establishes
neither full cold-start execution nor new historical RED authority.

On current main, the read-only public command
`safeword ticket delivery-checklist 2KVHME --offline --json` returned
`review_required` against the saved trial. No current checklist readiness
or automatic upgrade of the earlier review can be credited from that run.

## In-flight files, small work, and parent authority

- The current CLI's offline reconciliation with no agent activation succeeds
  on a disposable copy of trial commit `2101e277`. All six 2KVHME ticket
  files retain matching SHA-256 hashes, including both plans and the ledger
  after its first recorded passing scenario. This is an install over an
  earlier 1.2.0 build with different repository bytes. The archived review
  cannot be carried forward as current authority from this file-preservation
  result.
- Three offline public `ticket new` calls create only `ticket.md` for an
  explicitly typed patch and task, and `ticket.md` plus `spec.md` for a
  feature. The fresh feature still emits `product_plan_contract: v1`.
  This supports proportionate artifact creation and confirms the v2 writer is
  undelivered at this entry point. Automatic classification and promotion
  require their own proof.
- The parent reconciliation command refuses G1C9PP, 7CAMAD, YCFFNC, ZSHVEB,
  3EG00H and K3EBHB with `PARENT_RECONCILIATION_FAILED`. Recomputing their
  exact recorded digests from `ddaebbdb0` (five children) and `cd7514433`
  (ZSHVEB) matches all six. Current inherited values have semantic changes,
  including job text and project non-goals for each child. Five also have a
  changed milestone outcome; G1C9PP, 7CAMAD and ZSHVEB have changed milestone
  non-goals. The success threshold is the same. That is real authority drift
  rather than a formatting change or a hash generation error. Review the
  inherited changes with the owner before accepting a new binding or
  advancing a child through a review gate.

3EG00H was reconciled after comparing its exact inherited changes. The M3
outcome, non-goals and success threshold are unchanged. The changed TBU3
comment locates feature TDD sequencing, and the inherited project non-goals
clarify headless waits and accurately labelled fallback. The parent and child
now record the user's #6786 and November 14 boundaries. The public reconcile
check returns healthy for the new binding; 3EG00H returned to scenario review
for its revised packet. Fresh cross-agent review
`7960fbfc-a3be-4837-b1ad-0798130f4188` approved after correcting the
out-of-scope promotion case. The source CLI still reports that receipt
approved. The installed Codex build reports it stale, and the current
checkout's bundled writer refuses project-writable runtime authority.
No scenario stamp or phase advancement was recorded.

K3EBHB was also reconciled against its exact prior digest. The M2 outcome
now names dispute routing, and the NTB Rule explicitly covers stale planning
contracts. The child still owns only recovery wording. Its prior OpenCode
examples and unchecked Desktop ledger remain in Git at `bf2837631`.
Its current packet checks human and plan authority, the cause of staleness,
and one consistent action for a headless approval wait. Independent review
`ef7c8496-8cfe-436a-8c6f-7cecdaf81231` rejected the stale-review proof and
`67b141ee-2138-4785-86b4-b2366c867272` rejected conflicting actions for
the same cloud wait. The corrected packet is approved in the source runtime
under `983229fa-cd01-456e-b9e5-0c9c7f6ed917`. The installed runtime again
reports stale. Recovery still needs executed proofs and a real nontechnical
walkthrough. G1C9PP, 7CAMAD, YCFFNC and ZSHVEB retain their recorded bindings.

## Concrete verification repair

The November 14 archive at
`/Users/alex/Projects/safeword-trials/2026-11-14-main-02a996e7c-csv/`,
ticket `2KVHME`, records the failure filed as
[#7524](https://github.com/ArcadeAI/safeword/issues/7524). Its `verify.md`
contains both `**Lint:** ❌ 5 errors` and a passing PR Scope line.
The base shared verification check returned `ok: true` for those unchanged
archive bytes. The repaired check returns `ok: false` and a recovery action.
A disposable Git project with those bytes rejects PR-readiness receipt
finalization. Replacing the report with passing lint and scope admits the
positive control. A fenced example of an earlier failure does not block
passing lint. The archived project was read only. The verification skill now
uses the existing checklist and retained-proof commands for adopted features
and keeps an unfinished checklist out of the ready verdict.

The new check recognizes an explicit failure on each canonical Test Suite,
Gherkin, Build, Lint, Typecheck or Scenarios status line. It accepts older
reports without those lines and preserves clean and skipped statuses. Existing verification and delivery
obligations still determine whether such a report is sufficient for the ticket.

Independent Claude quality review `bbdfabef-943c-4802-8a30-ec1ad72f4d86`
approved the generalized checker, verification guidance and both regression
files. The earlier lint-only review `6521e643-9daa-446c-b5a8-439cd6cf1058`
identified nonblocking warnings in existing PR-scope and feature-ledger
parsing. Both receipts are bounded to their respective reviewed files.

The 10-file focused CLI suite passed all 398 tests, including selective
approval, legacy entry, checklist proof and PR readiness. The CLI typecheck,
all 277 parity pairs and 11 contracts, and all five generated surfaces pass.
The targeted missing-plan recovery scenario initially exited 75 on the shared
test lock, then passed all 48 steps after the lock cleared. Keep both results.

The isolated repair is [Draft #8034](https://github.com/ArcadeAI/safeword/pull/8034)
at `289161ab2fc3b879b381e065ca7284b7d2c96c4e`. The same patch is
`a61d23e1a` on this branch. A live local Claude smoke loaded the bundled plugin
and reached the native edit hook. It stopped before the new check because the
disposable ticket had no authenticated verify-phase review. The native
closeout proof remains open. The live probe was a scoped regression check
with reported model usage under one cent, with no qualification run.

## Large-contribution slicing evidence

7CAMAD's Execution Plan separates the public authorization command, later
enforcement, and the final cold-start/replan proof. It names independent
completion signals and states that each slice can merge before its successor.
The actual [first merge group #5881](https://github.com/ArcadeAI/safeword/pull/5881)
landed at `ca452a9cc`. The X47AWV record preserves its verified backport
prerequisites and the first Ready-triggered run that rejected inherited
incomplete child verification. The bounded
[continuation #6031](https://github.com/ArcadeAI/safeword/pull/6031) landed later
at `bac142eac`. T3E4NS preserves where its evidence and missing historical RED
stop. These are real examples of bounded deliveries, along with the historical
7CAMAD semantic review of one- and multi-PR shapes. They do not establish that
every planned slice was independently delivered, or that either converter
trial completed the feature checklist and review-ready PR.

## Current authority and host boundaries

- #6786 / K8VPME remains in force. Attempt independent review first and label
  permitted reduced assurance accurately. Model-strength qualification,
  exact-model admission and the failed-independent-attempt prerequisite remain
  retired.
- The user's November 14 decisions exclude OpenCode CLI, TUI and Desktop
  delivery and proof from #4200. Follow-up [#7491](https://github.com/ArcadeAI/safeword/issues/7491)
  owns that boundary. Dispute hosts must run updated feature-capable Safeword.
  Automatic mixed-version protection and rollback over unresolved disputes are
  excluded. Read the accepted decisions in the active 26FK42 checkout's parent
  ticket and child spec. The child is in implementation, with its own plans.
- Local Claude and Codex evidence is assisted. A fresh Codex native setup
  retry reported installed plugin 1.2.0 while the installer requires 1.1.0.
  It reported project hooks unchanged. Native Cursor, Claude Code Cloud and
  Cursor Cloud Agents still need their own applicable proof. Codex Cloud is
  advisory and has no authoritative planning gate.
- The November 13 dependency hold remains in effect for the original converter.
  November 19 registry checks show ESLint 10.15.0 selecting
  `@eslint/config-array ^0.23.6`, whose minimatch range is `^11.0.5`.
  The archived Safeword pins still include sonarjs 4.2.2 and TypeScript ESLint
  8.71.0. Their minimatch ranges are `^10.2.6` and `^10.2.2` respectively.
  The prior disposable reconstruction retained a failing minimatch audit.
  No diagnostic major override or archived dependency change was applied.
- Preserve the missing historical RED, SHA collision, and failed, stale and
  rejected runs. The October observer profile references two deleted tests.
  Its 257 passes and old sufficiency counts stay historical. The broader
  byte comparison remains 9 unchanged, 12 changed, and 1 deleted.
- CKWE2D retains fixed retrospective eligibility. 5GK1CN is unfinished
  EP9-only CI-provenance planning. The 33 deferred identities retain their
  original owners and status (MCWV4B 18, FC33HK 12, KKP2R3 2, DRD65E 1).
