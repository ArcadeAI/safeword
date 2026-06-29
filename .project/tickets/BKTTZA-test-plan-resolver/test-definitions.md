# Test Definitions: test-plan resolver

Feature source: `features/test-plan-resolver.feature`

R/G/R ledger. Executable Given/When/Then live in the `.feature`; lower-level
runner-detection proof rides on Vitest unit tests (pure resolver, injected
`isToolAvailable` + temp fixtures) under each scenario's GREEN step.

> Scenario count is 19 (above the soft >15 define-behavior split hint). Split
> **declined**: this is one cohesive journey — a single pure resolver's contract —
> so "split by user journey" doesn't apply. The runner-detection cluster is
> table-like and may collapse to a `Scenario Outline` at implementation.

## Rule: Every detected language appears in the plan (no first-match)

### Scenario: A JS+Python repo with Python tests yields exactly a javascript and a python entry

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A Go+Rust repo yields both a go and a rust entry

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A package.json with an empty scripts object contributes no javascript entry

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A malformed manifest is skipped without dropping other languages

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A repo with no recognized manifest yields an empty plan

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: The command reflects the detected runner

### Scenario: Python with a tox.ini runs tox

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Python with no pytest falls back to unittest

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Python manifest without tests contributes no python entry

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A uv-locked Python repo runs pytest through uv

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Rust uses nextest when it is installed

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Rust falls back to cargo test --workspace without nextest

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A Go workspace expands its modules in the emitted command

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A pnpm JS repo runs its test script through pnpm

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Missing toolchains stay visible, never dropped

### Scenario: A Go repo with no go binary still appears, marked unavailable

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Nested and vendored manifests are handled

### Scenario: A manifest in a sub-directory is discovered

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A nested Go module is tested in its own directory

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A manifest inside an excluded directory is ignored

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: The build plan emits native build commands

### Scenario: Build plan emits per-language build commands

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Build plan omits a JS entry when there is no build script

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: The resolver is reachable as one CLI surface

### Scenario: The CLI prints the resolved plan as JSON

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

- [x] cross-scenario — skip: helpers (entry(), per-language resolvers) factored during GREEN; no cross-scenario duplication emerged
