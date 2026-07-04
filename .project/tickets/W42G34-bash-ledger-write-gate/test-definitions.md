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

- [x] RED skip: pin — per-segment scan landed with the outline GREEN (fd9effd), so this passes on first run; test guards segment handling
- [x] GREEN eecd7b7
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: Redirecting ledger contents to another file is allowed

- [x] RED skip: allow-side precision pin — the redirection-target design passes it on first run (source ≠ target); the test kills naive substring predicates
- [x] GREEN d353ae8
- [x] REFACTOR skip: pin test, nothing to restructure

## Rule: The gate scopes to the tickets namespace

### Scenario: Writing a test-definitions.md outside the tickets namespace is allowed

- [x] RED skip: allow-side precision pin — isNamespacePath scoping landed with the first GREEN, so this passes on first run
- [x] GREEN d3b6049
- [x] REFACTOR skip: pin test, nothing to restructure

## Rule: Detection is conservative and its limits are documented

### Scenario: An obfuscated write the predicate cannot see is allowed by design

- [x] RED skip: scope-pin — asserts the documented limit (variable paths, script files pass); by definition passes on first run
- [x] GREEN c717fd2
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: An inline interpreter that names the ledger is denied even if its code only reads

- [x] RED skip: pin — over-approximation landed with the outline GREEN (fd9effd); this test locks the decision against a future read-vs-write "fix"
- [x] GREEN c717fd2
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: The predicate module documents what it cannot catch

- [x] RED skip: doc-contract pin — limits block was authored with the first GREEN; test locks the named forms + backstop
- [x] GREEN 1ee282f
- [x] REFACTOR skip: pin test, nothing to restructure

## Rule: One predicate reaches all three harnesses

### Scenario: The Claude gate denies a ledger write through its Bash branch

- [x] RED skip: seam pin — the anchor scenario's RED (5d6930d) proved this seam failing; this adds a second shape + allow counterpart at the same seam
- [x] GREEN 5053f86
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: The Codex adapter carries the same denial

- [x] RED skip: seam pin — the adapter's Bash translation pre-existed, so the deny flows through on first run; test guards the translation seam
- [x] GREEN 5053f86
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: The Codex adapter passes an allowed command through

- [x] RED skip: allow-side counterpart — passes on first run by design (kills a deny-everything adapter)
- [x] GREEN 5053f86
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: Cursor's shell pre-filter consults the gate for ledger writes

- [x] RED 0e19bcd
- [x] GREEN 2d14bdb
- [x] REFACTOR skip: two-line widening of an existing predicate; nothing to restructure

### Scenario: Cursor's shell pre-filter does not demand the gate for a read-only command

- [x] RED skip: allow-side counterpart — passed already at the pre-filter RED commit (kills an always-true widening)
- [x] GREEN 0e19bcd
- [x] REFACTOR skip: pin test, nothing to restructure

## Rule: The denial names the sanctioned channel

### Scenario: The denial message directs to the Edit channel with the reason

- [x] RED skip: message pin — the denial text shipped with the first GREEN (d6e79f0); test locks the Edit-channel + annotation-validation wording
- [x] GREEN 5053f86
- [x] REFACTOR skip: pin test, nothing to restructure

## Feature-level

- [x] cross-scenario 63fcf57
