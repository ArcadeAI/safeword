---
id: 7ES3GW
slug: teach-testing-guide-gherkin-acceptance-lane
type: task
phase: intake
status: in_progress
epic: bdd-phase-two-merge
relates_to: 1DT29X
created: 2026-06-13T23:12:16.963Z
last_modified: 2026-06-13T23:12:16.963Z
scope:
  - Update the testing guide to explain where Gherkin `.feature` acceptance scenarios fit in the test strategy.
  - Update the testing skill quick reference so feature-level work points to `.feature` source plus the R/G/R ledger, not only the test-definition template.
  - Keep source templates and dogfooded installed copies aligned across `packages/cli/templates/`, `.safeword/`, `.agents/`, and `.claude/`.
  - Clarify that `.feature` files are behavior/specification sources whose steps can drive API, service, shell, or browser-backed tests at the highest practical scope.
out_of_scope:
  - Replacing Vitest unit/integration tests with Cucumber.
  - Forcing every task or patch through Cucumber.
  - Changing Cucumber runner setup or scaffolded dependencies.
  - Writing new feature files for active tickets.
done_when:
  - The testing guide names the Gherkin acceptance lane and when to use it.
  - The testing skill quick reference points agents to `/bdd` for feature-level `.feature` authoring and to `test-definitions.md` only as the ledger/template.
  - The guide keeps the test-type hierarchy coherent: Gherkin is a behavior source/acceptance lane, while the backing implementation can still be unit, integration, E2E, or LLM-eval where appropriate.
  - Targeted markdown/template checks pass.
---

# Teach agents when to use the Gherkin acceptance lane

**Goal:** Make the test-writing guidance explain how safeword's `.feature` acceptance lane fits with TDD test selection.

**Why:** The current testing guide is not wrong, but it predates 1DT29X and never tells agents that feature-level BDD starts with executable `.feature` scenarios.

## Figure-It-Out Note

Decision: treat Gherkin as an acceptance/specification lane, not as a replacement for the whole test pyramid. Cucumber describes scenarios as executable specifications, and cucumber-js can discover `features/**/*.feature`; safeword should use that as the outer behavior source, then let implementation tests land at the highest practical scope.

## Likely Surfaces

- `packages/cli/templates/guides/testing-guide.md` and `.safeword/guides/testing-guide.md`
- `packages/cli/templates/skills/testing/SKILL.md`, `.agents/skills/testing/SKILL.md`, and `.claude/skills/testing/SKILL.md`

## Work Log

- 2026-06-13T23:12:16.963Z Started: Created ticket 7ES3GW
- 2026-06-13 Scoped from `/figure-it-out`: testing guide has no stale markdown-source claim, but omits the new Gherkin acceptance lane.
