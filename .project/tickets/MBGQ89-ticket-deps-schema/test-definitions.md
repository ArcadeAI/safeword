# Test Definitions: epic + blocked_on schema and the blocked_on phase gate

Feature source: `packages/cli/features/ticket-deps-schema.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`.

## Rule: epic and blocked_on are optional canonical fields

### Scenario: A ticket carrying neither field validates cleanly

- [x] RED 7d339de
- [x] GREEN 7d339de
- [x] REFACTOR 7d339de

## Rule: Relations validation warns, never blocks

### Scenario: An unresolvable blocked_on id is warned, not errored

- [x] RED 7d339de
- [x] GREEN 7d339de
- [x] REFACTOR 7d339de

### Scenario: A blocked_on cycle is warned, not errored

- [x] RED 7d339de
- [x] GREEN 7d339de
- [x] REFACTOR 7d339de

### Scenario: A self-referential blocked_on is warned

- [x] RED 7d339de
- [x] GREEN 7d339de
- [x] REFACTOR 7d339de

### Scenario: A clean corpus produces no relation advisories

- [x] RED 7d339de
- [x] GREEN 7d339de
- [x] REFACTOR 7d339de

## Rule: blocked_on gates phase-advance out of intake

### Scenario: Advancing out of intake is denied while a blocker is in progress

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Advancing out of intake is allowed once the blocker is done

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Any non-done blocker among several denies the advance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: All-done blockers allow the advance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocker with unreadable status fails safe and denies the advance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Non-done terminal blockers require a reasoned override

### Scenario: A cancelled blocker without an override denies the advance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A substantive override allows advance past a terminal-but-not-done blocker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An override's reason is surfaced in the INDEX

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The override must be honest

### Scenario: An override with a trivial reason is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A stale override is flagged once every blocker is done

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The gate fires only on the intake-exit transition (grandfather)

### Scenario: A blocker added after intake does not retroactively block

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A non-phase edit is never blocked

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A dependency cycle does not hang the gate

### Scenario: The gate short-circuits on a cycle instead of looping

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
