---
id: R6ARF5
slug: monitor-detection-skeleton
type: task
phase: intake
status: in_progress
epic: upstream-changelog-monitor
relates_to: TT1MQW
---

# Scheduled workflow: detect CC changelog change, open issue (skeleton)

**Goal:** End-to-end walking skeleton for ONE source (Claude Code): scheduled workflow fetches the changelog, diffs against a committed snapshot, opens a GitHub Issue on change.

**Why:** Prove the whole loop (schedule → fetch → diff → snapshot commit → issue) on the easiest source before adding breadth.

## Build

- `.github/workflows/upstream-changelog-monitor.yml`, `schedule: cron "17 9 * * 1"` (weekly, off-hour/off-:00 per reliability caveats), `workflow_dispatch` for manual runs.
- Fetch `raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`.
- Compare to `.github/changelog-snapshots/claude-code.md`; if changed, open/update an issue with the diff and commit the new snapshot.
- `permissions: { issues: write, contents: write }`.

## Done when

- A manual `workflow_dispatch` with a stale snapshot opens an issue containing the new CC entries and commits the refreshed snapshot.
- No-change run is a clean no-op (no issue, no commit).

## Source

docs.github.com (schedule caveats); raw.githubusercontent.com/anthropics/claude-code

## Work Log

- 2026-05-31 Created from monitor epic.
