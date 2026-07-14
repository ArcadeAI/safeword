---
id: A8NNZV
slug: prevent-retro-duplicate-issues
type: feature
phase: define-behavior
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1032
phase_anchors:
  - "define-behavior: a014e3c4c0460ed03e2d227d006368ef402c147c"
scope: Add a deterministic canonical marker derived from normalized repro evidence; write it to new CLI-filed issue bodies; search exact legacy signature before the exact canonical marker; update the matched issue's occurrence ledger.
out_of_scope: Spool/agent-filer parity, fuzzy or related-issue matching, automatic issue closure, and changing dedupe for legacy issues that lack a canonical marker.
done_when: A recurrence whose title, category, and surface differ but whose canonical repro identity matches updates the existing issue ledger; legacy signature-only issues still dedupe; unmatched or only-fuzzy candidates create a new issue.
created: 2026-07-14T04:36:28.727Z
last_modified: 2026-07-14T04:36:28.727Z
---

# Prevent repeated retro findings from opening duplicate issues

**Goal:** Match recurring retro findings to their canonical GitHub issue despite model-derived metadata drift.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-14T04:36:28.727Z Started: Created ticket A8NNZV
- 2026-07-14T04:38:00Z Found: #1032 limits this slice to CLI triage; #1031 owns spooled filing and #1034 owns fuzzy related-link behavior.
- 2026-07-14T04:38:00Z Decided: Candidate canonical identity is code-owned normalization and hashing of the command-oriented repro field, excluding title/category/surface; exact markers remain the only merge authority.
- 2026-07-14T04:45:43Z Confirmed: User accepted exact normalized repro as the canonical identity source.
- 2026-07-14T04:46:30Z Started behavior definition: translating the approved canonical-marker contract into executable scenarios.
