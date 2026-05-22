---
id: '170'
slug: propulsive-by-default
title: 'Epic: Propulsive by default'
type: Feature
status: open
epic: propulsive-by-default
---

# Epic: Propulsive by default

**Type:** Feature (epic — shell, not yet scoped)

**Goal:** Claude keeps moving unless something is genuinely blocking. Today the model pauses at every seam — sizing announcement, before building, between phases, after every test run. Propulsive means: reversible / low-blast-radius decisions get made silently; only irreversible or high-stakes ones stop the loop.

**Context:** Safeword today optimizes for control and visibility at the cost of momentum. Most pauses are wasted — the user would have said "yes, keep going." The blocker filter should be sharp: destructive git, irreversible writes, money/billing, security, or a genuine ambiguity that materially changes scope.

## Open questions (to resolve when this epic is Clarified)

- Heuristic for "propulsive vs. ask": file count + persistence + destructiveness + external side effects? Codified where?
- Config knob (`autonomy: high | medium | low`) or single new default?
- Operational definition of "critical question" — irreversible writes, money, destructive git, security, anything else?
- Does this change the phase gates, or layer on top of them?
- How does the model recover gracefully when it pushed through something it shouldn't have?

## Child tickets

_(none yet — fan out after this epic is Clarified)_
