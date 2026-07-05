@evidence-anchored-phase-transitions
Feature: Evidence-anchored phase transitions — a feature ticket's phase advance carries a commit-SHA anchor

  A forward phase advance in a feature ticket records a per-phase commit-SHA
  anchor (a `phase_anchors` entry), mirroring the R/G/R ledger's SHA-per-tick.
  A pure detector reports whether the entered phase carries a valid anchor:
  format-only when no git resolver is supplied, plus HEAD-reachability when one
  is. #809 is substrate only — the detector is what epic #808's boundary gate
  (#810) consumes; nothing here blocks a write. Detection fires only on a
  feature ticket's forward advance; backward moves, re-declarations, non-feature
  tickets, and tickets at rest are never flagged (the gate polices transitions,
  not history).

  Rule: A forward phase advance carrying a valid anchor is recognized as anchored

    @evidence-anchored-phase-transitions.SM1.AC1
    Scenario: Forward advance with a well-formed anchor for the entered phase is anchored
      Given a feature ticket at phase define-behavior
      When it advances to implement recording a well-formed commit-SHA anchor for implement
      Then the advance is recognized as anchored

    @evidence-anchored-phase-transitions.SM1.AC1
    Scenario: Forward advance with a HEAD-reachable anchor is anchored under git resolution
      Given a feature ticket at phase define-behavior
      And commit reachability is resolved against git history
      When it advances to implement recording an anchor reachable from HEAD
      Then the advance is recognized as anchored

  Rule: A forward phase advance without a valid anchor is flagged as unanchored

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: Forward advance with no anchor recorded is flagged
      Given a feature ticket at phase define-behavior
      When it advances to implement with no anchor recorded for implement
      Then the advance is flagged as unanchored

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: Forward advance whose anchor is malformed is flagged
      Given a feature ticket at phase define-behavior
      When it advances to implement recording a malformed anchor for implement
      Then the advance is flagged as unanchored

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: Forward advance whose anchor names the wrong phase is flagged
      Given a feature ticket at phase define-behavior
      When it advances to implement recording an anchor only for define-behavior
      Then the advance is flagged as unanchored

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: Forward advance whose anchor is not reachable from HEAD is flagged under git resolution
      Given a feature ticket at phase define-behavior
      And commit reachability is resolved against git history
      When it advances to implement recording an anchor that is not reachable from HEAD
      Then the advance is flagged as unanchored

  Rule: The detector fires only on a feature ticket's forward advance

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: A backward phase move is not flagged
      Given a feature ticket at phase implement
      When it moves back to define-behavior with no anchor
      Then the advance is not flagged

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: Re-declaring the same phase is not flagged
      Given a feature ticket at phase implement
      When it is re-saved at phase implement with no new anchor
      Then the advance is not flagged

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: A non-feature ticket advancing is not flagged
      Given a task ticket at phase define-behavior
      When it advances to implement with no anchor
      Then the advance is not flagged

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: An edit that leaves the phase unchanged is not flagged
      Given a feature ticket at phase implement with no anchors recorded
      When its body is edited without changing the phase
      Then the advance is not flagged
