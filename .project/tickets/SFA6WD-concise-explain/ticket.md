---
id: SFA6WD
slug: concise-explain
type: task
phase: done
status: done
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
last_modified: 2026-11-12T18:52:00.000Z
---

# Make Safeword explanations brief and clear

**Goal:** Give users plain, concrete explanations using the requested concise prompt.

**Why:** The current explain instructions prescribe a lengthy, rigid workflow.

## Work Log

- 2026-11-08T23:04:21.272Z Started: Created ticket SFA6WD
- 2026-11-11T10:32:00-08:00 Continued: Rebased the focused change, regenerated metadata, and opened draft PR #7157. Independent intake review approved; verification continues.
- 2026-11-11T16:27:00-08:00 Reopened verification: The prescribed audit passed, but the prescribed verify command exited 1 after reporting pre-existing dependency advisories; its first full-suite run had three timeouts, which passed in isolation. Two independent reviews requested reopening; a documented phase-review skip cleared the hook's circular block on correcting the false done state.
- 2026-11-12T17:49:00Z Resolved: Dependency remediation merged separately in PR #7201. Bun and Python audits are clean; explain head 93c4dd1d1 passed 11,634 CLI tests in Node 24 CI (10 skipped), versus 11,624 passed on a pre-dependency-merge local head (12 skipped). The three prior integration timeouts did not recur in current-head CI.
- 2026-11-12T18:52:00Z Verified: The prescribed local verify block exited 0 after a frozen reinstall. Its two full CLI runs passed 11,632 tests each, the acceptance and proof lanes passed, and build, typecheck, and dependency checks passed. Independent verification review follows.
- 2026-11-12T18:53:00Z Closed: Independent cross-agent review approved verify.md; Safeword stamped the verify phase and accepted ticket closure.

## Root Cause

The explain prompt prescribes lengthy target-specific steps and a fixed output format, competing with the requested concise response. Inspection confirmed that both the source and generated skill contained those instructions; a missing generated copy is not the cause.

## Verification

- The prompt contract test failed against the original and passed against the replacement.
- Generated surfaces and lifecycle fixtures regenerated and checked successfully.
- Before the dependency merge, two full CLI runs passed 719 files and 11,615 tests (14 skipped). A later pre-merge rebase passed 719 files and 11,624 tests (12 skipped). At explain head 93c4dd1d1, Node 24 CI passed 720 files and 11,634 tests (10 skipped).
- Acceptance suite passed 599 scenarios and 11,786 steps; proof suite passed 52 tests.
- The prior 9 JavaScript and 16 Python dependency advisories were cleared in separate PR #7201. Bun and Python audits now report no vulnerabilities. Current-head Node 22 and 24 CI passed full tests, behavior checks, and release gates. After a frozen reinstall, the prescribed local verify command exited 0: two full CLI runs passed 11,632 tests each, acceptance passed 599 scenarios and 11,786 steps, and proof passed 52 tests.
- Project install synchronized skill copies. Local Claude activation requires a published plugin version and is outside this source change.
