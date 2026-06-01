---
id: 31B5AM
slug: monitor-snapshot-bump-gate
type: task
phase: intake
status: in_progress
epic: upstream-changelog-monitor
relates_to: TT1MQW
---

# CI gate: a PR that closes a monitor issue must bump the snapshot

**Goal:** Prevent the "addressed but snapshot never moved → monitor fires forever" failure: CI fails any PR that closes a monitor issue without bumping the corresponding snapshot file.

**Why:** The whole design hinges on "snapshot advances only via the review-closing PR" (99XBFG). If a review PR forgets the bump, the baseline never moves and the issue re-opens indefinitely after merge. A gate closes that hole.

## Build

- PR check: if the PR body/commits reference `Closes #<monitor-issue>` (or carry a `changelog-review` label), require a change to `.github/changelog-snapshots/<source>`; else fail with a clear message.
- Identify the source from the issue/label so the gate knows which snapshot to require.

## Done when

- A PR closing a monitor issue without a snapshot change fails CI with an explanatory message; the same PR with the bump passes.

## Out of scope

- Validating that the snapshot content _matches_ the reviewed upstream version (heuristic; revisit only if drift appears).

## Source

Epic TT1MQW; pairs with 99XBFG / R6ARF5.

## Work Log

- 2026-05-31 Created to enforce the snapshot-bump-on-closure invariant (raised by the "waiting PR already covers it" question).
