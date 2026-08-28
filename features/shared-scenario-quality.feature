@wip
Feature: Shared scenario-quality standard

  @3HM021.SWM1.R1
  Rule: 3HM021.SWM1.R1 — scenario authors see the gate standard before writing

    Scenario: Define-behavior loads the canonical skill before generation
      Given the canonical review-spec skill has a non-empty Authoring mode section
      When Safeword validates the numbered define-behavior procedure
      Then the first pipeline item is the directive "Load review-spec in Authoring mode"
      And a later pipeline item is the directive "Generate scenarios"
      And the load directive resolves to the canonical review-spec skill

    Scenario: Authoring guidance has one scenario-quality source
      Given the canonical review-spec skill is non-empty
      When Safeword validates the define-behavior guidance
      Then exactly one scenario-quality skill reference resolves to the canonical review-spec skill
      And the guidance contains zero inline scenario-quality rubric sections

    Scenario: Authoring mode stops before independent review
      Given the canonical review-spec skill has Authoring mode and Review mode sections
      When Safeword validates the Authoring mode section
      Then it contains the directive "Do not launch the independent review coordinator"
      And its final directive returns control to the define-behavior procedure

  @3HM021.SWM1.R2
  Rule: 3HM021.SWM1.R2 — independent reviewers apply the canonical skill rather than a summary copy

    Scenario: Scenario-gate rubric is byte-identical to the canonical skill
      Given a scenario review is requested for a bounded feature
      When Safeword launches the independent scenario review
      Then the delivered prompt's non-empty shared-rubric block is byte-identical to the current non-empty template review-spec skill

    @rejection
    Scenario Outline: An unusable canonical skill prevents review dispatch
      Given the canonical template review-spec skill is <condition>
      When Safeword attempts to build a scenario-gate prompt
      Then no review packet reaches the independent reviewer
      And the caller receives an error naming the canonical review-spec skill

      Examples:
        | condition       |
        | absent          |
        | empty           |
        | whitespace-only |

    Scenario: Editing the canonical skill cannot leave a stale reviewer rubric
      Given Safeword has built one scenario-gate prompt
      When the canonical review-spec skill in an isolated test installation changes before another prompt is built in the same process
      Then the second prompt's non-empty shared-rubric block is byte-identical to the changed canonical skill

    Scenario: Existing project knowledge is supporting context
      Given a feature target and the configured spec, principles, personas, and surfaces files exist
      When Safeword launches the independent scenario review
      Then the feature is bounded work under review
      And the supporting context contains exactly the paths and current contents of the spec, principles, personas, and surfaces files

    Scenario: Project knowledge is resolved afresh for each dispatch
      Given Safeword has built one scenario-review packet in an isolated test installation
      When the required spec changes before another packet is built in the same process
      Then the second packet's spec context contains the changed content

    Scenario Outline: Missing optional project knowledge is omitted
      Given the configured optional <source> file is absent
      When Safeword launches the independent scenario review
      Then the review still launches with the required spec and optional <remaining_one> and <remaining_two> files as supporting context
      And the missing file is not added to the packet

      Examples:
        | source     | remaining_one | remaining_two |
        | principles | personas      | surfaces      |
        | personas   | principles    | surfaces      |
        | surfaces   | principles    | personas      |

    Scenario: All optional project knowledge is absent
      Given the configured principles, personas, and surfaces files are absent
      When Safeword launches the independent scenario review
      Then the review still launches with only the required feature and spec
      And no optional project-knowledge entry appears in the packet

    Scenario Outline: Blank optional project knowledge remains explicit context
      Given the configured optional <source> file exists and is <condition>
      When Safeword launches the independent scenario review
      Then that file's path and unchanged content appear in supporting context

      Examples:
        | source     | condition       |
        | principles | empty           |
        | principles | whitespace-only |

    @rejection
    Scenario Outline: An unusable required spec prevents review dispatch
      Given the ticket's required spec file is <condition>
      When Safeword attempts to launch the independent scenario review
      Then no review packet reaches the independent reviewer
      And the caller receives an error naming the unusable spec

      Examples:
        | condition       |
        | absent          |
        | empty           |
        | whitespace-only |

    Scenario: The public review-spec surface remains compatible
      Given the canonical template skill contains Authoring mode
      When Safeword enumerates its published command and skill surfaces
      Then review-spec remains present as a public command identifier
      And review-spec remains present as a public skill identifier
      And the published skill content is byte-identical to that canonical template skill

    Scenario Outline: Generated hosts receive the canonical shared skill
      Given the template review-spec skill is canonical
      When Safeword generates the <surface> skill surface
      Then that surface's non-empty review-spec content is byte-identical to the non-empty template

      Examples:
        | surface |
        | Claude Code |
        | OpenAI Codex |
        | Cursor |

    @rejection
    Scenario: Generated skill drift is detected
      Given one generated review-spec surface in an isolated test installation differs from the canonical template
      When Safeword checks generated skill parity
      Then it reports the stale generated surface
      And the parity check fails

  @3HM021.SWM1.R3
  Rule: 3HM021.SWM1.R3 — phase guidance and exit evidence announce the same shared standard

    Scenario: Define-behavior reminder announces authoring against review-spec
      Given the ticket is in define-behavior
      When Safeword emits the phase reminder
      Then the reminder requires loading review-spec in Authoring mode before drafting

    @rejection
    Scenario: Other phase reminders do not claim the authoring obligation
      Given the ticket is in scenario-gate
      When Safeword emits the phase reminder
      Then the reminder does not require loading Authoring mode before drafting

    Scenario: Define-behavior exit evidence names its authored work
      Given the ticket is leaving define-behavior
      When Safeword asks for phase-exit evidence
      Then the evidence requires derived dimensions
      And it requires user-confirmed scenarios
      And it requires authoring against review-spec

    Scenario: Scenario-gate reminder announces independent review
      Given the ticket is in scenario-gate
      When Safeword emits the phase reminder
      Then the reminder requires launching review-spec's independent review
      And it requires that review to pass before phase exit

    Scenario: Scenario-gate exit evidence requires the review result
      Given the ticket is leaving scenario-gate
      When Safeword asks for phase-exit evidence
      Then the evidence requires a passing independent scenario review

    @rejection
    Scenario: Other phase exits do not claim scenario-gate evidence
      Given the ticket is leaving define-behavior
      When Safeword asks for phase-exit evidence
      Then the evidence does not require a passing independent scenario review

    @rejection
    Scenario: A failing independent review keeps the workflow in scenario-gate
      Given the independent reviewer returns blocking findings
      When the scenario-gate procedure handles the result
      Then it requires the findings to be fixed and reviewed again
      And it does not advance to plan-implementation
