# Test Definitions: Send enriched retros from Claude Cloud

Feature source: `features/send-enriched-retros-from-claude-cloud.feature`

test-definitions.md is the R/G/R ledger.

## Rule: send-enriched-retros-from-claude-cloud.NTB1.R1 — Each eligible Claude Cloud session yields at most one recorded public retro silently

### Scenario: An eligible cloud Stop records one matching durable receipt silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repeated completion of the same cloud session makes no second attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A distinct cloud session receives its own request identity and receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reclaimed workspace changes cannot record a second retro for the same session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An ineligible cloud session makes no public attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A project opt-out prevents a cloud public attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-enriched-retros-from-claude-cloud.NTB1.R2 — Public delivery never prevents completion, narrates, or consumes existing recovery

### Scenario: An unreachable collector is bounded and leaves recovery unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cloud network-policy rejection leaves recovery unchanged silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Public acceptance does not consume the existing recovery candidate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No valid findings preserve the existing private recovery candidate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An oversized batch preserves every finding for recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Local v2 acceptance preserves every finding for private recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unreachable collector preserves every local finding silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Local opt-out preserves recovery silently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-enriched-retros-from-claude-cloud.SWM1.R1 — The carrier binds Claude Code and cloud host identity independently of payload claims

### Scenario: Payload metadata cannot spoof cloud carrier identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A local-only invocation cannot activate the Claude Cloud route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Claude Code GitHub Actions remains disabled

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Partial or malformed Claude remote-session evidence fails closed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Unsupported cloud hosts remain disabled

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-enriched-retros-from-claude-cloud.SWM1.R2 — New senders use one bounded shared batch while the collector remains backward compatible

### Scenario: Multiple findings use one ordered canonical batch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Real source collaborators populate the received cloud request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One request identity correlates the batch with its receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The canonical v2 request is byte-identical for the same session and findings

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One finding uses the same v2 batch contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid findings are excluded from a mixed batch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The updated local carrier uses the same v2 batch and request identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No valid findings make no public attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A batch exactly at the shared byte limit is accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An oversized batch makes no partial public attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector remains compatible with released v1 senders

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The collector accepts the exact v2 body emitted by the cloud carrier

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The collector rejects invalid v2 envelopes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: send-enriched-retros-from-claude-cloud.SWM1.R3 — Readiness requires real cloud evidence with a matching durable receipt

### Scenario: A real Claude Cloud run proves the carrier before release

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Matching real cloud evidence marks the carrier proven

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Insufficient evidence cannot prove the carrier

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
