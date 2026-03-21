---
id: '049'
slug: stop-hook-quality-improvements
type: epic
status: in_progress
phase: implement
children:
  - 049a-suppressoutput-silent-hooks
  - 049b-reframe-softblock-comments
  - 049c-scope-evidence-to-bash-output
  - 049d-hook-runs-tests-directly
  - 049e-gate-testdefs-content
  - 049f-haiku-judge-soft-block
---

# Stop Hook Quality Gate Improvements

**Goal:** Progressively strengthen the stop hook system based on research into Claude Code hook mechanics, LLM self-correction literature, and Goodhart's Law failure modes.

## Context

Research conducted 2026-03-21. See `.safeword-project/guides/stop-hook-research.md` for full analysis. Known issues tracked in `.safeword-project/known-issues.md`.

Ticket 048 (done) already switched `hardBlockDone` to canonical JSON block mechanism.

## Children (force-ranked by impact/effort)

| ID   | Ticket                           | Type  | Impact                        | Effort  |
| ---- | -------------------------------- | ----- | ----------------------------- | ------- |
| 049a | suppressOutput on silent hooks   | patch | Low (noise reduction)         | Trivial |
| 049b | Reframe soft block comments      | patch | Clarity only                  | Trivial |
| 049c | Scope evidence to Bash output    | task  | High (closes Goodhart gap)    | Medium  |
| 049d | Hook runs tests directly         | task  | High (external feedback loop) | Medium  |
| 049e | Gate on test-definitions content | task  | Medium                        | Medium  |
| 049f | Haiku as judge for soft block    | task  | High (real soft enforcement)  | Large   |

## Work Log

- 2026-03-21 Epic created from stop-hook research session. 048 already done (exit2→JSON block).
