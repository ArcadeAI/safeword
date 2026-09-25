# Test Definitions: Run independent Codex reviews without permission setup

Feature source: `packages/cli/features/prompt-free-codex-reviews.feature`

## Rule: prompt-free-codex-reviews.TBU1.R1

### Scenario: Safeword exposes only bounded review operations

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every review kind returns a terminal verdict through MCP

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Executable RED stays outside the review interface

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid requests never reach a reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing review files do not reach a reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An empty target list does not reach a reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Coordinator policy opt-out blocks provider dispatch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Packet size follows the coordinator boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prompt-free-codex-reviews.TBU1.R2

### Scenario: Generated review guidance names the MCP tools for every kind

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plugin installation makes the review tools available

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Upgrading the plugin preserves customer permissions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable review tools do not trigger an approval escalation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unreachable reviewer provider fails without permission escalation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: prompt-free-codex-reviews.TBU1.R3

### Scenario: Independent review finishes without a prompt under workspace permissions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-independent review states never count as completion

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Self-review routing cannot claim independence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable review IDs never count as completion

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A completed review remains verifiable after an MCP restart

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Changed sources invalidate the receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Edited review receipts cannot claim independent approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
