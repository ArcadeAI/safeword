---
id: 5AXPHR
slug: align-gherkin-source-instructions
type: task
phase: intake
status: in_progress
epic: bdd-phase-two-merge
relates_to: 1DT29X
created: 2026-06-13T23:12:16.963Z
last_modified: 2026-06-13T23:12:16.963Z
scope:
  - Replace stale scenario-name lineage wording with `.feature` lineage-tag wording in SAFEWORD and BDD discovery instructions.
  - Update ticket-system docs so `test-definitions.md` is described as the R/G/R ledger, not the Given/When/Then scenario source.
  - Update the customer starter `safeword-lane.feature` so new work is authored directly in `.feature` files, with `codify --format gherkin` framed as a legacy migration aid.
  - Keep source templates and dogfooded installed copies aligned across `packages/cli/templates/`, `.safeword/`, `.agents/`, and `.claude/`.
out_of_scope:
  - Removing legacy markdown scenario parsing.
  - Adding a hard gate that requires `.feature` files for every feature ticket.
  - Migrating historical tickets from markdown scenario titles to Gherkin tags.
  - Changing `safeword check`, `codify`, or Cucumber runner behavior.
done_when:
  - Live instruction surfaces no longer teach scenario-name lineage as the current path.
  - `test-definitions.md` is consistently described as the R/G/R ledger in ticket-system and planning-facing docs.
  - The scaffolded starter feature points users toward direct `.feature` authoring.
  - Targeted markdown/template checks pass, and stale-phrase search returns only legacy code comments or historical tickets.
---

# Align Gherkin source instructions across safeword docs

**Goal:** Finish the documentation side of the feature-files-as-source migration so agents consistently author executable Gherkin first.

**Why:** The core 1DT29X code path now prefers `.feature` files, but several live instruction surfaces still teach the pre-1DT29X model where scenario lineage lives in markdown scenario names.

## Confirmed Surfaces

- `packages/cli/templates/SAFEWORD.md` and `.safeword/SAFEWORD.md`
- `packages/cli/templates/skills/bdd/DISCOVERY.md`, `.agents/skills/bdd/DISCOVERY.md`, and `.claude/skills/bdd/DISCOVERY.md`
- `packages/cli/templates/skills/ticket-system/SKILL.md`, `.agents/skills/ticket-system/SKILL.md`, and `.claude/skills/ticket-system/SKILL.md`
- `packages/cli/templates/cucumber/safeword-lane.feature`
- Planning-guide wording where `test-definitions.md` is described as a ledger for BDD scenarios can be tightened if it implies scenario ownership.

## Figure-It-Out Note

Decision: keep this as a targeted instruction cleanup, not a behavior gate. Cucumber's model treats `.feature` files as executable specifications with one `Feature`, optional `Rule` grouping, and concrete `Scenario` examples. Safeword should teach that model while preserving legacy markdown fallback until migration is intentionally removed.

## Work Log

- 2026-06-13T23:12:16.963Z Started: Created ticket 5AXPHR
- 2026-06-13 Scoped from broader skills/guides/docs audit after 1DT29X: stale current instructions still point at markdown scenario-name lineage.
