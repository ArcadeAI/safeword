@wip
Feature: Keep advisory reviews current without repeated noise

  @advisory-freshness.TBU1.R1 @surface.safeword-cli @surface.github-pull-request-review
  Rule: advisory-freshness.TBU1.R1 — Inert exclusions and no-review outcomes carry explicit evidence

    @rejection
    Scenario: An excluded artifact records why it is inert
      Given a changed artifact is generated, vendored, binary-only, or otherwise inert
      When Safeword excludes it from substantive review
      Then the receipt records the artifact and evidence supporting the exclusion

    @rejection @surface.github-pull-request-conversation
    Scenario: An all-inert change set produces an evidence-rich no-review receipt
      Given every changed artifact has recorded inert evidence
      When Safeword evaluates the current head
      Then no model review or advisory route is produced
      And the receipt records the revision, classifications, skipped checks, unknowns, and usage or noise not incurred

  @advisory-freshness.TBU1.R2 @surface.safeword-cli @surface.github-pull-request-review
  Rule: advisory-freshness.TBU1.R2 — Only proven immaterial updates may reuse a prior conclusion

    Scenario: A proven immaterial update creates an explicit freshness bridge
      Given revision A has a current receipt
      And evidence proves revision B changes neither reviewed behavior nor support for the conclusion
      When Safeword evaluates revision B
      Then no new model review runs
      And the receipt names both revisions and the evidence supporting reuse

    @rejection
    Scenario: Uncertain materiality forces a fresh review
      Given evidence cannot prove revision B is immaterial to revision A's conclusion
      When Safeword evaluates revision B
      Then revision A is no longer current
      And revision B requires a fresh review

  @advisory-freshness.TBU1.R3 @surface.github-pull-request-review
  Rule: advisory-freshness.TBU1.R3 — Finding identity suppresses unchanged noise and removes resolved findings

    @rejection
    Scenario Outline: Cross-revision finding lifecycle reflects current evidence
      Given revision A published a finding
      And revision B <evidence-change>
      When Safeword publishes revision B
      Then the finding is <current-treatment>

      Examples:
        | evidence-change | current-treatment |
        | leaves its supporting evidence unchanged | not posted again and recorded as suppressed |
        | removes its supporting evidence | absent from the current receipt and visibly resolved or superseded |

  @advisory-freshness.NTB1.R1 @surface.github-pull-request-review
  Rule: advisory-freshness.NTB1.R1 — Inline findings bind to the exact reviewed SHA and diff location

    @rejection
    Scenario: A consequential finding is published at its exact changed evidence
      Given a current review has a consequential finding on a changed line
      When Safeword publishes the finding inline
      Then the comment targets the exact reviewed SHA, path, line, and diff side
