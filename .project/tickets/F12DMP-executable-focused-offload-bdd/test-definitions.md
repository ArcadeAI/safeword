# Test Definitions: Trustworthy executable offload BDD

test-definitions.md is the R/G/R ledger for the behavior defined in `spec.md`.

## Rule: executable-offload-bdd.SWM1.R1 — Delivered Rules enter the executable lane

### Scenario: A Rule cannot silently leave work in progress

- [x] RED — `4fbaef722` added failing parser and public-CLI contract tests.
- [x] GREEN — `9f5e89603` enforced Rule-scoped `@wip` / `@proof.cucumber` delivery state.
- [x] REFACTOR — `48319234a`, `9eadf5ed9` isolated delivery evaluation and made diagnostics policy-owned.

Proof: `src/utils/gherkin-feature.test.ts`, `tests/commands/configured-feature-paths.test.ts`, and `tests/integration/cucumber-bdd.test.ts` exercise the parser, built public CLI, and real Cucumber selector respectively.

### Scenario: Unfinished and harness-only offload specifications remain honest

- [x] RED — the full proof audit exposed completed-proof tags with no executable Vitest mapping.
- [x] GREEN — `4fbaef722` classified the eight harness/meta scenarios as `@proof.pending-vitest` while retaining `@wip` on all sixteen product Rules.
- [x] REFACTOR — `9f5e89603` centralized the reviewed inventory and readability assertions.

Proof: `tests/bdd-feature-maintainability.test.ts` preserves the 16-Rule / 624-case inventory and exact pending-proof titles.

## Rule: executable-offload-bdd.SWM1.R2 — Delivered steps identify one observable result

### Scenario: Bundled offload outcomes are split at observable boundaries

- [x] RED — `4fbaef722` updated the maintainability contract alongside the reviewed corpus rewrite.
- [x] GREEN — `4fbaef722` split 31 conjunction-heavy steps without changing the semantic inventory.
- [x] REFACTOR — cohesive preconditions remain intact where splitting would reduce domain readability.

Proof: `tests/bdd-feature-maintainability.test.ts` enforces the readability policy and semantic inventory across every offload feature.

---

## Feature-level cross-scenario refactor

- [x] `48319234a`, `9eadf5ed9`
