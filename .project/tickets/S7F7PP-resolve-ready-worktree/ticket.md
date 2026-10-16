---
id: S7F7PP
slug: resolve-ready-worktree
type: task
subtype: bug-investigated
phase: verify
status: in_progress
created: 2026-10-16T17:34:12.812Z
last_modified: 2026-10-16T19:58:47Z
external_issue: https://github.com/ArcadeAI/safeword/issues/5511
scope:
  - Reproduce the Codex session-root versus command-workdir mismatch.
  - Report the actual readiness checkout and hook cwd with supported recovery.
out_of_scope:
  - Changing Codex or guessing tool workdirs omitted by the host.
  - Weakening readiness evidence or copying tickets and receipts between checkouts.
done_when:
  - Native and adapter readiness denials identify the evaluated checkout and recovery.
  - Correctly rooted worktree readiness and evidence checks still pass.
---

# Explain readiness checkout mismatches for developers

**Goal:** Revalidate issue 5511 and make readiness denials name the evaluated checkout and recovery.

**Why:** A shell tool workdir can differ from the session root and select another ticket.

## Work Log

- 2026-10-16T17:34:12.812Z Started: Created ticket S7F7PP
- 2026-10-16 Investigated: checkout matches origin/main; dependency bootstrap completed. Today's issue comment distinguishes session cwd from tool workdir.
- 2026-10-16 RED: all three new cases failed on the missing `Readiness checkout` label while naming launch-checkout ticket OTHER (adapter JSON, native JSON, native exit-code).
- 2026-10-16 GREEN: 114/114 focused readiness, translation, and integration tests passed. Typecheck passed after adding the explicit test environment type.
- 2026-10-16 Reviewed: independent Claude/Opus reviews approved scope and implementation. Narrowed the new context to Codex in response to the user-facing noise finding. Accepted exact local paths because identifying the evaluated checkout is the diagnostic's purpose; these are visible in the local denial and transcript.
- 2026-10-16 Reviewed: native tests use dist intentionally; the documented package test wrapper rebuilds dist before invoking Vitest. Preserve the full upstream limitation in issue 5511 rather than treating this mitigation as closure.
- 2026-10-16 Generated: all five generated surfaces verified; lifecycle fixture result hashes stayed unchanged and only installed-tree hashes moved. Synced dogfood through the installer (Claude profile reports reload required); removed its unrelated settings key-order churn. Parity passed.
- 2026-10-16 Verify: root full suite passed relay 198 and collector 153 tests; CLI passed 10,524 with 14 skips and one review-routing deadline failure. The failed test took an extra fallback route under its 2-second bound, then passed unchanged in isolation (1.33 seconds). All readiness tests passed in the full run. Build, root ESLint, all three typechecks, formatting, and generated/parity checks passed.
- 2026-10-16 Verify: dependency audit reports 8 pre-existing advisories (2 high, 3 moderate, 3 low); all dependency manifests and lockfile are unchanged. No dependency upgrades are included in this issue's patch.
- 2026-10-16 Review disposition: the generated Claude skill's unnamespaced quality-review/finish-review references predate this diff (confirmed in HEAD); generator naming cleanup is outside this issue. Tests exercise the real adapter/native wiring rather than setting its runtime discriminator themselves.
- 2026-10-16 Acceptance: 1,618 scenarios passed, 3 skipped, 4 failed. Exact-name isolated reruns on this patch and a clean origin/main checkout both reproduce the same 3 existing failures: advisory-review evidence over budget incorrectly marked complete, and two Codex plugin command regex expectations missing the existing Bun flags. Hook responsiveness passes in both isolated runs. The original full lane's responsiveness failure and the Vitest deadline failure were not repeatable in isolation; preserve the failed broad results rather than claim an all-green suite.
- 2026-10-16 Main catch-up: fetched and fast-forwarded from d5885e587 to ca452a9cc (#5881, one first-parent merge with 1,112 reachable commits). Saved and restored the uncommitted work. Canonical hook code merged cleanly; conflicts affected only generated bundles/catalogue/fixture metadata, which were regenerated from current main plus this patch. All 5 generated surfaces pass their check.
- 2026-10-16 Impact: current main adds execution-planning and coding-authorization gates to the shared hook, but leaves the readiness evaluator, namespace resolver, Codex CLI adapter/translation, readiness skill, and delivery-gate test file unchanged. The diagnostic remains at the existing Bash readiness denial before the new edit-planning gates. Root dependency manifests and lockfile did not change. Followed the newly documented scripts/dev toolchain launcher for post-sync commands.
- 2026-10-16 Post-sync proof: 141/141 tests pass across six readiness/installation/translation/skill/coding-authorization suites; root lint, all three typechecks, all five generated surfaces, and 276 parity pairs plus 11 contracts pass. Fresh Claude/Opus cross-agent review approved the merged change (eae857ed-55a3-433f-b02b-1d015aa332de). Locked dependency refresh checked 1,088 installs across 1,296 packages with no dependency changes; renewed the invalidated bootstrap fingerprint through the supported flow.
- 2026-10-16 Follow-on: the user's instruction to tackle the issue authorized the execution-time command in task 0VN2X5. Its verification records the combined current evidence. The raw hook's missing-workdir limitation is still open upstream; the new checked command validates and promotes from the actual selected worktree without copying readiness evidence.

## Root Cause

Codex 0.160.0 discards the shell command's `workdir` before invoking PreToolUse.
`ExecCommandHandler::pre_tool_use_payload` emits only `{ command: args.cmd }`;
`hook_runtime::tool_hook_cwd` selects the local environment/session cwd independently.
Safeword receives identical payloads for commands targeting different worktrees.
The readiness denial then gives ticket repair advice without naming the checkout
it evaluated, making a context mismatch look like broken ticket evidence.

Pinned sources:

- https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs
- https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/core/src/hook_runtime.rs
- Upstream tracking: https://github.com/openai/codex/issues/32360

Competing hypotheses:

- Stale receipt selects a foreign ticket: not required; launch-checkout session binding alone reproduces the mismatch. Receipt selection already rejects tickets absent from the selected checkout.
- Safeword ignores a correct hook cwd: existing worktree tests supply the delivery worktree as cwd and allow Ready. The native adapter preserves raw stdin into the gate.
- Host loses the tool directory: confirmed from the pinned source above. Existing tests model a worktree-rooted session, not an independently overridden shell workdir.

The local fix is diagnostic and preventive guidance. Full automatic resolution of
the omitted directory remains an upstream dependency; do not claim it is fixed.
The inverse mismatch can also falsely allow readiness when the session checkout
is verified but the invisible command worktree is unfinished, or skip the gate
when the session checkout is unenrolled. Diagnostics cannot repair those cases.
Never infer readiness for an unseen worktree from another checkout's evidence.

## Test Definitions

- With an unrelated ticket in the launch checkout and a verified delivery worktree,
  command-only Codex hook denials identify the launch checkout, reported cwd,
  unrelated ticket, and worktree-rooted session recovery.
- Cover the source adapter and packaged native CLI, including exit-code denial.
- Assert exact path labels and ticket id; cover hook cwd in a subdirectory so
  the evaluated checkout differs from the reported hook cwd.
- Correct hook cwd still selects and allows the verified delivery worktree;
  unfinished tickets and stale receipts remain blocked.
