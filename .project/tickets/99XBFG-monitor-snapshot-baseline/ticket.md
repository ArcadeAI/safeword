---
id: 99XBFG
slug: monitor-snapshot-baseline
type: task
phase: intake
status: in_progress
epic: upstream-changelog-monitor
relates_to: TT1MQW
supersedes_part_of: '116'
---

# Snapshot store = reviewed baseline (advances only on review-closing PR; subsumes 116)

**Goal:** Make `.github/changelog-snapshots/` the canonical "what safeword has reviewed" baseline, advanced **only** by the PR that closes a monitor issue — never by the detection workflow.

**Why:** One artifact, one meaning. The snapshot = reviewed version; its git history = the review log; the diff between upstream and snapshot = the unreviewed delta. This satisfies ticket 116's baseline intent and makes the in-flight-PR case self-resolving: a waiting PR that covers a change is exactly "snapshot not yet advanced," so the change correctly stays flagged until merge.

## Rules

- **Detection never writes snapshots** (R6ARF5). Only a human/agent review PR does.
- The review PR: bumps the source's snapshot to the reviewed version + `Closes #<monitor-issue>`. Merge → baseline advances + issue closes. (CI enforces the bump: 31B5AM.)
- Snapshot file carries a readable header (`source`, `version`, `date`) so `claude-code-version` / `cursor-version` / `codex-version` are legible without diffing.
- Reconcile ticket **116**: close as subsumed (or narrow to "seed the initial snapshots"), cross-linked here.

## Done when

- Snapshots carry version/date headers; advancing one requires a review PR (no workflow auto-commit).
- 116 reconciled with a cross-link.

## Source

Ticket 116; epic TT1MQW design.

## Work Log

- 2026-05-31 Created from monitor epic; flagged 116 overlap.
- 2026-05-31 Tightened: snapshot advances ONLY via the review-closing PR (detection is read-only). Pairs with 31B5AM.
