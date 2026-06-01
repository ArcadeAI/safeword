---
id: J4BTMT
slug: monitor-llm-triage
type: task
phase: intake
status: in_progress
epic: upstream-changelog-monitor
relates_to: TT1MQW
---

# Phase 2 (optional): LLM pre-triage of diffs by safeword relevance

**Goal:** Optionally add an LLM step that pre-labels each diff entry by safeword relevance (Breaks/Adopt/Watch + which surface), as a _draft_ in the issue.

**Why:** Speeds triage — but only as a draft a human verifies. This thread showed LLM triage can get load-bearing facts wrong, so it must never be the gate.

## Guardrails (non-negotiable)

- Output is clearly marked DRAFT / unverified; a human confirms before any ticket is filed.
- Never auto-files tickets or PRs from the LLM labels.
- Pin model + keep the prompt in-repo for auditability; cite the doc line behind each "Breaks" claim so a human can check it.

## Done when

- Issues carry an optional draft triage table; humans still confirm; no auto-filing.
- Decision recorded on whether the cost/value justifies keeping it on.

## Out of scope

- Autonomous ticket/PR creation from LLM output.

## Work Log

- 2026-05-31 Created from monitor epic as a deliberately-additive phase 2.
