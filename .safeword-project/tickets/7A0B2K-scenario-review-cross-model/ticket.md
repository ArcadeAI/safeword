---
id: 7A0B2K
slug: scenario-review-cross-model
type: task
phase: intake
status: backlog
created: 2026-06-12T02:37:21.358Z
last_modified: 2026-06-12T02:37:21.358Z
blocked_by:
  - "MR5M3A (builds the cross-model primitive in review-ledger.ts that this consumes)"
---

# Wire scenario-gate fork review to the cross-model knob

**Goal:** Let the existing Tier 2 scenario-gate fork review require a different-model reviewer, reusing the `modelsMatch` primitive MR5M3A adds to `review-ledger.ts`.

**Why:** safeword's scenario-gate review is currently same-model, so it shares the author's blind spots (the correlated-error problem MR5M3A documents). MR5M3A fixes this for the design review; this extends the same protection to the scenario review — the review that catches bad scenarios should itself be independent of the author's model when configured. Surfaced 2026-06-12 while dogfooding MR5M3A: the fork review that caught 7 real findings was itself same-model.

## Work Log

- 2026-06-12T02:37:21.358Z Started: Created ticket 7A0B2K
