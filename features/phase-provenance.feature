@phase-provenance
Feature: Phase provenance — feature tickets are born at intake and advance one phase at a time

  A feature ticket's phase field must be earned, not declared (#644 G2). The
  pre-tool gate validates ticket.md writes: birth past intake, forward jumps,
  and off-enum phase names are denied unless every skipped phase carries a
  per-phase phase_skips justification. Backward moves, non-feature tickets,
  and tickets at rest are never touched — the gate polices transitions, not
  history.

  Rule: A feature ticket cannot silently begin life past intake

    @phase-provenance.NTB1.AC1
    Scenario: Born one phase past intake is denied
      Given a ticket folder with no ticket.md
      When a feature ticket.md is written with phase define-behavior and no phase_skips
      Then the write is denied
      And the denial explains that feature tickets start at intake and names phase_skips as the deliberate alternative

    @phase-provenance.NTB1.AC1
    Scenario: Born at intake is allowed
      Given a ticket folder with no ticket.md
      When a feature ticket.md is written with phase intake
      Then the write is allowed

    @phase-provenance.NTB1.AC1
    Scenario: Born with no phase recorded is allowed
      Given a ticket folder with no ticket.md
      When a feature ticket.md is written with no phase field
      Then the write is allowed

    @phase-provenance.NTB1.AC1
    Scenario Outline: Non-feature tickets are born at any phase without objection
      Given a ticket folder with no ticket.md
      When a <type> ticket.md is written with phase implement
      Then the write is allowed

      Examples:
        | type  |
        | task  |
        | patch |
        | epic  |

  Rule: A deliberate phase skip is explicit, per-phase, and stays visible in the ticket

    @phase-provenance.NTB1.AC2
    Scenario: Born past intake with every skipped phase justified is allowed
      Given a ticket folder with no ticket.md
      When a feature ticket.md is written with phase implement and phase_skips entries with reasons for intake, define-behavior, and scenario-gate
      Then the write is allowed

    @phase-provenance.NTB1.AC2
    Scenario: A partial justification is denied naming only the unjustified phases
      Given a ticket folder with no ticket.md
      When a feature ticket.md is written with phase implement and a phase_skips entry with a reason for intake only
      Then the write is denied
      And the denial names define-behavior and scenario-gate as the phases still needing justification
      And the denial does not name intake

    @phase-provenance.NTB1.AC2
    Scenario: A justification with an empty reason is denied
      Given a ticket folder with no ticket.md
      When a feature ticket.md is written with phase define-behavior and a phase_skips entry for intake whose reason is blank
      Then the write is denied
      And the denial explains that a skip requires a non-empty reason

  Rule: Phases advance one canonical step at a time

    @phase-provenance.TB1.AC1
    Scenario: Advancing one canonical step is allowed
      Given a feature ticket.md at phase intake
      When the ticket.md is edited to phase define-behavior
      Then the write is allowed

    @phase-provenance.TB1.AC1
    Scenario: A forward jump is denied naming every skipped phase
      Given a feature ticket.md at phase intake
      When the ticket.md is edited to phase implement with no phase_skips
      Then the write is denied
      And the denial names define-behavior and scenario-gate as the skipped phases

    @phase-provenance.TB1.AC1
    Scenario: A forward jump with every skipped phase justified is allowed
      Given a feature ticket.md at phase intake
      When the ticket.md is edited to phase implement and phase_skips entries with reasons for define-behavior and scenario-gate
      Then the write is allowed

  Rule: Rework stays cheap — moving backward is never blocked

    @phase-provenance.TB1.AC2
    Scenario: Moving backward for rework is allowed
      Given a feature ticket.md at phase implement
      When the ticket.md is edited to phase define-behavior
      Then the write is allowed

  Rule: Off-sequence phase names cannot smuggle past the gate

    @phase-provenance.TB1.AC3
    Scenario: Born at an unrecognized phase is denied
      Given a ticket folder with no ticket.md
      When a feature ticket.md is written with phase shape
      Then the write is denied
      And the denial lists the canonical phases

    @phase-provenance.TB1.AC3
    Scenario: Advancing into an unrecognized phase is denied
      Given a feature ticket.md at phase implement
      When the ticket.md is edited to phase shipped
      Then the write is denied
      And the denial lists the canonical phases

    @phase-provenance.TB1.AC3
    Scenario: A ticket already carrying an unrecognized phase advances as if from intake
      Given a feature ticket.md at phase research
      When the ticket.md is edited to phase define-behavior
      Then the write is allowed

    @phase-provenance.TB1.AC3
    Scenario: An edit that leaves an unrecognized phase untouched is ignored by the gate
      Given a feature ticket.md at phase research
      When the ticket.md is edited without changing its phase field
      Then the write is allowed
