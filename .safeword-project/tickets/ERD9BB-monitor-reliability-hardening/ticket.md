---
id: ERD9BB
slug: monitor-reliability-hardening
type: task
phase: intake
status: in_progress
epic: upstream-changelog-monitor
relates_to: TT1MQW
---

# Reliability: off-hour cron, 60-day-inactivity heartbeat, failure alert

**Goal:** Keep the monitor from silently dying — the failure mode that would make it worse than useless.

**Why (verified caveats):** GitHub disables scheduled workflows after **60 days of no repo activity** on public repos; `schedule` runs are **delayed/dropped under load, worst at :00**; runs only on the default branch.

## Build

- Cron off-hour and off-:00 (e.g. `17 9 * * 1`).
- Heartbeat: if the workflow hasn't succeeded in N days, alert (issue/Slack) — covers both the 60-day disable and silent fetch failures.
- Fetch failures (source 404/redirect/markup change) raise a distinct "monitor broken" signal, not a silent pass.
- `workflow_dispatch` for manual kick + re-enable after any disable.

## Done when

- A simulated fetch failure and a simulated staleness both alert; cron is off-:00; manual dispatch works.

## Source

docs.github.com (schedule disable-after-60-days, load delays, default-branch).

## Work Log

- 2026-05-31 Created from monitor epic.
