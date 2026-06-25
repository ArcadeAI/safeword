---
id: R6ARF5
slug: monitor-detection-skeleton
type: task
phase: intake
status: done
epic: upstream-changelog-monitor
relates_to: TT1MQW
last_modified: 2026-06-25T20:06:00Z
---

# Scheduled workflow: detect CC changelog change, open issue (skeleton)

**Goal:** End-to-end walking skeleton for ONE source (Claude Code): scheduled workflow fetches the changelog, diffs against the committed snapshot, opens/updates a GitHub Issue on change. **Detection is read-only — it never writes the snapshot.**

**Why:** Prove the loop (schedule → fetch → diff → issue) on the easiest source before adding breadth. The detection/closure split (below) is load-bearing — see TT1MQW.

## Detection ≠ closure (the snapshot rule)

The snapshot on `main` means "reviewed baseline." Detection must **not** advance it — if it did, a change would be marked reviewed before anyone reviewed it. The snapshot advances only in the PR that actually does the review (`Closes #<issue>` + snapshot bump — ticket 99XBFG, enforced by 31B5AM). Consequence: a change stays detected (issue stays open) until the review PR merges, which is correct — it _is_ still unaddressed on `main`.

## Build

- `.github/workflows/upstream-changelog-monitor.yml`, `schedule: cron "17 9 * * 1"` (weekly, off-hour/off-:00) + `workflow_dispatch`.
- Fetch `raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`.
- Compare to `.github/changelog-snapshots/claude-code.md`; if changed, open OR update the single source-keyed issue (NBRWN8). **No snapshot commit here.**
- `permissions: { issues: write }` (read-only on contents — note: detection no longer needs `contents: write`).

## Done when

- A `workflow_dispatch` with a stale snapshot opens/updates the issue with the new CC entries and **leaves the snapshot untouched**.
- No-change run is a clean no-op (no issue, no commit).
- Re-running with the same stale snapshot updates the same issue (no duplicate).

## Source

docs.github.com (schedule caveats); raw.githubusercontent.com/anthropics/claude-code

## Work Log

- 2026-06-25T20:06:00Z Implemented the read-only scheduled monitor workflow and source-agnostic issue reporting as part of 3ZRP8G. The workflow checks committed snapshots, opens or updates a source-keyed issue on drift, and never writes snapshots.
- 2026-05-31 Created from monitor epic.
- 2026-05-31 Corrected: detection is read-only (no snapshot commit) — fixes the "waiting PR already covers it" misfire. Snapshot advance moved to the closing PR (99XBFG/31B5AM).
