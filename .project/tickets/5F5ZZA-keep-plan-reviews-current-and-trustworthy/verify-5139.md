# Remaining #5139 scope on current main

Delivery is in progress, with no merge or Ready promotion authorized. Base is
`9f6ac6fce`, the merge of #5995. This continuation does not close #4200 or its
parent ticket and does not import #5857 recovery work.

## Scope

Accepted-scope and persona judgments; typed source/version/reuse-limit records
at planning dispatch, provider and authenticated host boundaries; bounded
installed-rule currency; qualification refusals before explicit reviewer launch.
Main's contract, ownership-based legacy refusal, resolved context, dispositions,
approval authority, route ordering, confirmed provenance and single-use fallback
remain owned by their current implementations.

## New evidence

- Contract TDD: three intended failures, then three passes.
- Provider evidence TDD: three failures and one existing passing refusal, then
  four passes. Plan-record dispatch TDD: one intended failure and four passes.
- Installed currency TDD: one intended failure, two passing controls and nine
  unselected cases. Corrected core run: 190 passed, two existing skips, six files.
- The first qualification RED fixture stopped at legacy admission and is
  excluded. The corrected owned-ticket fixture fails at both forbidden launches
  on main. An intermediate core run retained those fixture failures: two failed,
  188 passed and two skipped. The corrected core run above is separate evidence.
- Broader first regression: 102 failed, 999 passed and two skipped. These include
  old-format fake reviewer results and stale Execution qualification. After
  fixture updates, the follow-up reports one failed and 113 passed; the remaining
  failure is Execution route admission. No failure is relabeled as a pass.
- All-package typecheck passes. Diff audit reports no dependency violations
  across 543 modules and 974 edges. All five derived surfaces were regenerated
  and checked; final source/evidence changes require a final freshness check.
- Full lint found import sorting and packet-preflight complexity issues; repair
  and rerun remain outstanding. Source and test reviews are pending.

## Qualification boundaries

Only changed qualification inputs are being collected. The current capability
corpus retains main's exact Astra model and stronger finding-group oracle. The
first collection was stopped before a complete matrix because Product's schema
selector and fixture context needed correction. It supplies no passing evidence.
Fresh Astra collection passes 18/18. Claude collection remains pending.

Changed Execution conformance is pending behind the global package-test lock.
The first attempt exited 75 without starting tests. A bounded longer lock wait
is running. Old admission hashes have not been stamped onto the changed rubric.

## Historical limits preserved

The old #5139 PR remains separate and Draft. Its exact head and full public body
are archived in `evidence/5139-current-main/historical-5139-pr.json.gz`. Missing
historical RED, the GREEN/REFACTOR SHA collision, six failed and 585 unfinished
broad scenarios, and 33 deferred/unverified accepted cases remain historical.
No current characterization or new qualification repairs those records. Main's
ledger checkboxes and parent state are unchanged. A shell archival attempt naming
the historical ledger was refused by the ledger-write hook; it made no edits.

The required profile-install retry failed on the reported 1.2.0/required 1.1.0
plugin mismatch and left project hooks unchanged. The first commit attempt was
refused by generated-surface checks after runtime edits; no commit was created.

## Readiness

Draft is required. Independent source/test review, final full regression,
Execution qualification, lint repair, final generated freshness and current-head
CI are not yet complete. No live-host privacy, retrieval or epic-acceptance claim
is made.
