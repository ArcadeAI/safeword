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

# Snapshot store doubles as upstream-version baseline (subsumes 116)

**Goal:** Make the committed snapshots the canonical record of "which upstream version safeword has reviewed against," satisfying ticket 116's baseline-tracking intent.

**Why:** A separate version field (116) + a separate snapshot store would drift. One artifact: the snapshot file's content IS the reviewed baseline; its git history IS the review log.

## Build

- `.github/changelog-snapshots/{claude-code,cursor,codex}.{md,txt}` committed by the workflow.
- Capture the latest version/date alongside each snapshot (header line) so `claude-code-version` / `cursor-version` / `codex-version` are readable without diffing.
- Reconcile ticket **116**: close it as subsumed, or narrow it to "initial baseline seeding," pointing here.

## Done when

- Snapshots carry a readable version/date header; git history shows each reviewed change.
- 116 reconciled (closed-subsumed or narrowed) with a cross-link.

## Source

Ticket 116; this epic's design.

## Work Log

- 2026-05-31 Created from monitor epic; flagged 116 overlap.
