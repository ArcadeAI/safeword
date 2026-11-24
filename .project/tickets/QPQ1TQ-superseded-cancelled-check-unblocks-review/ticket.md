---
id: QPQ1TQ
slug: superseded-cancelled-check-unblocks-review
type: task
phase: done
subtype: bug-investigated
scope: |
  Ignore a cancelled check run when a later run of the same check from the same
  workflow exists on the head SHA, instead of failing on any cancelled run. The PR
  review worker (dogfood copy and installed template) passes each run's workflow
  and run number into the inspection input; review-pr parses both as optional fields.
out_of_scope: |
  - Commit statuses (the combined-status endpoint already returns the latest per context).
  - Changing which conclusions count as passing or failing.
  - Re-running or cleaning up PR #7952.
done_when: |
  - A cancelled run followed by a later successful run of the same check evaluates as passed.
  - A failed latest run still evaluates as failed; a pending latest run still evaluates as pending.
  - A failed run of a same-named check from another workflow still counts, even when a later run passed.
  - A superseded parity cancellation no longer blocks generated files from skipping review.
  - Runs without a workflow or run number are never treated as superseded.
  - Both worker workflows emit workflow and run number only for runs attributed to this PR and head, and generated surfaces are regenerated.
  - A cancelled run is superseded only by a later run of the same workflow; a cancellation from another workflow with the same check name still counts (advisory review finding on PR #8231).
  - Both workers forward each check run's workflow and run number (via actions/runs, with actions: read on the inspect job); a job whose name repeats within its run, or a fork run GitHub does not attribute to this PR, carries neither and is never superseded.
status: done
created: 2026-11-23T19:54:37.573Z
last_modified: 2026-11-24T05:55:00.000Z
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

Order by workflow run number, not `started_at` (the first version): GitHub numbers each workflow's
runs in creation order, and a queued rerun already has its number but may have no start time. Only
a cancelled run with a later-numbered run of the same workflow is dropped. Cross-agent review
rejected "count only the newest run": a same-named check from another workflow would hide its
failure. Grouping by check suite cannot work, because each new workflow run is a new suite.

The advisory PR review then found the same hole for cancellations: a later success from another
workflow could hide a same-named cancelled run. Check runs carry no workflow identity (suite id,
run id and `external_id` all change per run), so the workers now read
`actions/runs?head_sha=...` (`actions: read`, read-only) and map each run's `check_suite_id` to its
workflow `path` and `run_number`. Only runs whose `pull_requests` names this PR get that identity,
and only for jobs whose name is unique within their run. Everything else (apps outside GitHub
Actions, fork runs GitHub leaves unattributed, re-run attempts sharing a run number) carries no
identity and is never superseded (fail closed).

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-23T19:54:37.573Z Started: Created ticket QPQ1TQ
- 2026-11-23T20:45:00Z Done: RED 1fefd45d3, GREEN 43767ffb5, narrowed after review 3dad6a6e6, typecheck fix 1bb672cd6. Refactor: no change warranted.
- 2026-11-23T21:55:00Z Codex quality review found generatedCheckPassed bypassed the rule; fixed in 281baade4 (shared currentCheckRuns), re-review approved.
- 2026-11-23: Reopened. Advisory PR review found a same-named cancellation from another workflow could be hidden by a later success. Maintainer approved adding `actions: read` to forward workflow identity.
- 2026-11-24T00:08:35.612Z Phase: implement → done
- 2026-11-24T00:08:35.674Z Phase: implement → done
- 2026-11-24T00:30:00Z Done again: workflow-identity follow-up RED c102b1c00/224690f66/6f2828e0e, GREEN d7bca5fd0/403cedf62/b706be3b3. Codex implement review dff1e70b approved (cross-agent). Two pre-existing findings proposed as separate tasks.
- 2026-11-24T05:55:00Z Reconciled scope, done_when and Decision with the run-number redesign (256385371) and fork attribution (4693c63bc) after Codex review 869cf96e flagged the stale started_at criteria.
