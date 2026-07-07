# Test Definitions: Phase transitions stamp the ticket work log with real time

Feature source: `features/phase-work-log-stamp.feature`

test-definitions.md is the R/G/R ledger.

## Rule: A phase transition that lands gains exactly one real-time work-log line

### Scenario: An Edit that advances the phase appends one stamped line

- [x] RED skip: failure observed in-session (hook absent → no stamp, 2 integration tests red); a RED commit is blocked by pre-commit lint on the unresolved lib import, so RED and GREEN land in one commit
- [x] GREEN 9882373
- [x] REFACTOR skip: anchor landed on the post-tool-lint observer skeleton; nothing to restructure

### Scenario: A MultiEdit carrying a phase change among other edits appends one stamped line

- [x] RED skip: same one-commit constraint as the anchor; unit red observed in-session (module unresolvable)
- [x] GREEN 9882373
- [x] REFACTOR skip: pure payload scan, nothing to restructure

### Scenario: A backward phase move is stamped like any transition

- [x] RED skip: same one-commit constraint; covered by the unit red (module unresolvable)
- [x] GREEN 9882373
- [x] REFACTOR skip: same detector path as the anchor

## Rule: The stamp is a pure append — frontmatter and body survive

### Scenario: Everything but the appended line is byte-identical

- [x] RED skip: same one-commit constraint; unit red observed in-session
- [x] GREEN 9882373
- [x] REFACTOR skip: three-line append helper, nothing to restructure

### Scenario: A ticket without a Work Log section gains one before the entry

- [x] RED skip: same one-commit constraint; unit red observed in-session
- [x] GREEN 9882373
- [x] REFACTOR skip: same helper as above

## Rule: Edits that are not phase transitions leave the work log untouched

### Scenario: A ticket.md edit that does not touch phase adds no stamp

- [x] RED skip: allow-side precision pin — the hook is correctly silent here, so the test passes on first run by design (guards future over-stamping)
- [x] GREEN 9882373
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: Re-declaring the same phase adds no stamp

- [x] RED skip: allow-side precision pin — passes on first run by design
- [x] GREEN 9882373
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: Files that are not a tickets-namespace ticket.md are never stamped

- [x] RED skip: allow-side precision pin — passes on first run by design (scope filter)
- [x] GREEN 9882373
- [x] REFACTOR skip: pin test, nothing to restructure

### Scenario: A full-file Write rewrite is a documented no-op

- [x] RED skip: allow-side precision pin — the documented detection limit, pinned so it can't silently change
- [x] GREEN 9882373
- [x] REFACTOR skip: pin test, nothing to restructure

## Rule: No bdd phase file instructs fabricating a timestamp

### Scenario: The bdd phase files carry no fabricated-timestamp transition template

- [x] RED skip: genuine red observed in-session (all four files failed the scan before the trim); same one-commit constraint as the code slices
- [x] GREEN 9882373
- [x] REFACTOR skip: doc-content test + prose trim, nothing to restructure
