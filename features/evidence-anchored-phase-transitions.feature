@evidence-anchored-phase-transitions
Feature: Evidence-anchored phase transitions — a feature ticket's phase advance carries a commit-SHA anchor

  A forward phase advance in a feature ticket records a per-phase commit-SHA
  anchor (a `phase_anchors` entry), mirroring the R/G/R ledger's SHA-per-tick.
  A pure detector reports whether the entered phase carries a valid anchor:
  format-only when no git resolver is supplied, plus HEAD-reachability when one
  is (a stub in tests; the rebase-aware resolver in #810). #809 is substrate
  only — the detector is what epic #808's boundary gate (#810) consumes; nothing
  here blocks a write. Detection fires only on a feature ticket's forward
  advance; backward moves, re-declarations, non-feature tickets, births into
  feature, and tickets at rest are never flagged (the gate polices transitions,
  not history).

  Rule: A forward phase advance carrying a valid anchor for the entered phase is recognized as anchored

    @evidence-anchored-phase-transitions.SM1.AC1
    Scenario: Forward advance with a well-formed anchor for the entered phase is anchored
      Given a feature ticket at phase define-behavior
      When it advances to implement recording a well-formed commit-SHA anchor for implement
      Then the advance is recognized as anchored

    @evidence-anchored-phase-transitions.SM1.AC1
    Scenario: Only the entered phase needs an anchor on a multi-step advance
      Given a feature ticket at phase define-behavior
      When it advances two steps to verify recording a well-formed anchor for verify only
      Then the advance is recognized as anchored

    @evidence-anchored-phase-transitions.SM1.AC1
    Scenario: A rebased anchor that canonicalizes to a reachable commit is anchored
      Given a feature ticket at phase define-behavior
      And a stubbed commit resolver that canonicalizes the anchor to a different commit reachable from HEAD
      When it advances to implement recording that rebased anchor for implement
      Then the advance is recognized as anchored

  Rule: A forward phase advance without a valid anchor for the entered phase is flagged as unanchored

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: Forward advance with no phase_anchors block at all is flagged
      Given a feature ticket at phase define-behavior
      When it advances to implement with no phase_anchors block recorded
      Then the advance is flagged as unanchored

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: Forward advance whose phase_anchors block names only an earlier phase is flagged
      Given a feature ticket at phase define-behavior
      When it advances to implement with a phase_anchors block naming only define-behavior
      Then the advance is flagged as unanchored

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: Forward advance whose anchor is not hex is flagged
      Given a feature ticket at phase define-behavior
      When it advances to implement recording a non-hex anchor for implement
      Then the advance is flagged as unanchored

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: Forward advance whose anchor value is empty is flagged
      Given a feature ticket at phase define-behavior
      When it advances to implement recording an empty anchor value for implement
      Then the advance is flagged as unanchored

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: Forward advance whose anchor is not reachable from HEAD is flagged under git resolution
      Given a feature ticket at phase define-behavior
      And a stubbed commit resolver that reports the anchor as not reachable from HEAD
      When it advances to implement recording that unreachable anchor for implement
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
    Scenario Outline: A non-feature ticket advancing is not flagged
      Given a <type> ticket at phase define-behavior
      When it advances to implement with no anchor
      Then the advance is not flagged

      Examples:
        | type  |
        | task  |
        | patch |
        | epic  |
        | none  |

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: A ticket becoming a feature past intake is not flagged
      Given a task ticket at phase implement with no anchors recorded
      When its type is changed to feature without changing the phase
      Then the advance is not flagged

    @evidence-anchored-phase-transitions.SM1.AC2
    Scenario: An edit that leaves the phase unchanged is not flagged
      Given a feature ticket at phase implement with no anchors recorded
      When its body is edited without changing the phase
      Then the advance is not flagged
