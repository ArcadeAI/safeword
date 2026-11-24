# Unified BDD+TDD Workflow (Inline TDD in BDD Skill)

**Status:** Accepted
**Date:** 2026-01-07

**What.** The BDD implementation phase runs TDD (RED→GREEN→REFACTOR) directly.

**Why.** An agent can forget to invoke a delegated skill.

**Trade-off.** The BDD skill grew. Safeword removed the standalone TDD skill and the `/tdd` command.

**Alternatives.** Separate TDD skill with handoff (rejected: soft enforcement), subagent delegation (rejected: model-mediated depth and tool availability do not guarantee the workflow handoff)

**Implementation.** `packages/cli/templates/skills/bdd/` — TDD runs in the `implement` phase (`TDD.md`); the skill was later split from one `SKILL.md` into per-phase files (DISCOVERY / SCENARIOS / TDD / VERIFY / DONE / SPLITTING), see the 2026-05-31 [Phase 0 decision](product-framing-layer-in-bdd-phase-0-jtbd--personas--rules.md).
