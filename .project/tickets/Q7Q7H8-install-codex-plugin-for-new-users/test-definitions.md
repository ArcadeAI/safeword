# Test Definitions: Install the Safe Word Codex plugin for new users

Feature source: `packages/cli/features/install-codex-plugin-for-new-users.feature`

## Rule: New-user guidance names installation rather than migration

### Scenario: Fresh setup directs the builder to install the Codex plugin

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Upgrade directs the builder to install the Codex plugin

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Fresh setup does not direct builders to the legacy migration command

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Profile installation leaves the project untouched

### Scenario: Fresh Codex installation verifies the profile plugin without project configuration

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Failed profile installation leaves no project Codex configuration

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Legacy cleanup is an explicit verified action

### Scenario: Verified legacy cleanup preserves custom hooks without reinstalling the plugin

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Legacy cleanup without explicit confirmation is refused

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Existing migration scripts remain compatible

### Scenario: Legacy plugin migration command still installs and verifies the profile plugin

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Legacy migration keeps the project untouched when plugin installation fails

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: reused the existing upgrade action in the acceptance steps; no remaining shared behavior or fixture duplication warrants an abstraction
