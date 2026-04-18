---
name: project-learnings
description: Project-specific engineering lessons recorded during this codebase's development. Topics: TDD for agents, verification patterns, enforcement layers, context overload, instruction design, test scope, task decomposition, scenario validation; Agent trustworthiness, harness design, auto mode, long-running agents, and model evaluation research relevant to Safeword's enforcement and workflow design; Hook changes, permission updates, agent workflow improvements, autonomy features, plugin system, and performance fixes from Claude Code v2.1.80-2.1.101; Examples as compliance signal in skill files, turn examples over abstract rules, Claude 4 example-following behavior, shortcut-demonstration risk; Skill file instruction verbosity, conciseness over format, ordered vs unordered lists, procedural step count, fewer steps over more ceremony…. Read the matching file before related work to avoid re-making previously-solved mistakes.
user-invocable: false
---

# Project Learnings

Match your current task to a topic, then read the matching file for full context:

- **AI Agent Behavior Research** — TDD for agents, verification patterns, enforcement layers, context overload, instruction design, test scope, task decomposition, scenario validation.
  → .safeword-project/learnings/agent-behavior-research.md
- **Anthropic Research & Engineering: Feb-Apr 2026** — Agent trustworthiness, harness design, auto mode, long-running agents, and model evaluation research relevant to Safeword's enforcement and workflow design.
  → .safeword-project/learnings/anthropic-research-feb-apr-2026.md
- **Claude Code Changelog: Feb-Apr 2026** — Hook changes, permission updates, agent workflow improvements, autonomy features, plugin system, and performance fixes from Claude Code v2.1.80-2.1.101.
  → .safeword-project/learnings/claude-code-changelog-feb-apr-2026.md
- **Claude 4: Examples Are the Strongest Compliance Signal** — Examples as compliance signal in skill files, turn examples over abstract rules, Claude 4 example-following behavior, shortcut-demonstration risk.
  → .safeword-project/learnings/claude4-examples-override-rules.md
- **Concise Over Verbose for Skill File Instructions (Not Prose Over Lists)** — Skill file instruction verbosity, conciseness over format, ordered vs unordered lists, procedural step count, fewer steps over more ceremony.
  → .safeword-project/learnings/claude4-prose-over-lists.md
- **Dogfooding: Enforcement Redesign Session (April 2026)** — Real hook fire counts, friction analysis, what caught bugs vs what was noise, during a 30+ commit session implementing tickets #113 and #114.
  → .safeword-project/learnings/dogfooding-enforcement-session.md
- **Dogfooding Gotchas** — CLAUDE.md import pattern conflicts when running safeword upgrade on the safeword repo itself.
  → .safeword-project/learnings/dogfooding-gotchas.md
- **E2E Test Zombie Processes** — zombie process prevention in E2E tests, sequential execution enforcement, cleanup scripts.
  → .safeword-project/learnings/e2e-test-zombie-processes.md
- **Instruction Attention Hierarchy: Where to Put Critical Rules** — Instruction placement in prompt hooks vs skill files, attention decay, cross-file delegation compliance rates, lost-in-the-middle effect, critical rule positioning.
  → .safeword-project/learnings/instruction-attention-hierarchy.md
- **LLM Coding Agents and Linting: Research Summary (December 2025)** — ESLint configuration for AI agents, security plugins, additive preset architecture, auto-fix strategies.
  → .safeword-project/learnings/llm-coding-agents-linting.md
- **Natural Gates vs Self-Report Gates** — Enforcement gate design for agents, natural gates vs self-report gates, physics-not-policy, artifact prerequisites, LOC threshold gates.
  → .safeword-project/learnings/natural-vs-self-report-gates.md
- **Post-Tool Linting Strategies for AI Coding Assistants** — auto-fix vs error vs warn strategies, feedback loops, retry prevention, multi-language lint orchestration.
  → .safeword-project/learnings/post-tool-linting-strategies.md
- **Verbose Procedural Gates Degrade Performance (Generalizes Beyond TDD)** — Verbose procedural instruction degradation beyond TDD, hard gates for safety vs quality, tell WHAT not HOW, procedural checklist performance.
  → .safeword-project/learnings/procedural-gates-generalize-beyond-tdd.md
- **Propose-and-Converge: Research Principles** — Propose-and-converge interaction pattern, HCI research for AI agent UX, pair programming literature, Anthropic autonomy principles, ideation phase design.
  → .safeword-project/learnings/propose-and-converge-research.md
- **Skill Description Design** — How to write Claude Code skill descriptions for reliable auto-triggering. Discovered during ideation skill design (April 2026).
  → .safeword-project/learnings/skill-description-design.md
- **YAML Parsing & Quality Gates: Learnings from Ticket 025** — YAML failsafe schema for preserving leading-zero IDs, quality-state.json gotchas, ticket hierarchy navigation edge cases.
  → .safeword-project/learnings/yaml-and-quality-gates.md
