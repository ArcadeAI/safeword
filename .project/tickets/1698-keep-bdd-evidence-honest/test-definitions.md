# Test Definitions: Keep BDD evidence honest

No `.feature` file: the executable proof is Vitest over the shipped BDD/TDD
instruction surfaces. The tests fail if the scenario proof-fidelity contract disappears
from either the canonical templates or installed dogfood copies.

## Rule: Primary proof preserves the scenario's actor-facing contract

### Scenario: 1698.SU1.AC1-2.rejects_internal_substitutes_for_user-visible_clauses

Given a BDD scenario names an actor-facing action and actor-visible result
When Safeword teaches the agent how to choose and review the primary proof
Then it says direct store calls, injected lower-level events, and internal-state
assertions are supporting evidence rather than proof of those clauses

- [x] RED skip: no per-step commit requested; focused test failed on the absent contract
- [x] GREEN fa16069cb # scenario-proof guidance and regression coverage
- [x] REFACTOR skip: no additional cleanup after the single-behavior split during GREEN

## Rule: Setup and supporting proof remain proportionate

### Scenario: 1698.SU1.AC3.allows_given_shortcuts_and_lower_level_support

Given fixtures and lower-level tests make the scenario cheaper and easier to
diagnose
When Safeword applies the scenario proof contract
Then it permits setup shortcuts in `Given` and supporting tests without
weakening the required `When` and `Then` evidence

- [x] RED skip: covered by the same missing-contract RED
- [x] GREEN fa16069cb # scenario-proof guidance and regression coverage
- [x] REFACTOR skip: no further structural improvement needed

## Rule: Evidence limits remain visible

### Scenario: 1698.SU1.AC4.routes_unavailable_automation_without_overclaiming

Given the named user or operating-system boundary cannot be automated reliably
When Safeword records the scenario's completion state
Then it uses the existing `@manual` or `@live` path and never promotes a
narrower automated test into full scenario evidence

- [x] RED skip: covered by the same missing-contract RED
- [x] GREEN fa16069cb # scenario-proof guidance and regression coverage
- [x] REFACTOR skip: no further structural improvement needed

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: one canonical rule with two local review checkpoints; no shared abstraction needed
