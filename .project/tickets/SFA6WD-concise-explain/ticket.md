---
id: SFA6WD
slug: concise-explain
type: task
phase: intake
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
last_modified: 2026-11-08T23:04:21.272Z
---

# Make Safeword explanations brief and clear

**Goal:** Give users plain, concrete explanations using the requested concise prompt.

**Why:** The current explain instructions prescribe a lengthy, rigid workflow.

## Work Log

- 2026-11-08T23:04:21.272Z Started: Created ticket SFA6WD

## Root Cause

The explain prompt prescribes lengthy target-specific steps and a fixed output format, competing with the requested concise response. Inspection confirmed that both the source and generated skill contained those instructions; a missing generated copy is not the cause.

## Verification

- The prompt contract test failed against the original and passed against the replacement.
- Generated surfaces and lifecycle fixtures regenerated and checked successfully.
- Full CLI suite passed twice: 719 files, 11,615 tests, 14 skipped each time.
- Acceptance suite passed 599 scenarios and 11,786 steps; proof suite passed 52 tests.
- Dependency audits reported nine JavaScript and 16 Python advisories; closing verification is not clean.
- Project install synchronized skill copies, but Claude activation failed because the plugin was not enabled at project scope.
