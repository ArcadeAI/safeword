---
id: 152
type: task
phase: verify
status: in_progress
created: 2026-05-18T02:00:00Z
last_modified: 2026-05-18T05:06:00Z
scope: |
  Three audit-derived improvements to safeword's BDD flow plus one test-helper hardening:
  (1) /bdd nudge in prompt-questions intake reminder; (2) Rule grouping added to
  test-definitions canonical format with schema contracts; (3) planning-guide Part 2
  rewritten to teach canonical format with frontmatter gate + dimensions + declarative
  principle; (4) setupOrThrow helper unmasks silent test-fixture setup failures
  across 14 integration test files.
out_of_scope: |
  - Adding dimensions phase name to state machine (separate ticket if pursued)
  - Extending /verify+/audit gate to non-feature tickets (separate decision)
  - Rewriting Part 1 of planning-guide (user-story section is sound)
  - Fixing inline it()-block runCli setup calls (only beforeAll/beforeEach hardened)
done_when: |
  - All 4 commits land on branch (DONE: c03e8ea, 3532750, 6d8d383, 02f2bc0)
  - /verify reports tests pass, build clean, lint clean, dep drift clean
  - /audit reports no architectural regressions or dead code introduced
  - Schema contracts present in SAFEWORD_SCHEMA and pass release parity
---

# BDD Audit Follow-Ups + Test Helper Hardening

**Goal:** Resolve three gaps surfaced in an end-to-end BDD flow audit (planning-guide drift, no `/bdd` nudge, missing format contract) and a setup-failure-masking issue surfaced in the follow-on investigation.

**Why:** The BDD flow had four different formats described across template / skill / guide / runtime, no ergonomic nudge to enter `/bdd` for features, and a silent test-fixture failure mode that made `dist/cli.js` missing look like 49 unrelated test failures. Tightening these makes the BDD onramp coherent and makes test failures actionable.

## Work Log

- 2026-05-18T02:00:00Z Started: End-to-end BDD audit (skills + hooks + guides) via 3 parallel Explore agents
- 2026-05-18T02:25:00Z Found: Three format definitions diverged (template ≠ SCENARIOS.md ≠ planning-guide ≠ runtime)
- 2026-05-18T02:30:00Z Decided: Rule grouping (Gherkin 6+ + Example Mapping) is canonical; keep R/G/R sub-checkboxes per 2025 LLM-TDD research (arXiv 2604.26615); make G/W/T declarative not bloat
- 2026-05-18T02:35:00Z Complete: Patch #1 — `/bdd` nudge in prompt-questions intake reminder (refs: commit c03e8ea)
- 2026-05-18T02:40:00Z Complete: Task #2 — Rule grouping in test-definitions canonical format + schema contracts on template + scenario-format.ts (refs: commit 3532750)
- 2026-05-18T02:45:00Z Complete: Task #3 — planning-guide Part 2 rewritten with frontmatter gate, dimensions prereq, declarative principle; dropped 82 lines of contradictory legacy guidance (refs: commit 6d8d383)
- 2026-05-18T04:55:00Z Investigated: Pre-existing "test failures" flagged earlier — root cause was fresh worktree missing dist/cli.js, hidden by beforeAll swallowing runCli exit codes
- 2026-05-18T05:00:00Z Complete: Task #4 — setupOrThrow helper added to tests/helpers.ts; refactored 14 integration files (~50 call sites) to use it; loud actionable error replaces silent fixture failure (refs: commit 02f2bc0)
- 2026-05-18T05:06:00Z Started: /verify (lint ✓, build ✓, dep drift ✓, full test suite running in background); /audit pending
