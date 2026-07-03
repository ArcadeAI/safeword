@artifact-precedence-gate
Feature: Artifact precedence — the behavior chain is earned, not ticked

  The PreTool gate enforces authoring order and content review across a
  feature ticket's behavior artifacts (#644 G1). Creation gates walk forward:
  spec.md needs ticket.md; dimensions.md needs a JTBD/AC-complete spec.md;
  test-definitions.md needs all of the above plus a review stamp for spec.md
  at its current content; advancing into implement needs an independent
  review stamp for the scenarios at their current content. Denials name the
  earliest missing prerequisite. Edits to existing artifacts, non-feature
  tickets, and tickets at rest are never touched — the gates police creation
  and transition, not history.

  Rule: An artifact cannot be created before its prerequisites are complete

    @artifact-precedence-gate.NTB1.AC1
    Scenario: spec.md created in a folder with no ticket.md is denied
      Given a ticket folder with no ticket.md
      When a spec.md is written in that ticket folder
      Then the write is denied
      And the denial names ticket.md as the artifact to create first

    @artifact-precedence-gate.NTB1.AC1
    Scenario: spec.md created alongside an existing ticket.md is allowed
      Given a feature ticket.md at phase intake
      When a spec.md is written in that ticket folder
      Then the write is allowed

    @artifact-precedence-gate.NTB1.AC1
    Scenario: dimensions.md created before spec.md exists is denied
      Given a feature ticket.md at phase define-behavior and no spec.md
      When a dimensions.md is written in that ticket folder
      Then the write is denied
      And the denial names spec.md as the artifact to author first

    @artifact-precedence-gate.NTB1.AC1
    Scenario: dimensions.md created on a spec with no resolvable job is denied
      Given a feature ticket.md at phase define-behavior
      And a spec.md whose Jobs To Be Done section is empty
      When a dimensions.md is written in that ticket folder
      Then the write is denied
      And the denial explains that spec.md needs a Job To Be Done or a skip reason before dimensions

    @artifact-precedence-gate.NTB1.AC1
    Scenario: dimensions.md created at phase intake before the spec is complete is denied
      Given a feature ticket.md at phase intake
      And a spec.md whose Jobs To Be Done section is empty
      When a dimensions.md is written in that ticket folder
      Then the write is denied
      And the denial explains that spec.md needs a Job To Be Done or a skip reason before dimensions

    @artifact-precedence-gate.NTB1.AC1
    Scenario: dimensions.md created on a spec whose job lacks acceptance criteria is denied
      Given a feature ticket.md at phase define-behavior
      And a spec.md with a resolvable Job To Be Done but no Acceptance Criterion under it
      When a dimensions.md is written in that ticket folder
      Then the write is denied
      And the denial explains that every Job To Be Done needs an Acceptance Criterion or a skip reason

    @artifact-precedence-gate.NTB1.AC1
    Scenario: dimensions.md created on a complete spec is allowed
      Given a feature ticket.md at phase define-behavior
      And a spec.md whose Jobs To Be Done and Acceptance Criteria are complete
      When a dimensions.md is written in that ticket folder
      Then the write is allowed

    @artifact-precedence-gate.NTB1.AC1
    Scenario: dimensions.md created on a spec carrying a deliberate jobs skip is allowed
      Given a feature ticket.md at phase define-behavior
      And a spec.md whose Jobs To Be Done section is a skip with a reason
      When a dimensions.md is written in that ticket folder
      Then the write is allowed

    @artifact-precedence-gate.NTB1.AC1
    Scenario: dimensions.md created on a spec whose jobs skip has a blank reason is denied
      Given a feature ticket.md at phase define-behavior
      And a spec.md whose Jobs To Be Done section is a skip with a blank reason
      When a dimensions.md is written in that ticket folder
      Then the write is denied
      And the denial explains that spec.md needs a Job To Be Done or a skip reason before dimensions

    @artifact-precedence-gate.NTB1.AC1
    Scenario Outline: Non-feature tickets create dimensions.md without objection
      Given a <type> ticket.md at phase define-behavior and no spec.md
      When a dimensions.md is written in that ticket folder
      Then the write is allowed

      Examples:
        | type  |
        | task  |
        | patch |
        | epic  |

    @artifact-precedence-gate.NTB1.AC1
    Scenario: A ticket.md with no type field creates dimensions.md without objection
      Given a ticket.md with no type field at phase define-behavior and no spec.md
      When a dimensions.md is written in that ticket folder
      Then the write is allowed

  Rule: Scenarios build only on a reviewed spec

    @artifact-precedence-gate.NTB1.AC2
    Scenario: Scenario authoring with no spec review stamp is denied even with the review gate flag off
      Given a feature ticket.md at phase define-behavior with a complete spec.md and dimensions.md
      And the reviewGate config flag is off
      And no review stamp exists for the ticket's spec.md
      When a test-definitions.md is written in that ticket folder
      Then the write is denied
      And the denial explains that spec.md must be reviewed at its current content before scenarios
      And the denial names self-review or a logged skip as the way forward

    @artifact-precedence-gate.NTB1.AC2
    Scenario: Scenario authoring with a review stamp at the spec's current content is allowed
      Given a feature ticket.md at phase define-behavior with a complete spec.md and dimensions.md
      And a review stamp exists for the ticket's spec.md at its current content
      When a test-definitions.md is written in that ticket folder
      Then the write is allowed

    @artifact-precedence-gate.NTB1.AC2
    Scenario: A spec edited after its review no longer satisfies the demand
      Given a feature ticket.md at phase define-behavior with a complete spec.md and dimensions.md
      And a review stamp exists for an earlier content of the ticket's spec.md
      When a test-definitions.md is written in that ticket folder
      Then the write is denied
      And the denial explains that the spec review is stale because the spec changed after it

    @artifact-precedence-gate.NTB1.AC2
    Scenario: A logged review skip with a reason satisfies the demand
      Given a feature ticket.md at phase define-behavior with a complete spec.md and dimensions.md
      And a logged review skip with a reason exists for the ticket's spec.md at its current content
      When a test-definitions.md is written in that ticket folder
      Then the write is allowed

    @artifact-precedence-gate.NTB1.AC2
    Scenario: A logged review skip with an empty reason does not satisfy the demand
      Given a feature ticket.md at phase define-behavior with a complete spec.md and dimensions.md
      And a logged review skip with a blank reason exists for the ticket's spec.md at its current content
      When a test-definitions.md is written in that ticket folder
      Then the write is denied
      And the denial explains that spec.md must be reviewed at its current content before scenarios

    @artifact-precedence-gate.NTB1.AC2
    Scenario: Another ticket's review stamp does not satisfy even at identical spec content
      Given a feature ticket.md at phase define-behavior with a complete spec.md and dimensions.md
      And a review stamp exists for a different ticket's spec.md at identical content
      When a test-definitions.md is written in that ticket folder
      Then the write is denied

    @artifact-precedence-gate.NTB1.AC2
    Scenario: Scenario authoring at phase scenario-gate demands the spec review the same way
      Given a feature ticket.md at phase scenario-gate with a complete spec.md and dimensions.md
      And no review stamp exists for the ticket's spec.md
      When a test-definitions.md is written in that ticket folder
      Then the write is denied
      And the denial explains that spec.md must be reviewed at its current content before scenarios

    @artifact-precedence-gate.NTB1.AC2
    Scenario: Task tickets author test definitions without a spec review stamp
      Given a task ticket.md at phase define-behavior
      When a test-definitions.md is written in that ticket folder
      Then the write is allowed

  Rule: Implementation starts only on independently reviewed scenarios

    @artifact-precedence-gate.NTB1.AC3
    Scenario: Advancing into implement with no scenario review stamp is denied
      Given a feature ticket.md at phase scenario-gate with saved scenarios
      And the reviewGate config flag is off
      And no review stamp exists for the ticket's scenarios
      When the ticket.md is edited to phase implement
      Then the write is denied
      And the denial explains that the scenarios need an independent review at their current content
      And the denial names review-spec or a logged skip as the way forward

    @artifact-precedence-gate.NTB1.AC3
    Scenario: Advancing into implement with a scenario review stamp at current content is allowed
      Given a feature ticket.md at phase scenario-gate with saved scenarios
      And a review stamp exists for the ticket's scenarios at their current content
      When the ticket.md is edited to phase implement
      Then the write is allowed

    @artifact-precedence-gate.NTB1.AC3
    Scenario: Scenarios edited after their review no longer satisfy the demand
      Given a feature ticket.md at phase scenario-gate with saved scenarios
      And a review stamp exists for an earlier content of the ticket's scenarios
      When the ticket.md is edited to phase implement
      Then the write is denied
      And the denial explains that the scenario review is stale because the scenarios changed after it

    @artifact-precedence-gate.NTB1.AC3
    Scenario: The scenario review binds to the feature source when the ledger names one
      Given a feature ticket.md at phase scenario-gate whose test-definitions.md names a feature source file
      And a review stamp recorded for this ticket exists for that feature source file at its current content
      When the ticket.md is edited to phase implement
      Then the write is allowed

    @artifact-precedence-gate.NTB1.AC3
    Scenario: The scenario review binds to the ledger when no feature source is named
      Given a feature ticket.md at phase scenario-gate whose test-definitions.md names no feature source file
      And a review stamp exists for the test-definitions.md at its current content
      When the ticket.md is edited to phase implement
      Then the write is allowed

    @artifact-precedence-gate.NTB1.AC3
    Scenario: A logged scenario review skip with a reason satisfies the demand
      Given a feature ticket.md at phase scenario-gate with saved scenarios
      And a logged review skip with a reason exists for the ticket's scenarios at their current content
      When the ticket.md is edited to phase implement
      Then the write is allowed

    @artifact-precedence-gate.NTB1.AC3
    Scenario: A logged scenario review skip with an empty reason does not satisfy the demand
      Given a feature ticket.md at phase scenario-gate with saved scenarios
      And a logged review skip with a blank reason exists for the ticket's scenarios at their current content
      When the ticket.md is edited to phase implement
      Then the write is denied
      And the denial explains that the scenarios need an independent review at their current content

    @artifact-precedence-gate.NTB1.AC3
    Scenario: A ledger stamp does not satisfy when the ledger names a feature source
      Given a feature ticket.md at phase scenario-gate whose test-definitions.md names a feature source file
      And a review stamp exists for the test-definitions.md at its current content
      And no review stamp exists for the feature source file
      When the ticket.md is edited to phase implement
      Then the write is denied
      And the denial explains that the scenarios need an independent review at their current content

    @artifact-precedence-gate.NTB1.AC3
    Scenario: Another ticket's stamp on the named feature source does not satisfy
      Given a feature ticket.md at phase scenario-gate whose test-definitions.md names a feature source file
      And a review stamp recorded for a different ticket exists for that feature source file at its current content
      When the ticket.md is edited to phase implement
      Then the write is denied
      And the denial explains that the scenarios need an independent review at their current content

    @artifact-precedence-gate.NTB1.AC3
    Scenario: An implement advance via MultiEdit is gated like an Edit
      Given a feature ticket.md at phase scenario-gate with saved scenarios
      And no review stamp exists for the ticket's scenarios
      When the ticket.md is MultiEdited to phase implement
      Then the write is denied
      And the denial explains that the scenarios need an independent review at their current content

    @artifact-precedence-gate.NTB1.AC3
    Scenario: A phase_skips justification covering scenario-gate satisfies the demand
      Given a feature ticket.md at phase intake and no test-definitions.md
      When the ticket.md is edited to phase implement and phase_skips entries with reasons for define-behavior and scenario-gate
      Then the write is allowed

    @artifact-precedence-gate.NTB1.AC3
    Scenario: A phase_skips entry for a different phase does not satisfy the demand
      Given a feature ticket.md at phase scenario-gate with saved scenarios
      And the ticket.md carries a phase_skips entry with a reason for intake
      And no review stamp exists for the ticket's scenarios
      When the ticket.md is edited to phase implement
      Then the write is denied
      And the denial explains that the scenarios need an independent review at their current content

    @artifact-precedence-gate.NTB1.AC3
    Scenario: Advancing into implement with no scenario artifact is denied naming the artifact first
      Given a feature ticket.md at phase scenario-gate and no test-definitions.md
      When the ticket.md is edited to phase implement
      Then the write is denied
      And the denial names test-definitions.md as the artifact to create first

    @artifact-precedence-gate.NTB1.AC3
    Scenario: Non-feature tickets advance into implement without objection
      Given a task ticket.md at phase scenario-gate
      When the ticket.md is edited to phase implement
      Then the write is allowed

  Rule: Every denial names the earliest missing prerequisite and the forward next action

    @artifact-precedence-gate.TB1.AC1
    Scenario: With both spec.md and dimensions.md missing the denial names spec.md first
      Given a feature ticket.md at phase define-behavior with no spec.md and no dimensions.md
      When a test-definitions.md is written in that ticket folder
      Then the write is denied
      And the denial names spec.md as the artifact to author first
      And the denial does not demand dimensions.md before spec.md

    @artifact-precedence-gate.TB1.AC1
    Scenario: With spec.md complete and dimensions.md missing the denial names dimensions.md
      Given a feature ticket.md at phase define-behavior with a complete spec.md and no dimensions.md
      When a test-definitions.md is written in that ticket folder
      Then the write is denied
      And the denial names dimensions.md as the artifact to author next

    @artifact-precedence-gate.TB1.AC1
    Scenario: Precedence denials carry the ordered-patch recovery note
      Given a feature ticket.md at phase define-behavior and no spec.md
      When a dimensions.md is written in that ticket folder
      Then the write is denied
      And the denial includes the ordered-patch note about pre-edit-state evaluation

  Rule: Rework and routine writes stay cheap — the gates never block them

    @artifact-precedence-gate.TB1.AC2
    Scenario: Editing an existing dimensions.md under an incomplete spec is allowed
      Given a feature ticket.md at phase define-behavior with an existing dimensions.md
      And a spec.md whose Jobs To Be Done section is empty
      When the existing dimensions.md is edited
      Then the write is allowed

    @artifact-precedence-gate.TB1.AC2
    Scenario: Editing an existing test-definitions.md without a spec review stamp is allowed
      Given a feature ticket.md at phase implement with an existing test-definitions.md
      And no review stamp exists for the ticket's spec.md
      When the existing test-definitions.md is edited
      Then the write is allowed

    @artifact-precedence-gate.TB1.AC2
    Scenario: A file that is not a chain artifact is created in a ticket folder without objection
      Given a feature ticket.md at phase define-behavior and no spec.md
      When a notes.md is written in that ticket folder
      Then the write is allowed

    @artifact-precedence-gate.TB1.AC2
    Scenario: A ticket.md edit that does not change phase is ignored by the review demand
      Given a feature ticket.md at phase scenario-gate with saved scenarios
      And no review stamp exists for the ticket's scenarios
      When the ticket.md is edited without changing its phase field
      Then the write is allowed

    @artifact-precedence-gate.TB1.AC2
    Scenario: Moving backward out of implement is allowed without any stamp
      Given a feature ticket.md at phase implement
      And no review stamp exists for the ticket's scenarios
      When the ticket.md is edited to phase define-behavior
      Then the write is allowed

    @artifact-precedence-gate.TB1.AC2
    Scenario: Advancing from implement to verify demands no scenario review stamp
      Given a feature ticket.md at phase implement
      And no review stamp exists for the ticket's scenarios
      When the ticket.md is edited to phase verify
      Then the write is allowed

    @artifact-precedence-gate.TB1.AC2
    Scenario: A spec.md outside the tickets namespace is ignored
      Given a project folder that is not under the tickets namespace
      When a spec.md is written in that project folder
      Then the write is allowed

    @artifact-precedence-gate.TB1.AC2
    Scenario: A dimensions.md outside the tickets namespace is ignored
      Given a project folder that is not under the tickets namespace
      When a dimensions.md is written in that project folder
      Then the write is allowed
