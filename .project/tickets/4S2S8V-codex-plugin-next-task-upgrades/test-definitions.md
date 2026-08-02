# Test Definitions: Update Safeword without restarting Codex

Feature source: `packages/cli/features/codex-plugin-next-task-upgrades.feature`

test-definitions.md is the R/G/R ledger.

## Rule: codex-plugin-next-task-upgrades.TBU1.R1 — Installation refreshes an existing Git marketplace before selecting the released plugin

### Scenario: Fresh profile adds the marketplace before installing the plugin

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Marketplace add failure prevents plugin installation

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Existing Git marketplace refreshes before installing the released plugin

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Marketplace refresh failure prevents installation from stale metadata

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: codex-plugin-next-task-upgrades.TBU1.R2 — The current task keeps its loaded plugin while a new task activates the installed version without an application restart

### Scenario: Successful installation explains next-task activation without a restart

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Installing an upgrade does not change the running task

Manual/live host check; automated supporting proof covers Safeword's immutable exact-version command.

- [x] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A new task activates the installed release without restarting Codex

Manual/live host check; automated supporting proof covers exact SessionStart identity.

- [x] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Pending activation status never claims the current task hot-reloaded

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: codex-plugin-next-task-upgrades.TBU1.R3 — Hook activation remains bound to the installed version and exact manifest until a new task supplies current proof

### Scenario: Matching SessionStart proof completes next-task activation

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Either plugin identity mismatch prevents activation completion

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Later tasks preserve completed activation

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: codex-plugin-next-task-upgrades.TBU1.R4 — Profiles carrying the former restart marker converge to the next-task activation contract without losing proof state

### Scenario: Matching legacy marker is recognized and retired by the next task

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Legacy-marker migration preserves existing exact proof

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Invalid legacy markers do not manufacture pending activation

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Feature-level cross-scenario refactor

- [x] cross-scenario
