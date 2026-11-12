---
id: SFA6WD
slug: concise-explain
type: task
phase: verify
status: in_progress
subtype: bug-investigated
scope:
  - Replace the explain skill and Cursor command instructions with the approved wording.
  - Regenerate and synchronize distributed copies.
out_of_scope:
  - Changes to unrelated workflows or model behavior guarantees.
done_when:
  - The approved prompt is shipped across supported surfaces.
  - Relevant tests and closing verification pass.
created: 2026-11-08T23:04:21.272Z
last_modified: 2026-11-11T18:45:00.000Z
---

# Make Safeword explanations brief and clear

**Goal:** Give users plain, concrete explanations using the requested concise prompt.

**Why:** The current explain instructions prescribe a lengthy, rigid workflow.

## Work Log

- 2026-11-08T23:04:21.272Z Started: Created ticket SFA6WD
- 2026-11-11T10:32:00-08:00 Continued: Rebased the focused change, regenerated metadata, and opened draft PR #7157. Independent intake review approved; verification continues.
- 2026-11-11T16:27:00-08:00 Reopened verification: The prescribed audit passed, but the prescribed verify command exited 1 after reporting pre-existing dependency advisories; its first full-suite run had three timeouts, which passed in isolation. Two independent reviews requested reopening; a documented phase-review skip cleared the hook's circular block on correcting the false done state.

## Root Cause

The explain prompt prescribes lengthy target-specific steps and a fixed output format, competing with the requested concise response. Inspection confirmed that both the source and generated skill contained those instructions; a missing generated copy is not the cause.

## Verification

- The prompt contract test failed against the original and passed against the replacement.
- Generated surfaces and lifecycle fixtures regenerated and checked successfully.
- Earlier full CLI runs passed twice: 719 files, 11,615 tests, 14 skipped each time. The rebased current head passed 719 files, 11,624 tests, 12 skipped.
- Acceptance suite passed 599 scenarios and 11,786 steps; proof suite passed 52 tests.
- The PR's CI dependency check passed, but the prescribed local verify dependency lane found 9 JavaScript and 16 Python advisories in existing locks. Closing verification is therefore not clean.
- Project install synchronized skill copies. Local Claude activation requires a published plugin version and is outside this source change.
