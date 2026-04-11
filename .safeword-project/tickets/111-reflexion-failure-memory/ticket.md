---
id: '111'
title: Reflexion-style structured failure memory for reminders
type: feature
phase: intake
created: 2026-04-11
parent: '109'
---

## Goal

Evolve the reminder layer (ticket #109) from static status lines to structured failure memory. When the agent makes a mistake (skips refactor, under-scopes, ignores a reminder), record the error-action-outcome triple. Future reminders reference past failures to be more specific and persuasive.

## The gap

Current reminders (proposed in #109): "TDD: GREEN. Next: refactor." Static, same every time.

With Reflexion: "TDD: GREEN. Next: refactor. (Last time you skipped refactor on scenario 1, the done gate blocked you and you had to backtrack — refactoring immediately is faster.)"

The reminder learns from the session. The agent's past mistakes inform future nudges.

## Research basis

Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning" (NeurIPS 2023, extended 2024). Agents that maintain explicit failure memory (structured error-action-outcome triples) outperform those with simple retry or static reminders. The mechanism: verbal reinforcement from past failures is more salient than generic instructions.

## Connection to #109

This is an enhancement to Layer 2 (reminders) in the three-layer enforcement model. The architecture doesn't change — natural gates and output validation stay the same. Only the reminder content gets smarter.

Connects to #109 open question: "Should reminders escalate in urgency if the agent repeatedly ignores them?"

## Questions to explore

- Where does the failure memory live? quality-state.json? A separate session artifact?
- How many past failures to retain? (Context budget concern)
- Should failures persist across sessions, or only within one session?
- Can the prompt hook read and inject failure memory without exceeding the ~150 token injection budget?
- Does this require a `prompt`-type hook (Haiku evaluates whether to include failure context)?

## Work Log

- 2026-04-11T22:54Z Created: Gap identified during research review of #109
