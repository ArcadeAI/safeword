# Skill Consolidation (Removed Redundant Skills)

**Status:** Accepted
**Date:** 2026-01-09

**What.** BDD took over the standalone TDD, brainstorming, and writing-plans workflows. Today a [standalone brainstorm skill](../../packages/cli/templates/skills/brainstorm/SKILL.md) supports exploration. The [inline TDD decision](unified-bddtdd-workflow-inline-tdd-in-bdd-skill.md) explains the retained workflow.

**Why.** At the time, BDD discovery covered brainstorming, Phase 6 included full TDD, and Claude Code supplied native plan mode.

**Trade-off.** Users had fewer individual skills to invoke. BDD owns the integrated feature workflow.

**Removed.** `safeword-tdd-enforcing`, `safeword-brainstorming`, `safeword-writing-plans` skills; `/tdd` command

**Remaining.** Source in `packages/cli/templates/skills/`; Claude Code ships them from generated `plugin/skills/`, Codex from generated `packages/cli/codex-plugin/skills/`

**Implementation.** Deprecated files listed in `packages/cli/src/schema.ts` deprecatedFiles/deprecatedDirs
