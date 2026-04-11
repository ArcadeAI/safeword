---
id: '115'
title: Stop hook improvements — structural scenario verification + simplified review
type: feature
phase: intake
created: 2026-04-11
parent: '109'
related: '101'
---

## Goal

Two improvements to stop-quality.ts. Independent of the enforcement architecture changes (#114).

## Changes

### Scenario evidence: text matching → direct file reading

**Current:** Matches "All N scenarios marked complete" in agent's prose (`SCENARIO_EVIDENCE_PATTERN`). Fragile — SWE-bench found agents claim success ~40% more often than tests confirm.

**Proposed:** Parse test-definitions.md directly. Count `[x]` vs `[ ]` checkboxes. Verify all are checked. ~15 lines. Same structural reliability as running the test suite — "physics, not policy."

### Simplify non-done quality review

**Current:** Generic "double check everything" prompt on every stop after edits. Fires too frequently. The same prompt regardless of what changed.

**Proposed:** Phase-specific, less frequent. Overlaps with ticket #101 scope. Options explored in #101: phase-boundary only, LOC-gated, contribute-then-probe, Claude Code Review as adversarial reviewer.

### Audit evidence (future improvement)

Keep as text matching ("Audit passed") for now. Audit produces qualitative assessment, not binary output. Future: audit could write structured result file for direct reading.

## Research basis

- SWE-bench: agents claim success ~40% more than tests confirm (text matching is fragile)
- SWE-agent, Devin: verify by reading artifacts directly, not parsing prose
- Anthropic tool-use guidance: verify state by reading files/APIs, not agent prose

See `.safeword-project/learnings/agent-behavior-research.md`

## Work Log

- 2026-04-11T23:17Z Created: Extracted from #109 epic (Group 2)
