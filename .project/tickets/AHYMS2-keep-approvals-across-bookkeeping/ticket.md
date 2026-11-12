---
id: AHYMS2
slug: keep-approvals-across-bookkeeping
type: task
phase: implement
status: in_progress
scope:
  - Ticket identity ignores Work Log journal entries, its heading and phase_anchors
  - Stale planning receipts name changed, added or removed sources
out_of_scope:
  - approve-plan prompt recheck (PR 7215)
  - planningSurfaceIdentity reference definitions
  - Review runner and stamp verifier selecting different Safeword versions
done_when:
  - Work Log journal and phase_anchors edits keep planning approvals current
  - Contract edits, the execution-discovery notice and referenced link destinations still stale them
  - Trial N4DYBQ replay shows the 01:29, 01:46 and 04:46 refreshes avoided and the 02:58 cap still stale
created: 2026-11-12T05:47:19.091Z
last_modified: 2026-11-12T05:47:19.091Z
---

# Keep valid approvals when agents update ticket bookkeeping

**Goal:** Ticket Work Log bookkeeping no longer stales planning approvals, while real contract changes still do

**Why:** Issue #5766: phase changes appended a Work Log line that staled every planning approval and forced repeated reviews

**Tracking:** #5766 · PR #7200 · branch `claude/github-issue-5766-3448f4`

## Process note

This ticket was opened after the work was done. The fix was built test-first on the core unit tests but without a Safeword ticket. Plan reviews were Codex quality reviews of `proposal-5766.md`, not stamped phase reviews. The `tdd-review`, `/verify` and `/audit` steps run under this ticket to close that gap. Scenarios were not written before code, and this ticket does not claim they were.

## Root cause

`semanticTicketIdentity` (`packages/cli/src/review/planning-context-identity.ts`) ignored `phase`/`status` but hashed the whole ticket body. `post-tool-work-log.ts` appends `- <time> Phase: X → Y` on every phase edit, so a phase change staled every scenario-gate, plan-implementation and plan-execution approval. Trial N4DYBQ receipts show the ticket digest was the only changed input at 01:29 and 01:46.

## Scope

- In: the ticket identity ignores the `## Work Log` heading, its top-level lists, paragraphs and definitions, plus `phase_anchors`. Stale planning receipts name each changed, added or removed source.
- Kept bound: frontmatter contract fields and unknown keys, same-kind `review_dispositions`, headings and blockquotes in the Work Log (the execution-discovery notice), sections after the Work Log, and referenced link definitions (first definition wins, including nested ones).
- Out: `approve-plan` prompt recheck (PR #7215), `planningSurfaceIdentity` reference definitions (separate task), and the review-runner/stamp-verifier version mismatch.

## Decision for the reviewer

Main's 920BVH treats everything under the Work Log as history, which includes the execution-discovery notice. Here the notice still binds: without it, `approve-plan` approves a current-format Implementation Plan after a discovery without a fresh review. This was proven by a mutation that removed the notice (7 failing tests, approve-plan reporting "Existing approval remains current").

## Proof

- Unit: `tests/review/ticket-journal-identity.test.ts`, `tests/review/stale-planning-sources.test.ts`.
- CLI/status integration: `tests/integration/planning-role-review-identity.test.ts` (real work-log hook, journal note, nested link destination, scenario anchor switch), and `tests/integration/plan-design-approval.test.ts` (discovery notice sequence).
- Trial replay: the pre-fix fingerprint reproduces all five recorded ticket digests. With the fix, the 01:29, 01:46 and 04:46 refreshes stay approved, and the 02:58 precision cap still goes stale.
- Live: a copy of N4DYBQ with real Codex approvals, stamped. A headless Claude Code session with this branch's plugin changed `plan-execution → implement`. The hook appended its line, all three stayed approved, and coding stayed authorized.

## Work Log

- 2026-11-12T05:47:19.091Z Started: Created ticket AHYMS2
- Recorded already-delivered work: commits f6a2025ed..c109fd4f7 on PR #7200; CI green on c109fd4f7. Remaining: tdd-review, /verify, /audit, close.
- 2026-11-12T05:48:24.669Z Phase: intake → implement
