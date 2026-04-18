---
name: project-learnings
description: Project-specific engineering lessons recorded during this codebase's development. Topics: agent TDD, verification, enforcement layers; Anthropic 2026 research, trustworthy agents, harness design; Claude Code 2.1.80-2.1.101 changelog, plugins; Claude 4 example-following, examples override rules; skill file conciseness, step count, list ordering; hook fire counts, friction analysis, dogfood session; CLAUDE.md import conflicts, safeword self-upgrade; E2E zombie processes, port conflicts, cleanup; instruction placement, attention decay; ESLint for AI agents, security plugins, additive presets; natural vs self-report gates, physics-not-policy; post-tool lint, auto-fix vs error vs warn, retry loops; procedural instruction degradation, tell WHAT not HOW; propose-and-converge pattern, agent UX, ideation; skill description writing, auto-triggering, trigger phrases; YAML failsafe schema, quality-state.json, ticket hierarchy. Read the matching file before related work to avoid re-making previously-solved mistakes.
user-invocable: false
---

# Project Learnings

Match your current task to a topic, then read the matching file for full context:

- **AI Agent Behavior Research** — agent TDD, verification, enforcement layers.
  → .safeword-project/learnings/agent-behavior-research.md
- **Anthropic Research & Engineering: Feb-Apr 2026** — Anthropic 2026 research, trustworthy agents, harness design.
  → .safeword-project/learnings/anthropic-research-feb-apr-2026.md
- **Claude Code Changelog: Feb-Apr 2026** — Claude Code 2.1.80-2.1.101 changelog, plugins.
  → .safeword-project/learnings/claude-code-changelog-feb-apr-2026.md
- **Claude 4: Examples Are the Strongest Compliance Signal** — Claude 4 example-following, examples override rules.
  → .safeword-project/learnings/claude4-examples-override-rules.md
- **Concise Over Verbose for Skill File Instructions (Not Prose Over Lists)** — skill file conciseness, step count, list ordering.
  → .safeword-project/learnings/claude4-prose-over-lists.md
- **Dogfooding: Enforcement Redesign Session (April 2026)** — hook fire counts, friction analysis, dogfood session.
  → .safeword-project/learnings/dogfooding-enforcement-session.md
- **Dogfooding Gotchas** — CLAUDE.md import conflicts, safeword self-upgrade.
  → .safeword-project/learnings/dogfooding-gotchas.md
- **E2E Test Zombie Processes** — E2E zombie processes, port conflicts, cleanup.
  → .safeword-project/learnings/e2e-test-zombie-processes.md
- **Instruction Attention Hierarchy: Where to Put Critical Rules** — instruction placement, attention decay.
  → .safeword-project/learnings/instruction-attention-hierarchy.md
- **LLM Coding Agents and Linting: Research Summary (December 2025)** — ESLint for AI agents, security plugins, additive presets.
  → .safeword-project/learnings/llm-coding-agents-linting.md
- **Natural Gates vs Self-Report Gates** — natural vs self-report gates, physics-not-policy.
  → .safeword-project/learnings/natural-vs-self-report-gates.md
- **Post-Tool Linting Strategies for AI Coding Assistants** — post-tool lint, auto-fix vs error vs warn, retry loops.
  → .safeword-project/learnings/post-tool-linting-strategies.md
- **Verbose Procedural Gates Degrade Performance (Generalizes Beyond TDD)** — procedural instruction degradation, tell WHAT not HOW.
  → .safeword-project/learnings/procedural-gates-generalize-beyond-tdd.md
- **Propose-and-Converge: Research Principles** — propose-and-converge pattern, agent UX, ideation.
  → .safeword-project/learnings/propose-and-converge-research.md
- **Skill Description Design** — skill description writing, auto-triggering, trigger phrases.
  → .safeword-project/learnings/skill-description-design.md
- **YAML Parsing & Quality Gates: Learnings from Ticket 025** — YAML failsafe schema, quality-state.json, ticket hierarchy.
  → .safeword-project/learnings/yaml-and-quality-gates.md
