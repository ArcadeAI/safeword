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

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f

### Scenario: Advancing out of intake is allowed once the blocker is done

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f

### Scenario: Any non-done blocker among several denies the advance

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f

### Scenario: All-done blockers allow the advance

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f

### Scenario: A blocker with unreadable status fails safe and denies the advance

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f

## Rule: Non-done terminal blockers require a reasoned override

### Scenario: A cancelled blocker without an override denies the advance

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f

### Scenario Outline: A substantive override allows advance past a terminal-but-not-done blocker

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f

### Scenario: An override's reason is surfaced in the INDEX

- [x] RED c6c4901
- [x] GREEN c6c4901
- [x] REFACTOR c6c4901

## Rule: The override must be honest

### Scenario: An override with a trivial reason is rejected

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f

### Scenario: A stale override is flagged once every blocker is done

- [x] RED c6c4901
- [x] GREEN c6c4901
- [x] REFACTOR c6c4901

## Rule: The gate fires only on the intake-exit transition (grandfather)

### Scenario: A blocker added after intake does not retroactively block

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f

### Scenario: A non-phase edit is never blocked

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f

## Rule: A dependency cycle does not hang the gate

### Scenario: The gate short-circuits on a cycle instead of looping

- [x] RED fc65f8f
- [x] GREEN fc65f8f
- [x] REFACTOR fc65f8f
