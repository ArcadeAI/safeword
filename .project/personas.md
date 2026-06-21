# Personas

<!--
Project source of truth for who safeword serves. Every spec, JTBD, and
scenario references these by name or short code; `safeword check` surfaces
unknown references as questions. Format and short-code rules:
packages/cli/templates/personas-template.md.
-->

## Agent-Driven Developer (DEV)

**Role:** A developer who runs an AI coding agent (Claude Code, Cursor, or Codex) on a real project and installs safeword to keep that agent test-first, design-validated, and consistent.

**Context:** Stack-agnostic and harness-agnostic — safeword is a process layer, not a framework opinion, so this persona ships Next, Django, Gin, anything across Claude Code, Cursor, or Codex. Doesn't want to learn safeword's internals; expects it to feel like an experienced teammate that "just does things well." Guardrails fire only during agent sessions, never blocking their own hand-written commits. Drives the agent across many sessions and leans on tickets, gates, and BDD/TDD to stay oriented and to get unblocked when a gate fires. Can read the diff and unblock themselves with technical reasoning when a gate fires.

## Agent-Driven Builder (ADB)

**Role:** Someone who ships software by directing an AI coding agent but doesn't read or write the code themselves — leans entirely on safeword's guardrails to keep the agent honest.

**Context:** Founders, PMs, designers, and domain experts — likely the larger audience. Harness-agnostic: drives Claude Code, Cursor, or Codex in natural language. Judges success by whether the feature works and is safe, not by code quality they can inspect, because they can't audit the diff. When a gate fires, needs a plain-language explanation and a concrete next action — internal jargon ("RED phase", "type narrowing") is a dead end. Safeword's value is highest here: it is the only thing standing between them and an agent that confidently ships broken or unsafe code.

## Safeword Maintainer (SM)

**Role:** A contributor who builds and extends safeword itself — authoring hooks, gates, skills, and enforcement rules in this repo.

**Context:** Works in the safeword repo, which dogfoods safeword, so a Maintainer is always also a DEV in their own sessions. Needs enforcement defined in one declarative place rather than scattered through TypeScript, and needs to trust and verify the rule set before it ships and fires on real projects.
