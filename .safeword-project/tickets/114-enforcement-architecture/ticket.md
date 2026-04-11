---
id: '114'
title: Enforcement architecture — natural gates + reminders, remove hard blocks
type: feature
phase: intake
created: 2026-04-11
parent: '109'
---

## Goal

Replace hard-blocking enforcement (pre-tool denies edits during planning phases) with natural gates + prompt hook reminders. The core architectural change in the #109 epic.

## Changes (must be done together — coupled)

### pre-tool-quality.ts (~180 → ~70 lines)

**Remove:**

- Phase access control (PLANNING_PHASES blocking)
- TDD step gates (tdd:\* blocking)
- Phase transition gates (phase:\* blocking)

**Keep:**

- LOC gate (blast radius control)
- META_PATHS exemption

**Add:**

- Artifact prerequisite check: if target is test-definitions.md, validate ticket.md has Scope/Out of Scope/Done When sections (~20 lines)

### post-tool-quality.ts

**Keep as-is:** Phase/TDD/LOC detection logic unchanged.

**Change:** Stop setting `state.gate` for TDD and phase transitions. Only set `state.gate = 'loc'`. Update `lastKnownPhase` and `lastKnownTddStep` for prompt hook consumption.

### prompt-questions.ts (~18 → ~40 lines)

**Keep:** Current two lines.

**Add:** Read quality-state.json. If active ticket with known phase/step, inject one-line phase-aware reminder. Constraint: compressed cognitive state, ~150 tokens total.

### SAFEWORD.md

Update enforcement description. Remove "edits blocked during planning phases." Add: "Safeword tracks your phase and TDD step, reminding you each turn. The done gate requires evidence."

## Three-layer model

1. **Natural gates** — artifact dependencies (3 inherent + 1 hook-enforced)
2. **Reminders** — prompt hook injects phase/step state each turn
3. **Output validation** — done gate hard blocks until evidence

## Research basis

See `.safeword-project/learnings/agent-behavior-research.md`

Design principle: Control for what models won't improve at (process adherence). Lean into what they will (code quality).

## Work Log

- 2026-04-11T23:17Z Created: Extracted from #109 epic (Group 1)
