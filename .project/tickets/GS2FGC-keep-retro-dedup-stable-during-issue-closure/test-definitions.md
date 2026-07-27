# Test Definitions: Keep retro dedup stable during issue closure

## Rule: State changes cannot create a false marker absence

### Scenario: An earlier issue closes while a later marker is being paginated

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A closed exact marker remains ineligible

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Enumeration retains its existing safety boundaries

### Scenario: The dedup request enumerates all states in creation order

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Pull requests remain ineligible marker matches

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Enumeration fails closed when an unread tail may remain

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Task-level cross-scenario refactor

- [x] cross-scenario 809d662b0

Removed the repeated-sweep state machine and centralized realistic default
issue states in the network fixture.
