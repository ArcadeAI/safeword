# Test Definitions: Move Codex users to the Safe Word plugin

Feature source: `packages/cli/features/migrate-codex-to-plugin.feature`

## Rule: migrate-codex-to-plugin.TB1.R1 - Standard setup and upgrade never change a user's Codex profile or remove existing legacy hooks

### Scenario: Upgrade retains legacy hooks until explicit migration

- [x] RED skip: legacy reconciliation behavior was already covered before the migration test suite
- [x] GREEN 5a1dcaa2
- [x] REFACTOR skip: generic reconciliation no longer owns Codex hooks

### Scenario: Fresh setup does not create Safe Word Codex hooks

- [x] RED skip: setup behavior changed with the canonical schema migration
- [x] GREEN 5a1dcaa2
- [x] REFACTOR skip: generic reconciliation no longer owns Codex hooks

## Rule: migrate-codex-to-plugin.TB1.R2 - Explicit migration verifies the profile plugin before removing Safe Word-owned project hooks

### Scenario: Verified plugin migration replaces legacy hooks

- [x] RED skip: command test and implementation were introduced in the same checkpoint
- [x] GREEN 5a1dcaa2
- [x] REFACTOR skip: assertions are direct migration behavior coverage

### Scenario: Failed plugin installation retains legacy hooks

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Disabled plugin retains legacy hooks

- [x] RED skip: command test and implementation were introduced in the same checkpoint
- [x] GREEN 5a1dcaa2
- [x] REFACTOR skip: assertions are direct migration behavior coverage

### Scenario: Missing Bun retains legacy hooks

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: migrate-codex-to-plugin.TB1.R3 - Migration preserves user-authored Codex configuration and hooks

### Scenario: Mixed Codex configuration retains custom hooks

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configuration without Safe Word hooks remains unchanged

- [x] RED skip: reconciliation preservation assertion replaced retired delivery coverage
- [x] GREEN 5a1dcaa2
- [x] REFACTOR skip: retired project-delivery assertions must be deleted with the behavior change

## Rule: migrate-codex-to-plugin.SM1.R1 - The shipped plugin uses exact version-pinned Bunx commands and no Codex npx command

### Scenario: Plugin release contract rejects an unpinned or npx command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: migrate-codex-to-plugin.SM1.R2 - The packed package and a real isolated Codex profile prove the release contract

### Scenario: Packed plugin installs and dispatches through Bunx

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Release rejects a package missing plugin assets

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: remaining scenarios require release and live-profile coverage before a shared refactor
