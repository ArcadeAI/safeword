---
id: '171'
slug: subagents-in-the-loop
title: 'Epic: Subagents in the safeword loop'
type: Feature
status: open
epic: subagents-in-the-loop
---

# Epic: Subagents in the safeword loop

**Type:** Feature (epic — shell, not yet scoped)

**Goal:** Identify where delegating to a subagent dominates inline work, and wire it into the safeword workflow. Today Plan / Explore / general-purpose agents exist but aren't referenced in the prescribed phases — they're used opportunistically, not by design.

**Context:** Likely starting points: Explore for research-before-Clarify, an independent reviewer after GREEN (already partly served by `quality-review`), parallel test runs on large features, BDD scenario drafting. Output is probably a decision table in CLAUDE.md plus one or two new safeword-specific subagent definitions.

## Open questions (to resolve when this epic is Clarified)

- Pick from the existing agent menu (Explore / Plan / general-purpose / quality-review), or define new safeword-specific ones (e.g., `bdd-scenario-writer`, `failure-investigator`)?
- Are subagents triggered by hooks (automatic) or by skills (opt-in)?
- How do we keep parent-agent context coherent when a subagent runs — what's the handoff contract?
- Which phases get hard-wired delegation vs. left to the model's discretion?
- Cost / latency budget — when does a subagent dominate, and when is it overhead?

## Child tickets

_(none yet — fan out after this epic is Clarified)_
