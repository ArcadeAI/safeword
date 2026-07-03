# Test Definitions: Filer ack + bare-drain tripwire

Feature source: `packages/cli/features/filer-ack-tripwire.feature` (@manual —
vitest-proven). Spec: `spec.md`. Dimensions: `dimensions.md`.

test-definitions.md is the R/G/R ledger. RED means an EXECUTED failing run
(command + observed failure), not an asserted counterfactual.

## Rule: Unacked removals trip once per batch; acked or pending removals stay silent

### Scenario: A dispatched signature vanishing without an ack captures one RetroBareDrain signal (SM1.AC1)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A tripped batch does not trip again (SM1.AC1)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A new dispatched batch re-arms the tripwire after an earlier trip (SM1.AC1)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Removals covered by shape-valid ack lines trip nothing (SM1.AC2)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Torn ack lines are skipped; the partially acked batch still trips once (SM1.AC2)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Dispatched signatures still sitting in the spool trip nothing (SM1.AC2)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Absent or pre-upgrade state fails open

### Scenario Outline: Degraded marker or ack state disarms the tripwire without changing gate behavior (SM1.AC3 — 4 examples)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Capture-off suppresses the tripwire; file-off alone does not (SM1.AC3)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The filer acks before it drains

### Scenario: The filing seam records each ack after its post and before any drain (SM2.AC2)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Shipped prompts and the guide carry the ack procedure and drain prohibition (SM2.AC1)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The tripwire observes; it never surfaces or loops

### Scenario: A tripped evaluation emits nothing and decides exactly as an ack-clean one (TB1.AC1 — real Stop hook entry, fs-only mocking)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The captured signal is allowlist-shaped and the retro spool is untouched (TB1.AC1)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
