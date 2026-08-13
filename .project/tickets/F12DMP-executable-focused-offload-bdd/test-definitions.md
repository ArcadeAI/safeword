# Test Definitions: Trustworthy executable offload BDD

test-definitions.md is the R/G/R ledger for the behavior defined in `spec.md`.

## Rule: executable-offload-bdd.SWM1.R1 — Delivered Rules enter the executable lane

### Scenario: A Rule cannot silently leave work in progress

- [x] RED 4fbaef722
- [x] GREEN 9f5e89603
- [x] REFACTOR 48319234a

Proof: `src/utils/gherkin-feature.test.ts`, `tests/commands/configured-feature-paths.test.ts`, and `tests/integration/cucumber-bdd.test.ts` exercise the parser, built public CLI, and real Cucumber selector respectively.

### Scenario: Unfinished and harness-only offload specifications remain honest

- [x] RED 4fbaef722
- [x] GREEN 4fbaef722
- [x] REFACTOR 9eadf5ed9

Proof: `tests/bdd-feature-maintainability.test.ts` preserves the 16-Rule / 624-case inventory and exact pending-proof titles.

## Rule: executable-offload-bdd.SWM1.R2 — Delivered steps identify one observable result

### Scenario: Bundled offload outcomes are split at observable boundaries

- [x] RED 4fbaef722
- [x] GREEN 4fbaef722
- [x] REFACTOR skip: cohesive domain preconditions were intentionally retained where splitting would reduce readability

Proof: `tests/bdd-feature-maintainability.test.ts` enforces the readability policy and semantic inventory across every offload feature.

---

## Feature-level cross-scenario refactor

- [x] cross-scenario 9eadf5ed9
