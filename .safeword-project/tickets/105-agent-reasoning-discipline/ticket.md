---
id: '105'
title: Agent reasoning discipline — explore-debate before proposing
type: feature
phase: intake
created: 2026-04-11
related: '100'
---

## Goal

Encode a reasoning discipline where the agent researches options and evaluates them against quality criteria before presenting a proposal to the user. Applies across all phases — not just intake, but decomposition, architecture decisions, implementation choices, refactoring approaches.

## The pattern

Before proposing a significant decision, the agent should:

1. **Explore:** Research 2-3 options (codebase patterns, documentation, web research if available)
2. **Debate:** Evaluate options against criteria — what's most correct, elegant, aligned with latest practices, no bloat
3. **Propose:** Pick one, state why, show what was considered

This is NOT steelmanning (self-attack). That's a separate concern — risky when done solo (fox-henhouse problem), effective when user-driven. The explore-debate step is due diligence, not adversarial.

## When it applies (proportional)

- **Trivial decision** (variable name, formatting): Agent picks, moves on. No loop.
- **Moderate decision** (test pattern, library choice): Agent states choice with one-line rationale.
- **Significant decision** (architecture, data model, interaction pattern, process design): Full explore-debate-propose.

## Relationship to other tickets

- **#100 (propose-and-converge):** Understanding what to build. User-facing.
- **#101 (hook text):** What the hooks inject. Plumbing.
- **#105 (this):** How the agent reasons before proposing. Internal discipline.
- **#106 (user guide):** Teaching users how to drive the loop (including steelmanning).

## The steelman question

Steelmanning (self-attack) is most effective when the user drives it ("steelman this"). When the agent does it solo, it may be performative — same mind, same blind spots. But the lightweight version ("state the one thing most likely to be wrong and verify it") is worth exploring as a quality gate instruction. See ticket #101 for stop hook changes.

## Origin

Observed during ticket #100 design conversation (2026-04-11): the explore-debate-steelman loop, driven by the user, produced significantly better design outcomes across 8+ iterations. The explore-debate portion is safe to encode as agent behavior. The steelman portion works best as a user-driven technique.

## Work Log

- 2026-04-11T15:33Z Created: Captured from ticket #100 open question #2
