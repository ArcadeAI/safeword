# Test Definitions: Quiet Expected Negative-Path Test Output

> **Retrospective ledger — not a per-step record.** These RED/GREEN/REFACTOR
> boxes were filled in after the fact: the file entered git history already
> ticked, with no per-step commit SHAs. Do not cite this ledger as precedent
> for R/G/R bookkeeping (issue #644 G8; per-step enforcement is G3 + G5).

## Rule: Expected diagnostics are captured

### Scenario: GJGSS3.QT1.R1.duplicate_ticket_warning_is_asserted_without_leaking

Given two active ticket folders resolve to the same ticket ID
When the active-ticket lookup runs inside the unit test
Then the test captures the ambiguity warning from stderr
And the lookup still returns empty details instead of picking a folder

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: GJGSS3.QT1.R2.formatter_commands_do_not_stream_success_output

Given golden-path integration tests run external formatters
When the formatter command succeeds
Then stdout and stderr are piped instead of inherited by the test process
And the test continues to assert the formatted file contents

- [x] RED
- [x] GREEN
- [x] REFACTOR
