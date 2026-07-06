# Test Definitions: Phase transitions stamp the ticket work log with real time

Feature source: `features/phase-work-log-stamp.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A phase transition that lands gains exactly one real-time work-log line

### Scenario: An Edit that advances the phase appends one stamped line

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A MultiEdit carrying a phase change among other edits appends one stamped line

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A backward phase move is stamped like any transition

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The stamp is a pure append — frontmatter and body survive

### Scenario: Everything but the appended line is byte-identical

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ticket without a Work Log section gains one before the entry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Edits that are not phase transitions leave the work log untouched

### Scenario: A ticket.md edit that does not touch phase adds no stamp

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Re-declaring the same phase adds no stamp

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Files that are not a tickets-namespace ticket.md are never stamped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A full-file Write rewrite is a documented no-op

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: No bdd phase file instructs fabricating a timestamp

### Scenario: The bdd phase files carry no fabricated-timestamp transition template

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
