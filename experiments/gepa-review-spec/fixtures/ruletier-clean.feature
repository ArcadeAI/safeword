Feature: Numbered Rule tier
  safeword lets a JTBD carry numbered Rules in place of ACs, and its checks
  understand the tier.

  Scenario: A rule reference whose JTBD is absent is reported orphan
    Given a feature scenario referencing a rule under a JTBD absent from the spec
    When safeword check runs
    Then an orphan advisory names that rule reference

  Scenario: A JTBD declaring numbered Rules and no ACs passes the intake-exit gate
    Given a ticket spec whose JTBD declares numbered Rules and no ACs
    When the intake-exit gate evaluates test-definitions creation
    Then the gate allows the creation

  Scenario: A JTBD with neither ACs nor Rules nor a skip line is denied
    Given a ticket spec whose JTBD declares no ACs, no Rules, and no skip line
    When the intake-exit gate evaluates test-definitions creation
    Then the gate denies the creation
