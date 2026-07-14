# Test Definitions: Move Codex users to the Safe Word plugin

Feature source: `packages/cli/features/migrate-codex-to-plugin.feature`

## Rule: migrate-codex-to-plugin.TB1.R1 - Standard setup and upgrade never change a user's Codex profile or remove existing legacy hooks

### Scenario: Upgrade retains legacy hooks until explicit migration

- [ ] RED
- [x] GREEN 2026-07-14
- [ ] REFACTOR

### Scenario: Fresh setup does not create Safe Word Codex hooks

- [ ] RED
- [x] GREEN 2026-07-14
- [ ] REFACTOR

## Rule: migrate-codex-to-plugin.TB1.R2 - Explicit migration verifies the profile plugin before removing Safe Word-owned project hooks

### Scenario: Verified plugin migration replaces legacy hooks

- [ ] RED
- [x] GREEN 2026-07-14
- [ ] REFACTOR

### Scenario: Failed plugin installation retains legacy hooks

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Disabled plugin retains legacy hooks

- [ ] RED
- [x] GREEN 2026-07-14
- [ ] REFACTOR

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

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [ ] cross-scenario
