# Test Definitions: Bash-channel writes to the R/G/R ledger are gated

Feature source: `features/bash-ledger-write-gate.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Only write-shaped references to a ledger file are denied

### Scenario: The bulk-tick sed command from the audit is denied

- [x] RED 5d6930d
- [x] GREEN d6e79f0
- [x] REFACTOR skip: shell-parser extraction to shell-segments.ts was the structural move and landed as GREEN substrate; nothing further to clean

### Scenario: A read-only reference to the ledger is allowed

- [x] RED skip: allow-side precision pin — the gate is correctly silent here, so the test passes on first run by design (guards future over-denial)
- [x] GREEN a747dfa
- [x] REFACTOR skip: three-line pin test, nothing to restructure

### Scenario: A command with no ledger reference is allowed

- [x] RED skip: allow-side precision pin — passes on first run by design (includes sed -i on a non-ledger file)
- [x] GREEN ca0f5a4
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: Mentioning the ledger path without a write shape is allowed

- [x] RED skip: allow-side precision pin — passes on first run by design (mention ≠ mutation)
- [x] GREEN b727840
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: Each recognized write shape targeting the ledger is denied (outline)

- [x] RED f91627a
- [x] GREEN fd9effd
- [x] REFACTOR skip: shape families already factored into per-kind sets + one dispatch fn at GREEN; no duplication left worth extracting

### Scenario: A write-shaped segment inside a compound command is denied

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Redirecting ledger contents to another file is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The gate scopes to the tickets namespace

### Scenario: Writing a test-definitions.md outside the tickets namespace is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Detection is conservative and its limits are documented

### Scenario: An obfuscated write the predicate cannot see is allowed by design

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An inline interpreter that names the ledger is denied even if its code only reads

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The predicate module documents what it cannot catch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: One predicate reaches all three harnesses

### Scenario: The Claude gate denies a ledger write through its Bash branch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The Codex adapter carries the same denial

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The Codex adapter passes an allowed command through

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cursor's shell pre-filter consults the gate for ledger writes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cursor's shell pre-filter does not demand the gate for a read-only command

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The denial names the sanctioned channel

### Scenario: The denial message directs to the Edit channel with the reason

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level

- [ ] cross-scenario
