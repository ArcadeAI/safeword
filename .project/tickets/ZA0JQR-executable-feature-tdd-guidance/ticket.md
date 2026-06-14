---
id: ZA0JQR
slug: executable-feature-tdd-guidance
type: task
phase: intake
status: in_progress
epic: bdd-phase-two-merge
depends_on: [1DT29X]
relates_to: [7ES3GW, BFCWDB, VM78NC]
created: 2026-06-13T23:41:11.609Z
last_modified: 2026-06-14T00:07:27Z
scope:
  - Update BDD implement/TDD guidance so agents know how a `.feature` scenario becomes an executable RED/GREEN/REFACTOR loop.
  - Clarify when RED should be a Cucumber undefined/pending/failing step versus a derived Vitest implementation skeleton.
  - Clarify that Vitest tests can still carry lower-level implementation proof, but `test:bdd` is the acceptance proof when the Cucumber lane exists.
  - Update `codify` guidance wording if it currently implies Vitest stubs alone make the feature source executable.
  - Keep source templates and dogfooded installed copies aligned across `packages/cli/templates/`, `.agents/`, and `.claude/`.
out_of_scope:
  - Generating Cucumber step-definition stubs automatically.
  - Replacing Vitest implementation tests with Cucumber-only tests.
  - Enforcing `test:bdd` in the done gate; `BFCWDB` owns that behavior.
  - Changing Cucumber feature discovery or tag profiles; `VM78NC` owns that behavior.
done_when:
  - Agents entering implement phase can tell, from the BDD/TDD instructions alone, whether to write Cucumber step definitions, Vitest tests, or both for a scenario.
  - The instructions prevent the failure mode where `.feature` is treated as source but never gets step definitions.
  - Testing-guide integration remains coherent with `7ES3GW`: Cucumber is the acceptance/specification lane; Vitest remains available for unit/integration implementation proof.
  - Targeted markdown/template checks pass.
---

# Guide agents from feature files to executable Cucumber steps

**Goal:** Make the implement-phase instructions bridge `.feature` scenario source to executable Cucumber step definitions without demoting Vitest implementation tests.

**Why:** After 1DT29X, `.feature` files are the scenario source, but the TDD instructions still say "write a failing test" generically. Agents can satisfy the ledger with Vitest while leaving the Cucumber feature undefined, which defeats the acceptance lane.

## Figure-It-Out Decision

Recommendation: keep this as a focused task, not part of `7ES3GW`. The testing guide should teach the lane concept broadly; this ticket changes the implement-phase behavior that decides what agents write at RED. A `.feature` file is only executable when matching step definitions exist, so safeword needs explicit instructions for the Cucumber-step layer before `BFCWDB` makes `test:bdd` load-bearing at verify/done.

## Evidence

- `bdd/TDD.md` says to write a failing test per scenario but does not name Cucumber step definitions.
- `bdd/SCENARIOS.md` says `safeword codify <ticket>` turns `.feature` source into runnable stubs, but the current command emits Vitest skeletons by default and echoes Gherkin for `--format gherkin`.
- The scaffolded Cucumber lane ships shared shell-out steps, but domain scenarios still need matching step definitions to execute.

## Work Log

- 2026-06-13T23:41:11.609Z Started: Created ticket ZA0JQR
- 2026-06-13 Scoped from `/figure-it-out`: choose a focused BDD/TDD guidance ticket over folding this into the broader testing-guide cleanup.
- 2026-06-14T00:07:27Z Implemented: BDD/TDD guidance now names Cucumber step definitions, `test:bdd`, and Vitest's lower-level role; codify wording now distinguishes implementation stubs from acceptance proof; targeted doc guard passed.
