# Test Definitions: Keep default tests responsive

## Rule: Configuration assertions do not install dependencies

### Scenario: Cursor setup assertions use the config-only setup path

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Hook setup assertions use the config-only setup path

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Conditional project detection uses the config-only setup path

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Remaining profiled config-only suites use the explicit boundary

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Audited config-only files cannot regress to raw setup calls

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Real installation evidence remains explicit

### Scenario: Non-git setup installs base dependencies in the slow lane

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Verification

- Focused default batch passes without ambient `SAFEWORD_SKIP_INSTALL`.
- Focused slow-lane installation proof passes with `vitest.slow.config.ts`.
- Full default Vitest, BDD, lint, and typecheck commands pass.
- A post-change JSON profile is compared with the 449.27s current-main baseline.

## Task-level refactor

- [x] cross-scenario — shared `runCliWithoutInstall` helper makes the boundary explicit
