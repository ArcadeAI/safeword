---
id: KGDT49
slug: ledger-typo-correction
type: task
phase: verify
status: in_progress
created: 2026-11-17T04:39:38.051Z
last_modified: 2026-11-17T04:41:00.000Z
external_issue: https://github.com/ArcadeAI/safeword/issues/6987
external_prs: [https://github.com/ArcadeAI/safeword/pull/7594]
scope:
  - Reject a checked ledger SHA that names no commit in the repository, at write time.
  - Allow rewriting a checked row in place when its cited SHA names no commit and the replacement does, same step and scenario.
out_of_scope:
  - Removing, unchecking, or converting a phantom-SHA row to a skip (stays locked).
  - Re-running the executable-RED review when a GREEN SHA is corrected.
  - Changing the Bash ledger-write guard or the closeout done gate.
done_when:
  - Ticking a well-formed nonexistent SHA is denied by the edit hook.
  - Rewriting a phantom-SHA row to a real commit is allowed; every other rewrite of a checked row is still denied.
  - Both behaviors are covered by integration tests that fail on origin/main.
---

# Let a mistyped ledger commit be corrected instead of blocking closeout

**Goal:** A mistyped commit SHA in the R/G/R ledger is caught when the box is checked, and an existing one can be corrected instead of permanently blocking closeout.

**Why:** ArcadeAI/safeword#6987: a well-formed but nonexistent SHA passed the write-time check, failed closeout, and the historical-evidence lock refused every correction, so a human had to fix it by hand.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-17T04:39:38.051Z Started: Created ticket KGDT49
- 2026-11-17T04:41:00.000Z Note: ticket created retroactively. Fix (bdade8fc5) and cross-scenario test (16dcea87c) already on PR #7594; workflow was skipped and is being run now.
- 2026-11-17T04:41:00.000Z Found: tests written after the fix. RED proven afterwards by running the hook directly against origin/main hooks: nonexistent-SHA tick allow→deny, phantom→real rewrite deny→allow, cross-scenario move deny on both.
- 2026-11-17T04:41:00.000Z Found: full CLI suite 11829 pass; local failures environmental (unbuilt retro-relay dist, Go toolchain, opencode download). CI green on bdade8fc5.
- 2026-11-17T04:50:00.000Z Refactor: no structural change warranted (duplicated commit-seeding is 2 uses, different shapes).
- 2026-11-17T04:52:00.000Z Audit: 1 error — E004 TDD.md annotation rule described format only. Fixed: documented existence check + correction path.
- 2026-11-17T04:55:00.000Z Quality review (codex, cross-agent, 0b993e1b): request_changes — a correction could uncheck the phantom row and check a different row of the same step (transplant; skips GREEN gate). Confirmed by direct hook run. Fixed: pairing now requires same ordinal among that step's rows and unchanged row count. Added failing-first test. Also hardened: prior annotation must be hex before reaching git rev-parse.
- 2026-11-17T04:58:00.000Z Quality re-review (codex, c7a5f2cf): request_changes — a paired correction did not reserve its rows, so with a second unchecked GREEN the corrected row was re-read as a new GREEN and hit the executable-RED gate (valid correction denied). Same root cause as the transplant: pairing did not own row identity. Fixed at the mechanism: the paired old row is reserved in usedOld and the corrected new row is excluded from new-credit matching. Failing-first test added.
- 2026-11-17T05:05:00.000Z Regression from that fix: pairing claimed rewrites to `skip: manual`, losing the specific relabel denial. Fixed: only SHA → SHA rewrites pair.
- 2026-11-17T05:35:00.000Z Quality review pass 3 (codex, 041d5999): request_changes — preservation matched by annotation text before position, so a replacement SHA already cited by another same-step row stole that row and the valid correction was denied. Third finding in one class (row identity during matching) → fixed the class: preservation now matches same-position rows across all historical rows first, then any position. Failing-first test added.
- 2026-11-17T05:40:00.000Z Quality review pass 4 (codex, cross-agent, 3053135a): approve, no findings. Recorded as the intake phase-exit stamp; phase → implement.
- 2026-11-17T04:55:00.000Z Dead end: red-check script passed literal "\n", so its earlier cross-scenario "deny" was a reconstruction failure, not the rule. Vitest cross-scenario test unaffected (real newlines).
- 2026-11-17T05:33:33.207Z Phase: intake → implement
- 2026-11-17T07:55:00.000Z Quality review pass 5 (codex, cross-agent, 16d61734): approve, no findings, on current sources. Implement stamp recorded as a declared skip citing it: the full diff (~1.02MB incl. generated mirrors, plus 3 bundled runtimes over 256KB) exceeds the review packet limit.
- 2026-11-17T07:55:00.000Z Phase: implement → verify. /verify recorded in verify.md.
- 2026-11-17T08:05:00.000Z Refactor re-run on the final code: 2295f172c builds removed rows directly and checks the old row's SHA kind once. 287/287 ledger tests pass; generated surfaces regenerated.
- 2026-11-17T08:06:00.000Z Audit re-run at 2295f172c: passed, 0 errors and 0 warnings. verify.md updated.
