---
id: QGHVXZ
slug: codex-commands-skills-vs-prompts
type: task
phase: intake
status: in_progress
epic: codex-changelog-alignment
relates_to: QM5G9M
---

# Decide Codex commands surface: skills vs deprecated custom prompts

**Goal:** Choose how to ship safeword's slash commands (`/bdd`, `/verify`, …) on Codex.

**Why:** Custom prompts (`~/.codex/prompts/*.md`) are **deprecated in favor of "skills"** (`skills.config`). Building on the deprecated surface would be immediate debt.

## Decision (call `/figure-it-out`)

- Lean: build as skills, not `~/.codex/prompts/`. Confirm the current skills format + `skills.config` semantics against live docs.
- Note: open issue #15941 reported prompts breaking on 0.117.0 — extra reason to avoid prompts.

## Done when

- Recorded decision (skills vs prompts) with rationale; one command ported as proof on the chosen surface.

## Source

developers.openai.com/codex/custom-prompts, config-reference (`skills.config`)

## Work Log

- 2026-05-31 Created from Codex research.
