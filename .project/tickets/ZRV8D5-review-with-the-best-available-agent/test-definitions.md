# Test Definitions: Keep review available with the best supported fallback

Feature source: `packages/cli/features/review-with-the-best-available-agent.feature`

test-definitions.md is the R/G/R ledger.

## Rule: review-with-the-best-available-agent.TBU1.R1 — Every independent reviewer precedes every degraded route

### Scenario: The first available opposite local agent completes the review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed opposite default model falls through to its independent alternate model

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

### Scenario: A failed headless review falls through to an in-session reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid in-session findings fall through to main-thread self-review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An in-session reviewer runtime failure falls through to self-review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: review-with-the-best-available-agent.TBU1.R4 — Main-thread self-review returns valid findings or preserves exhaustion

### Scenario: Every delegated route fails before the main thread reviews once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A clean terminal self-review returns no invented findings

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid terminal self-review preserves the original exhaustion result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A cloud host without delegation still completes bounded self-review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: review-with-the-best-available-agent.TBU1.R5 — Shipped host contracts frame review material as untrusted data

### Scenario: A fresh-context reviewer receives hostile repository text as untrusted material

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Fresh-context assurance never claims packet-only isolation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: review-with-the-best-available-agent.NTB1.R3 — Degraded verdicts are preserved

### Scenario: Degraded approval remains approved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Degraded changes requested remains action required

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Main-thread self-review treats hostile packet text as data

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Hostile packet text cannot forge independent assurance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: review-with-the-best-available-agent.TBU1.R6 — Only typed route exhaustion enters the degraded ladder

### Scenario: A reviewer rejection never starts a degraded review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A source-mutation failure never starts a degraded review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A required-policy failure never starts a degraded review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unrecognized coordinator failure never starts host fallback

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Typed route exhaustion starts the host-owned fallback

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: review-with-the-best-available-agent.NTB1.R1 — Every result explains a distinct assurance level in plain language

### Scenario: Each review route has a distinct plain-language assurance explanation

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
