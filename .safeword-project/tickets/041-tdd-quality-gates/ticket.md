---
id: 041
type: feature
phase: intake
status: in_progress
created: 2026-03-19T15:55:00Z
last_modified: 2026-03-19T16:36:00Z
---

# TDD Inner-Loop Quality Gates

**Goal:** Add quality review gates at each TDD sub-phase boundary (RED, GREEN, REFACTOR) so that work is reviewed before transitioning to the next step.

**Why:** The current system only gates BDD phase transitions (intake → implement → done). Within the `implement` phase, only the refactor gate enforces discipline after `feat:` commits. There's no review at RED→GREEN or REFACTOR→next-RED boundaries, and the detection mechanism (commit message prefixes) is convention-based and bypassable.

## Work Log

- 2026-03-19T16:36:00Z Started: Creating spec from research session
- 2026-03-19T16:25:00Z Research: Explored file-path detection, test-result detection, TDD Guard patterns, Claude Code hook capabilities
- 2026-03-19T16:12:00Z Committed: Phase gate `/quality-review` instruction (66025ea) — needs `additionalContext` fix
- 2026-03-19T15:55:00Z Started: Research into quality review at phase transitions

---
