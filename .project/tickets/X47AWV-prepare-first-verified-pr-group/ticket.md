---
id: X47AWV
slug: prepare-first-verified-pr-group
type: task
subtype: bug-investigated
phase: done
status: done
created: 2026-10-14T17:36:33.762Z
last_modified: 2026-10-16T14:30:12Z
---

# Prepare the first verified PR group for merge

**Goal:** Establish the smallest independently safe landing group within epic #4200 and present exact merge evidence for human approval.

**Why:** Land useful completed work without borrowing fixes or proof from unmerged higher PRs.

**Scope:** Compare a complete approval-repair backport with expanding the first landing group; prepare and verify the smaller correct candidate, including authorized test-quality improvements and truthful preservation of inherited incomplete verification attempts.

**Out of Scope:** Completing the epic or deferred OpenCode/cloud qualification; changing authorization policy; merging, releasing or deploying.

**Done When:**

- [x] The dependency comparison identifies the bounded backport and its complete prerequisites (dependency-comparison.md).
- [x] The original bypass regression is retained, and both human-approval settings refuse unrepaired approval and permit fresh-review recovery (verify.md).
- [x] Verify, audit, protected refactors and independent quality review are recorded with failures and limitations preserved (verify.md and delivery-checks.md).
- [x] Normal closure and the full candidate Ready-only file-list check pass; GitHub's actual file list and exact final-commit CI remain required before Ready promotion for a human merge decision.

**Tests:**

- [x] Public CLI approval/recovery matrix: 44 passing tests, including the preserved bypass regression and both human settings (verify.md).
- [x] Final changed-flow replay: 14 scenarios / 668 steps, including installed-CLI RED-to-GREEN recovery (verify.md).
- [x] Evidence commit 53e0585ad passed Node 22/24 CI and the existing repository dependency-audit policy (PR #5881); final reconciliation commit checks remain required before Ready.

**Evidence limits:** The initial local full-suite failures remain unexplained; the raw verifier is not green. The separate 2026-10-16 close check also had seven unexplained deadlines before all 2,077 tests passed; its first run is retained as a transcript summary, without a complete raw log. Baseline dependency advisories remain unresolved; passing CI uses the existing named exceptions, not a clean audit. Latest-job discovery retains its documented boundary, and 33 accepted OpenCode/cloud cases remain deferred. These limits remain visible in PR #5881 and verify.md.

**Previous exact-head proof:** [CI run 38910762211](https://github.com/ArcadeAI/safeword/actions/runs/38910762211) passed at 34be76d32007ea3c32932efa488c640bf52c78da. Ready-triggered run 38914065503 then failed its inherited-child closure check before lint. The current reconciliation archives three incomplete reports and adds explicit child-ticket pointers and this task's evidence; it changes no production code, test or policy. The earlier d76e05472-to-53e0585ad comparison covers only that historical evidence range. Final commit CI and the actual Ready-only file-list check must pass before another promotion.

## Root Cause

Draft CI skips the Ready-only ticket-closure step. Promotion exposed three newly
inherited canonical verification attempts whose child records explicitly remain
incomplete; the guard correctly refuses to treat them as completed child work.
This was reproduced with the actual full PR changed-file list. Ordinary lint
regression is ruled out because that step never ran; stale X47AWV closure is
ruled out because the valid receipt and violation list identify only the three
children. Archive their exact historical attempts with explicit child pointers
and unchanged states, rather than falsely closing children or weakening policy.

## Work Log

- 2026-10-14T17:36:33.762Z Started: Created ticket X47AWV
- 2026-10-16 Resumed: Moved the clean delivery branch into this chat's worktree. Reconciled scope and existing evidence without claiming historical activation or completion. Ready remains blocked pending normal closure; the user's Ready authorization does not authorize merge.
- 2026-10-16 Reviewed: Independent Claude Opus intake review 93c23e19-b782-4dfc-b305-2d18de5f7340 approved the reconciliation. Recorded its verified cross-agent receipt; addressed its evidence-link, unchanged-byte, limitation and stale-metadata warnings. Advanced this task to verify now, without reconstructing historical phases.
- 2026-10-16 Reviewed: Record review 11ca2f36-806b-4b36-9478-f2ffc82f3a06 approved but correctly could not stamp verify because it omitted verify.md. Covering review c77a7f8c-86c3-47e4-a757-8557210b0dc1 approved; addressed its stale Next instruction, dependency-limit summary and historical-heading warnings. Reproduced the material-to-candidate diff and exact CI query; only ticket documentation and evidence changed.
- 2026-10-16 Verified: Covering review 0ccf85ce-9262-433d-84b8-110d49628be6 approved and its verified verify-phase receipt was recorded. Later review 74da93d8-82ba-4a72-9a48-03fca5454bc9 approved; corrected its dependency-file wording and second-failure-summary warnings. Current close-check results are 2,077 CLI passes, 153 collector passes, 198 relay passes / one skip and Go success with no tests. Signed coordinator receipts and phase stamps own subsequent review status, avoiding a self-referential record of each documentation review.
- 2026-10-16 Reopened: The normal Ready command succeeded at 34be76d32 after CI 38910762211 passed. Its Ready-triggered CI 38914065503 then failed the unchanged child-ticket closure guard before lint: inherited incomplete verify.md files for 7CAMAD, D1BKYA and G1C9PP require honest disposition. Returned PR #5881 to Draft. Recorded the documented done-phase skip solely to withdraw completion after that failure; no forward approval or completion was granted. Fresh independent verify review remains required. See ready-closure-disposition.md and review b05403de-2eee-4b9c-b874-910c95f3fa4a.
- 2026-10-16 Closed locally: Archive review 3b1921ac-23f9-4832-988f-5f5cb93124a6 and corrected-record review 54b1ba93-23c5-4f43-b525-0e54985debe3 independently approved with no errors. Recorded the verified Claude Opus cross-agent verify stamp and closed normally. The unchanged guard passes on the complete candidate file list; its 13 regression tests and all three archive-byte comparisons pass. Actual GitHub file-list validation and final-head CI remain required before the next authorized Ready attempt. No child was closed and no policy was changed.
