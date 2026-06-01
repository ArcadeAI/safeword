---
id: CS86B0
slug: codify-spec-absorption
title: 'Codify-spec absorption: emit .feature + step_def stubs from test-definitions.md'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-one-merge
paired_with: JN39KG
created: 2026-05-24T21:27:52.680Z
last_modified: 2026-05-24T21:30:00.000Z
---

# Codify-spec absorption: emit .feature + step_def stubs

**Goal:** Add an optional safeword skill (working name `/codify` or `/emit-tests`) that reads a ticket's `test-definitions.md` and emits language-appropriate executable test stubs (e.g., `.feature` + pytest-bdd step defs for Python, or Vitest scenarios for TypeScript) that all fail with `NotImplementedError` / similar, providing a "N failing tests" progress metric throughout implementation.

**Why:** Safeword's TDD model writes one test at a time during each scenario's RED phase. Arcade's `/codify-spec` front-loads: all failing tests exist before any implementation. Both have value — front-loading gives a clear progress metric ("3/12 tests passing"), while interleaved keeps the focus tight. Making test-emission optional preserves the choice.

**Parent epic:** 0AWSY8
**Paired with:** JN39KG in arcade (decommission of /codify-spec)
**Depends on:** —

## Scope

- New skill: invocable on a ticket whose `phase` is `define-behavior`, `scenario-gate`, `decomposition`, or `implement` and has a `test-definitions.md` file with scenarios.
- Reads each `### Scenario:` block under each `## Rule:` and emits a corresponding executable test stub.
- Language-aware: at minimum support Python (pytest-bdd .feature + step_defs) and TypeScript (Vitest or playwright-bdd). Detect from project context (package.json, pyproject.toml, etc.).
- Test stubs fail with a clear "RED — not yet implemented" message (`NotImplementedError` in Python, `throw new Error("RED")` in TS).
- Emits to project-conventional location (`tests/features/<slug>.feature` + `tests/step_defs/test_<slug>.py` for Python; configurable per project via safeword config).
- After emission, runs the test runner and verifies all stubs fail RED. If any test passes, error: "test passes without implementation — investigate."
- Updates ticket frontmatter to add `codified_at: <timestamp>` (no phase change — codification is parallel to phase progression).
- Skill output: summary of N stubs emitted, file paths, all-failing confirmation.

## Out of scope

- Auto-implementing step definitions — stubs are skeletons; implementation happens in TDD Phase 6.
- Re-codifying after scenario edits (idempotent overwrite vs merge is a future ticket).
- Languages beyond Python and TypeScript in v1 — Go, Ruby, etc. as follow-ups.
- Hook integration — codify is opt-in via skill invocation, not auto-fired by phase transitions.

## Done when

- New skill exists in safeword templates (`packages/cli/templates/skills/codify/SKILL.md` or similar).
- Skill emits valid pytest-bdd output for a Python project (verified against a fixture).
- Skill emits valid Vitest output for a TypeScript project (verified against a fixture).
- Emitted stubs all fail RED on first run (verified).
- Documentation in SCENARIOS.md and the skill body shows when to invoke (between Phase 4 and Phase 5, optional).

## Open questions

- Skill name — `/codify`, `/emit-tests`, `/scaffold-tests`? Driver leans `/codify` (matches arcade's vocabulary).
- TypeScript test framework — Vitest or playwright-bdd? Project-detected, with sensible default.
- Idempotency on re-emission — overwrite, merge, refuse? Driver leans refuse-if-exists (user must delete first, prevents accidental overwrite of impl).

## Work Log

- 2026-05-24T21:27:52.680Z Started: Created ticket CS86B0
- 2026-05-24T21:30:00.000Z Drafted: Scope, language coverage, RED verification, 3 open questions; linked to epic 0AWSY8
