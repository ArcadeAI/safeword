# Test Definitions: Bash-channel writes to the R/G/R ledger are gated

Feature source: `features/bash-ledger-write-gate.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Only write-shaped references to a ledger file are denied

### Scenario: The bulk-tick sed command from the audit is denied

- [x] RED 5d6930d
- [x] GREEN d6e79f0
- [x] REFACTOR skip: shell-parser extraction to shell-segments.ts was the structural move and landed as GREEN substrate; nothing further to clean

### Scenario: A read-only reference to the ledger is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A command with no ledger reference is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Mentioning the ledger path without a write shape is allowed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each recognized write shape targeting the ledger is denied (outline)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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
