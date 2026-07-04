# Test Definitions: Artifact precedence — the behavior chain is earned, not ticked

Feature source: `features/artifact-precedence-gate.feature`

test-definitions.md is the R/G/R ledger. Scenario names mirror the feature source; lineage lives in its `@artifact-precedence-gate.*` tags.

## Rule: An artifact cannot be created before its prerequisites are complete

### Scenario: spec.md created in a folder with no ticket.md is denied

- [x] RED e66dc54
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: spec.md created alongside an existing ticket.md is allowed

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: spec.md created late on a ticket already past intake is allowed

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: dimensions.md created before spec.md exists is denied

- [x] RED e66dc54
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: dimensions.md created on a spec with no resolvable job is denied

- [x] RED e66dc54
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: dimensions.md created at phase intake before the spec is complete is denied

- [x] RED e66dc54
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: dimensions.md created at phase intake on a complete spec is allowed

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: dimensions.md created on a spec whose job lacks acceptance criteria is denied

- [x] RED e66dc54
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: dimensions.md created on a complete spec is allowed

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: dimensions.md created on a spec carrying a deliberate jobs skip is allowed

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: dimensions.md created on a spec whose jobs skip has a blank reason is denied

- [x] RED e66dc54
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Non-feature tickets create dimensions.md without objection

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A ticket.md with no type field creates dimensions.md without objection

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

## Rule: Scenarios build only on a reviewed spec

### Scenario: Scenario authoring with no spec review stamp is denied even with the review gate flag off

- [x] RED e66dc54
- [x] GREEN 1bd3fb6
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Scenario authoring with a review stamp at the spec's current content is allowed

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 1bd3fb6
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A spec edited after its review no longer satisfies the demand

- [x] RED e66dc54
- [x] GREEN 1bd3fb6
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A logged review skip with a reason satisfies the demand

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 1bd3fb6
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A logged review skip with an empty reason does not satisfy the demand

- [x] RED e66dc54
- [x] GREEN 1bd3fb6
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Another ticket's review stamp does not satisfy even at identical spec content

- [x] RED e66dc54
- [x] GREEN 1bd3fb6
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Scenario authoring at phase scenario-gate demands the spec review the same way

- [x] RED e66dc54
- [x] GREEN 1bd3fb6
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Scenario authoring at phase scenario-gate with a current stamp is allowed

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 1bd3fb6
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Task tickets author test definitions without a spec review stamp

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

## Rule: Implementation starts only on independently reviewed scenarios

### Scenario: Advancing into implement with no scenario review stamp is denied

- [x] RED e66dc54
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Advancing into implement with a scenario review stamp at current content is allowed

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Scenarios edited after their review no longer satisfy the demand

- [x] RED e66dc54
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: The scenario review binds to the feature source when the ledger names one

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: The scenario review binds to the ledger when no feature source is named

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A logged scenario review skip with a reason satisfies the demand

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A logged scenario review skip with an empty reason does not satisfy the demand

- [x] RED e66dc54
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A ledger stamp does not satisfy when the ledger names a feature source

- [x] RED e66dc54
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Another ticket's stamp on the named feature source does not satisfy

- [x] RED e66dc54
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: An unreadable feature source falls back to the ledger and still denies

- [x] RED 1935b5f
- [x] GREEN 1935b5f
- [x] REFACTOR skip: crash-to-fail-open fix from whole-ticket review; RED (allow) verified in-session before the src fix, GREEN in the same commit — no separate refactor

### Scenario: An implement advance via MultiEdit is gated like an Edit

- [x] RED e66dc54
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A phase_skips justification covering scenario-gate satisfies the demand

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A phase_skips entry for a different phase does not satisfy the demand

- [x] RED e66dc54
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Advancing into implement with no scenario artifact is denied naming the artifact first

- [x] RED e66dc54
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Non-feature tickets advance into implement without objection

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

## Rule: Every denial names the earliest missing prerequisite and the forward next action

### Scenario: With both spec.md and dimensions.md missing the denial names spec.md first

- [x] RED e66dc54
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: With spec.md complete and dimensions.md missing the denial names dimensions.md

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Precedence denials carry the ordered-patch recovery note

- [x] RED e66dc54
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

## Rule: Rework and routine writes stay cheap — the gates never block them

### Scenario: Editing an existing dimensions.md under an incomplete spec is allowed

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Editing an existing test-definitions.md without a spec review stamp is allowed

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 1bd3fb6
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A file that is not a chain artifact is created in a ticket folder without objection

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A ticket.md edit that does not change phase is ignored by the review demand

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Moving backward out of implement is allowed without any stamp

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: Advancing from implement to verify demands no scenario review stamp

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN 8da8646
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A spec.md outside the tickets namespace is ignored

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

### Scenario: A dimensions.md outside the tickets namespace is ignored

- [x] RED skip: allow-pin characterization, green at author time with no failing state
- [x] GREEN b6401a8
- [x] REFACTOR skip: no post-green refactor for this scenario; structural prep done pre-impl (282b395, 743284d), cross-scenario pass below

## Feature-level cross-scenario refactor

- [x] Whole-ticket pass 8da8646 — structural prep was front-loaded as two behavior-preserving extracts before implementation (282b395 shared ticket-write context for the gate family; 743284d extracted the test-definitions creation chain), so no post-green cross-scenario refactor commit was required; the pure logic lives in one lib/artifact-precedence.ts with no duplication across the three rules. Whole-ticket /quality-review recorded in the work log.
