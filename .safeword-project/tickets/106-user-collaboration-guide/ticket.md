---
id: '106'
title: User guide for driving the explore-debate-steelman loop
type: feature
phase: intake
created: 2026-04-11
related: '105'
---

## Goal

Document the techniques users can use to get better output from the Safeword agent. Based on observed patterns from the ticket #100 design conversation where user-driven directives produced significantly better outcomes than the agent's default behavior.

## Key techniques observed

### 1. "Explore and debate our options"

Triggers the agent to research alternatives, generate options, and evaluate against criteria instead of jumping to the first solution.

### 2. Quality criteria framing

"What's most correct? What's most elegant? What's in line with the latest research? What's most ergonomic? Avoid bloat." Gives the agent explicit evaluation axes — more specific than "what's best?"

### 3. "Steelman it"

Asks the agent to attack its own proposal — find where it goes wrong. Most effective AFTER the agent has proposed, not before. Produces stronger proposals because flaws surface before the user has to find them.

### 4. "Show me examples" / "Walk me through it"

Forces abstract designs into concrete reality. Catches failures that only appear when you try to make the abstract specific.

### 5. "Capture this"

Tells the agent to persist decisions and reasoning before moving on. Prevents context loss and creates reviewable artifacts.

## Questions to explore

- Where does this guide live? (Safeword website? In-repo guide? Shown at session start?)
- Should these techniques be suggested to the user at natural moments? (e.g., after a complex proposal, hint: "you can ask me to steelman this")
- How do we teach without being patronizing to experienced users?
- Should Safeword's session-start hook mention these techniques?

## Origin

Observed during ticket #100 design conversation (2026-04-11). The user's directives followed a consistent pattern across 8+ design iterations that produced demonstrably better outcomes than the agent's default explore → propose cycle.

## Work Log

- 2026-04-11T15:33Z Created: Captured from ticket #100 open question #2
