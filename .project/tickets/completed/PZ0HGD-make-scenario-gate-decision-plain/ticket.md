---
id: PZ0HGD
slug: make-scenario-gate-decision-plain
type: task
phase: done
status: done
created: 2026-08-03T01:27:28.736Z
last_modified: 2026-08-03T05:57:32Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1802
---

# Make the scenario gate decision plain

**Goal:** Let users decide whether scenarios are complete without learning internal BDD terminology.

**Why:** The current BDD flow asks about saturation at a user approval boundary without explaining the decision.

**Type:** Improvement

**Scope:** Replace “scenario saturation” and “coverage saturation” at the two user decision points with direct questions about whether intended behavior and important boundaries are fully described.

**Out of Scope:** Changing scenario generation, review criteria, phase transitions, or internal coverage algorithms.

**Done When:**

- [x] Claude, Cursor, and Codex BDD guidance asks the completeness decision in plain language.
- [x] The user-facing decision no longer requires the term “saturation.”

**Tests:**

- [x] Contract test verifies the canonical, dogfood, Claude, and Codex scenario guides use the same plain decision questions.

## Work Log

- 2026-08-03T01:27:28.736Z Started: Created ticket PZ0HGD
- 2026-08-03T01:28:00Z Revalidated: Current main still exposes “scenario saturation” and “coverage saturation” at both user approval points across all shipped BDD surfaces.
- 2026-08-03T01:28:00Z Planned: Replace the jargon at the decision points only; preserve the underlying convergence and gate behavior.
- 2026-08-03T01:31:00Z RED: A direct four-surface content assertion failed because neither completeness question existed.
- 2026-08-03T01:31:00Z Implemented: Replaced both saturation headings and terse exit language with explicit questions about intended behavior and important boundaries across canonical, dogfood, Claude, and Codex guides.
- 2026-08-03T02:05:00Z Verified: The four-surface contract test rejects all remaining saturation terminology and passes; lint, typecheck, formatting, and diff checks pass. Fresh quality review approved the change with no critical findings.
- 2026-08-03T05:41:11Z Closeout review: Revalidated live issue #1802 against current main. Found and fixed a missed native Claude plugin copy, regenerated its inventory and identity, and expanded parity coverage to five shipped guide surfaces. Fresh independent quality review APPROVED with no critical issues. Refactored the regression test from a brittle whole-document terminology ban to the exact retired decision headings and prompt. Full verification, current v0.72.0 release checks, and diff-scoped audit pass. Advanced to verify pending user confirmation.
- 2026-08-03T05:57:32Z Completed: User authorized closeout. Final release-config verification passed 5/5, all review and refactor suggestions are incorporated, and the ticket is ready to ship through the closing pull request.
