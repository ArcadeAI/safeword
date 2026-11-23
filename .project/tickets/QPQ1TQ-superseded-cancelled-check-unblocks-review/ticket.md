---
id: QPQ1TQ
slug: superseded-cancelled-check-unblocks-review
type: task
phase: implement
subtype: bug-investigated
scope: |
  Judge each required check by its latest run on the head SHA, ordered by the
  check run's started_at, instead of failing on any cancelled run. The PR review
  worker passes started_at through into the inspection input; review-pr parses
  it as an optional field.
out_of_scope: |
  - Commit statuses (the combined-status endpoint already returns the latest per context).
  - Changing which conclusions count as passing or failing.
  - Re-running or cleaning up PR #7952.
done_when: |
  - A cancelled run followed by a later successful run of the same check evaluates as passed.
  - A failed latest run still evaluates as failed; a pending latest run still evaluates as pending.
  - Inputs without started_at keep the existing any-run-failed rule.
  - The worker workflow emits started_at for each check run, and the Claude plugin runtime is regenerated.
status: in_progress
created: 2026-11-23T19:54:37.573Z
last_modified: 2026-11-23T19:54:37.573Z
---

# Let a rerun of a cancelled check unblock the advisory PR review

**Goal:** A required check whose cancelled run was superseded by a later successful run counts as passed for the advisory PR reviewer.

**Why:** Marking a PR Ready cancels the in-flight CI run and starts a new one, leaving a cancelled run on the head SHA that blocked the review forever (#7952).

## Root Cause

`evaluatePrerequisite` (`packages/cli/src/commands/review-pr.ts`) returns `failed` if any check run
with the required name is `cancelled`. Each new workflow run creates a new check suite, so a check
that GitHub cancelled and then re-ran leaves two runs on the same SHA. The inspection input carried
only `{name, status, conclusion}`, so nothing could tell which run is current.

## Decision

Order by `started_at`: a pending rerun has no `completed_at`, and check-suite order is not in the
API response. When any matching run lacks `started_at`, keep the old conservative rule.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-23T19:54:37.573Z Started: Created ticket QPQ1TQ
