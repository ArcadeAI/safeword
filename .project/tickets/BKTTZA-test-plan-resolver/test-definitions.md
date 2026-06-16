# Test Definitions: test-plan resolver

Feature source: `features/test-plan-resolver.feature`

R/G/R ledger. Executable Given/When/Then live in the `.feature`; lower-level
runner-detection proof rides on Vitest unit tests (pure resolver, injected
`isToolAvailable` + temp fixtures) under each scenario's GREEN step.

> Scenario count is 18 (above the soft >15 define-behavior split hint). Split
> **declined**: this is one cohesive journey — a single pure resolver's contract —
> so "split by user journey" doesn't apply. The runner-detection cluster is
> table-like and may collapse to a `Scenario Outline` at implementation.

## Rule: Every detected language appears in the plan (no first-match)

### Scenario: A JS+Python repo yields exactly a javascript and a python entry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A Go+Rust repo yields both a go and a rust entry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A package.json with an empty scripts object contributes no javascript entry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed manifest is skipped without dropping other languages

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A repo with no recognized manifest yields an empty plan

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The command reflects the detected runner

### Scenario: Python with a tox.ini runs tox

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Python with no pytest falls back to unittest

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A uv-locked Python repo runs pytest through uv

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Rust uses nextest when it is installed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Rust falls back to cargo test --workspace without nextest

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A Go workspace expands its modules in the emitted command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pnpm JS repo runs its test script through pnpm

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Missing toolchains stay visible, never dropped

### Scenario: A Go repo with no go binary still appears, marked unavailable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Nested and vendored manifests are handled

### Scenario: A manifest in a sub-directory is discovered

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A manifest inside an excluded directory is ignored

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The build plan emits native build commands

### Scenario: Build plan emits per-language build commands

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Build plan omits a JS entry when there is no build script

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The resolver is reachable as one CLI surface

### Scenario: The CLI prints the resolved plan as JSON

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
