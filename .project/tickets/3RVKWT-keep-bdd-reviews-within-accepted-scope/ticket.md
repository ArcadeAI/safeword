---
id: 3RVKWT
slug: keep-bdd-reviews-within-accepted-scope
type: task
phase: done
status: done
scope:
  - Clarify scenario-gate finding disposition so only in-scope must-fix defects are applied automatically
  - Pin the rule across shipped BDD guidance surfaces
out_of_scope:
  - Pass budgets, scenario-count caps, new hooks, reviewer schema changes, or changes to quality-review
done_when:
  - BDD guidance applies blockers only when they identify a concrete false pass against accepted behavior
  - Warnings and scope-expanding proposals cannot silently become new scenario requirements
external_issue: https://github.com/ArcadeAI/safeword/issues/2661
created: 2026-09-07T14:45:22.472Z
last_modified: 2026-09-08T00:23:00.000Z
---

# Keep BDD reviews within accepted scope

**Goal:** Prevent optional scenario-review suggestions from silently becoming new requirements

**Why:** Repeated scenario-gate passes can turn non-blocking hardening ideas into normative scope, causing scenario bloat and further blockers

**Type:** Improvement

**Tests:**

- [x] A cross-surface contract test rejects BDD guidance that treats warnings as required work.
- [x] The same test requires scope-expanding findings to return to the user as decisions.

## Work Log

- 2026-09-07T14:45:22.472Z Started: Created ticket 3RVKWT
- 2026-09-07T14:46:00Z Scoped: Reused GitHub issue #2661; limited the fix to BDD finding triage plus one parity contract test.
- 2026-09-07T14:48:00Z RED: The new contract failed on all five shipped BDD guidance surfaces.
- 2026-09-07T14:49:00Z GREEN: Added one scenario-gate triage paragraph and regenerated existing mirrors; 22 focused tests, 22 adjacent release contracts, and all 263 parity pairs plus 8 contracts pass.
- 2026-09-07T15:06:00Z VERIFY: Focused and release-contract tests, parity, lint, formatting, pinned generator checks, and configured typechecks pass. Full BDD/build verification is locally limited by loopback-binding restrictions, npm cache ownership, fixture dependency installation, and a missing native website dependency; keeping the pull request Draft.
- 2026-09-07T22:43:00Z CI repair: Both Node lanes exposed the six expected Codex/Cursor lifecycle tree snapshots omitted after the BDD template changed. Regenerated only those hashes; the lifecycle and scope contracts pass 35/35.
- 2026-09-08T00:23:00Z Done: Exact-head CI passed 11 checks across both Node lanes, including the Cucumber acceptance lane; advisory review completed with no actionable finding.
