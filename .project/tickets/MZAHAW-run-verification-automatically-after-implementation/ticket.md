---
id: MZAHAW
slug: run-verification-automatically-after-implementation
type: task
phase: implement
status: in_progress
created: 2026-06-27T01:23:04.141Z
last_modified: 2026-06-27T20:47:00Z
external_issue: https://github.com/ArcadeAI/safeword/issues/483
scope:
  - stop treating entry to verify as a human-facing approval checkpoint
  - make verify entry direct the agent to run /verify and /audit automatically
  - keep real blockers and user decisions visible when verification finds them
out_of_scope:
  - redesigning all phase review behavior
  - changing done-gate evidence requirements
done_when:
  - implement to verify transition does not inject a pre-verification human review prompt
  - verify guidance tells the agent to run /verify and /audit without asking to proceed
  - regression tests cover Claude and Cursor verify-entry behavior
---

# Run verification automatically after implementation

**Goal:** Prevent SafeWord from pausing for human approval between implementation and verification.

**Why:** Verification is agent-owned work; the human should only be interrupted for real blockers or decisions.

## Work Log

- 2026-06-27T01:23:04.141Z Started: Created ticket MZAHAW
- 2026-06-27T01:25:00.000Z Found: GitHub issue #483 captures root cause: verify phase review fires before /verify evidence exists, creating a false approval stop.
- 2026-06-27T01:33:11Z Complete: changed review-trigger and Cursor stop behavior so verify entry stays quiet; updated BDD verify guidance to run /verify + /audit automatically. Focused hook tests and package typecheck passed.
- 2026-06-27T14:07:00Z Updated: rebased the patch onto current origin/main after #508 and related follow-up commits landed.
- 2026-06-27T15:04:00Z Verified: direct Vitest hook sweep passed with 59/59 tests; package typecheck and git diff --check passed.
- 2026-06-27T20:47:00Z Reviewed: PR feedback found the branch had dropped Cursor stop crash-capture wiring from current main; rebased again, confirmed the wiring was restored, and added a regression test to keep both Cursor stop hook copies wired.
