---
id: YQXSDV
slug: accept-valid-phase-reviews-with-stale-default-ref
type: task
subtype: bug-investigated
phase: intake
status: in_progress
created: 2026-09-28T05:34:30.452Z
last_modified: 2026-09-28T05:45:42.000Z
external_issue: https://github.com/ArcadeAI/safeword/issues/5033
scope:
  - Select the nearest available default-branch merge base for review claims and verify-ticket resolution.
  - Cover stale local and remote default refs in integration tests.
  - Register the shared helper in the install schema and sync generated plugin and dogfood copies.
out_of_scope:
  - Change the independent review policy or receipt format.
done_when:
  - A review of the actual feature diff clears the phase gate with either stale ref topology.
  - A review missing a changed feature file remains blocked when default refs diverge.
  - A default ref that reaches HEAD cannot make an empty implementation claim pass the gate.
  - No available default ref keeps review claims empty and verify-ticket requests an explicit ticket.
  - Verify-ticket resolves current work without including older default-branch tickets.
  - Schema tests prove the helper is registered for installation; generated plugin and dogfood mirrors match the source template.
---

# Accept valid phase reviews when a default branch ref is stale

**Goal:** Use the nearest default-branch merge base when validating phase review receipts and resolving current-work tickets.

**Why:** A stale remote ref inflates the reviewed file claim and blocks valid phase advancement.

## Root Cause

Both `verify-stamp-claims.ts` and `resolve-verify-ticket.ts` selected the first existing ref from a remote-first list. With an older remote ref, the merge base moved behind local `main`, so the file claim included unrelated history. The phase gate discarded an otherwise approved receipt because its targets could not cover that inflated claim. A synthetic Git fixture with local `main` ahead of `origin/main` reproduced the stamp rejection before the fix; the reverse topology already passed, ruling out receipt parsing and review-kind matching.

The two callers now share a helper that evaluates each available default-branch ref and selects the merge base with the fewest commits to `HEAD`. Ties retain the existing ref priority. A fixture for each topology verifies the chosen work scope through the real stamp and gate path and through ticket resolution. A commit already present on a default ref is no longer branch-only work. If that ref reaches `HEAD` and no other implementation files remain, `review-receipt.ts` rejects the empty implementation claim; a prior stamp cannot clear the gate. If no default ref resolves, stamp verification returns an empty claim and ticket resolution asks for an explicit ticket, preserving fail-closed behavior.

## Work Log

- 2026-09-28T05:34:30.452Z Started: Created ticket YQXSDV
- 2026-09-28T05:35:00.000Z Found: Remote-first base selection inflated the review target claim; the new gate test failed before the fix.
- 2026-09-28T05:35:00.000Z Drafted: Shared nearest merge-base selection, schema registration, and both regression suites; targeted tests passed. The task remains in intake until its independent review accepts the scope.
- 2026-09-28T05:40:50.000Z Reviewed: Intake reviewer requested a negative gate case for divergent refs; added that case and included generated mirrors in scope.
