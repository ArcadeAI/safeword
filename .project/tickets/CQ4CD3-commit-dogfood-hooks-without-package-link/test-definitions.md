# Test Definitions: Commit dogfood hooks without package link

Feature source: GitHub issue #470 / ticket CQ4CD3

## Rule: Source worktree dependency setup makes the dogfood ESLint import resolvable

### Scenario: Root source worktree resolves `safeword/eslint` after normal install

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Installed project config semantics stay unchanged

### Scenario: Generated `.safeword/eslint.config.mjs` keeps normal `safeword/eslint` import behavior

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Generated TypeScript project config loading installs `jiti`

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

- [x] cross-scenario - skip: the shared behavior is covered by focused package-resolution and config-template tests; no shared fixture or abstraction emerged.
