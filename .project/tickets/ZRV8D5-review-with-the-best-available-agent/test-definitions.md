# Test Definitions: Always return the best available review

Feature source: `packages/cli/features/review-with-the-best-available-agent.feature`

test-definitions.md is the R/G/R ledger.

## Rule: review-with-the-best-available-agent.TBU1.R1 — Every independent reviewer precedes every degraded route

### Scenario: The first available opposite local agent completes the review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed opposite agent falls through to another independent reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: review-with-the-best-available-agent.TBU1.R2 — Same-agent headless review is the first degraded route

### Scenario: Exhausted independent routes use a same-agent headless review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: review-with-the-best-available-agent.TBU1.R3 — Host-native review covers environments without a usable CLI

### Scenario: Claude Code Cloud still completes a review without external agent CLIs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: review-with-the-best-available-agent.TBU1.R4 — Main-thread self-review guarantees findings when delegation is unavailable

### Scenario: Every delegated route fails before the main thread reviews once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: review-with-the-best-available-agent.TBU1.R5 — Review material never becomes host instruction

### Scenario: A degraded reviewer receives hostile repository text as untrusted material

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: review-with-the-best-available-agent.NTB1.R2 — Degraded findings never masquerade as required independence

### Scenario: Degraded findings complete preferred policy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An independent review satisfies required policy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Required independence remains unsatisfied after a degraded review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
