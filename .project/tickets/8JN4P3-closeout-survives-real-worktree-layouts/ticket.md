---
id: 8JN4P3
slug: closeout-survives-real-worktree-layouts
type: patch
phase: done
status: done
created: 2026-08-03T21:25:54.248Z
last_modified: 2026-08-03T22:40:50.000Z
---

# Keep safe closeout working across real worktree layouts

**Goal:** Let authenticated closeout finish after a session moves worktrees and when the primary worktree is detached.

**Why:** Dogfooding merged closeout exposed issues #1849 and #1850, leaving clean merged branches impossible to remove through the safety guard.

**Scope:** Resolve upstream issues #1849 and #1850 without weakening exact session, project, pull-request, branch, or worktree identity checks.

**Done when:** A bound session may start in another or subsequently removed linked worktree; cleanup uses exactly one checkout of the observed default branch even when Git's primary worktree is detached; adversarial identity tests and the complete verification suite pass.

## Work Log

- 2026-08-03T21:25:54.248Z Started: Created ticket 8JN4P3
- 2026-08-03T21:34:00.000Z Decided: Keep the authenticated hook project binding and exact transcript session ID as the identity boundary; treat transcript cwd as non-authoritative start metadata. Select the unique observed default-branch checkout as the surviving cleanup worktree while preserving the primary-worktree deletion guard.
- 2026-08-03T21:44:00.000Z Reviewed: Cross-agent quality review requested explicit observation-boundary and three-surface parity proof. Added PR identity, protection resolution, canonical script parity, real detached-primary Git, and primary-target preservation tests; included the existing host-adapter orchestration suite in re-review evidence.
- 2026-08-03T21:48:00.000Z Preserved evidence: The original 58-row manual review remains bound to the commit that introduced its manifest; before first commit the gate still hashes the working tree, and afterward it verifies the sealed commit is an ancestor and hashes reviewed blobs there. Follow-up patches no longer rewrite historical reviewer verdicts.
- 2026-08-03T22:03:00.000Z Reviewed: Final cross-agent quality review approved the complete delta with no correctness or security defects.
- 2026-08-03T22:12:00.000Z Corrected generated evidence: Full verification exposed the stale Claude plugin inventory digest for the changed closeout script. Regenerated `plugin/inventory.json` and `plugin/identity.json`; the focused dispatcher and 278-scenario Gherkin regression lanes then passed.
- 2026-08-03T22:40:50.000Z Verified: Full verification passed 6,473 tests with 5 skips, 826 Gherkin scenarios with 3 skips, build, lint, typecheck, and dependency audit. Diff-scoped audit found no errors or warnings.
- 2026-08-03T22:53:00.000Z Corrected CI evidence: Node 24 proved the default depth-1 PR checkout could not read the historical review snapshot. Kept the seal strict and configured test jobs to fetch Git history so they hash the actual reviewed ancestor blobs.
