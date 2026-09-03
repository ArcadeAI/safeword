Feature: Project knowledge throughout feature delivery

  @project-knowledge.NTB1.R1
  Rule: project-knowledge.NTB1.R1 — Applicable project knowledge changes delivery without becoming a checklist

    @manual @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Principle applicability produces a proportional plan entry
      Given the configured principles include "<principle>"
      And the ticket makes that principle "<applicability>"
      When the implementation plan is prepared
      Then Design alignment "<outcome>"

      Examples:
        | principle                           | applicability  | outcome                                                                                  |
        | Delight the user                    | applicable     | records Delight the user → recovery stays in context → persona walkthrough              |
        | Adopt and extend OSS before bespoke | applicable     | records Adopt and extend OSS → use the public extension point → compatibility test       |
        | Prefer monthly dependency refreshes | not applicable | contains no entry for Prefer monthly dependency refreshes                                |

    @manual @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: An unexplained conflict cannot pass independent plan review
      Given an applicable principle conflicts with the proposed design
      And Known deviations does not name the conflict
      When the independent plan review runs
      Then the review rejects the plan with the missing deviation named

    @manual @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A recorded principle conflict can pass independent plan review
      Given an applicable principle conflicts with the proposed design
      And Known deviations names the conflict, trade-off, and proof
      When the independent plan review runs
      Then the review accepts the conflict as a deliberate deviation

  @project-knowledge.NTB1.R2
  Rule: project-knowledge.NTB1.R2 — Independent review receives the source knowledge used to create the work

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Each installed host review stage receives relevant configured knowledge
      Given the ticket makes principles, personas, and surfaces relevant
      And all three sources use configured project paths
      When "<host>" launches its installed "<review>" review entry point
      Then the reviewer receives the resolved current contents of all three sources

      Examples:
        | host          | review   |
        | Claude Code   | spec     |
        | Claude Code   | scenario |
        | Claude Code   | plan     |
        | Claude Code   | quality  |
        | OpenAI Codex  | spec     |
        | OpenAI Codex  | scenario |
        | OpenAI Codex  | plan     |
        | OpenAI Codex  | quality  |
        | Cursor        | spec     |
        | Cursor        | scenario |
        | Cursor        | plan     |
        | Cursor        | quality  |

    @manual @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Labels alone cannot satisfy a source-grounded review
      Given the work product contains a valid project-knowledge reference
      And the reviewer receives its label without the configured source contents
      When the independent review runs
      Then the review is rejected because applicability cannot be established

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A later review resolves current knowledge instead of stale intake content
      Given a configured project-knowledge source changed after intake
      When a later independent review begins
      Then its review context contains the current configured content

  @project-knowledge.NTB1.R3
  Rule: project-knowledge.NTB1.R3 — Completion evidence distinguishes experience, surface execution, and trace integrity

    @manual @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Evidence is judged against the kind of claim it supports
      Given the work claims "<claim>"
      And it records "<evidence>" as proof
      When quality review evaluates the claim
      Then the proof is "<outcome>"

      Examples:
        | claim                                             | evidence                                                                   | outcome                                      |
        | a persona is delighted                            | unit tests of the mechanics                                                | rejected without an experiential signal      |
        | a persona is delighted                            | no recorded result                                                         | rejected with missing experience evidence    |
        | a persona is delighted                            | a recorded persona walkthrough of the claimed experience                   | accepted as persona experience evidence      |
        | Claude Code review receives configured knowledge  | installed Claude Code review output naming the resolved configured entries | accepted as Claude Code surface evidence     |
        | Claude Code review receives configured knowledge  | no recorded Claude Code review result                                      | rejected with missing Claude Code evidence   |
        | OpenAI Codex review receives configured knowledge | installed Codex review output naming the resolved configured entries       | accepted as OpenAI Codex surface evidence    |
        | OpenAI Codex review receives configured knowledge | no recorded OpenAI Codex review result                                     | rejected with missing OpenAI Codex evidence  |
        | Cursor review receives configured knowledge       | installed Cursor review output naming the resolved configured entries      | accepted as Cursor surface evidence          |
        | Cursor review receives configured knowledge       | no recorded Cursor review result                                           | rejected with missing Cursor evidence        |
        | configured-path health works in Safeword CLI      | safeword check --offline output for the configured-path fixture             | accepted as Safeword CLI surface evidence    |
        | configured-path health works in Safeword CLI      | no recorded safeword check result                                          | rejected with missing Safeword CLI evidence  |
        | a principle trace is complete                     | the configured source entry and named proof link both resolve               | accepted as objective trace evidence         |

    @rejection @surface.safeword-cli
    Scenario Outline: Audit reports each broken principle trace as E010
      Given an implementation plan contains "<defect>"
      When the objective audit runs
      Then it reports E010 with "<detail>"

      Examples:
        | defect                                      | detail                       |
        | a principle absent from its configured file | missing source principle     |
        | a mapping without consequence or proof      | incomplete principle mapping |
        | a proof link that does not resolve           | dead evidence reference      |
        | an explicit conflict marker without a matching Known deviations entry | unrecorded conflict |

    @surface.safeword-cli
    Scenario: Semantic disagreement is not an audit failure
      Given a principle trace has a source entry, consequence, and resolving proof
      And a reviewer disputes whether the consequence was a wise interpretation
      When the objective audit runs
      Then it reports no E010 for that disagreement

    @surface.safeword-cli
    Scenario: A heading number is not part of a principle's identity
      Given a configured principle heading is numbered
      And the implementation plan names that principle without the number
      When the objective audit runs
      Then the principle trace is accepted

  @project-knowledge.SWM1.R1
  Rule: project-knowledge.SWM1.R1 — Principles, personas, and surfaces share a safe configured-path lifecycle

    @surface.safeword-cli
    Scenario Outline: Setup scaffolds absent knowledge and preserves authored knowledge
      Given the default "<knowledge>" file is "<state>"
      When Safeword setup reconciles the project
      Then the file is "<outcome>"

      Examples:
        | knowledge  | state                  | outcome                         |
        | principles | absent                 | created from its scaffold       |
        | personas   | absent                 | created from its scaffold       |
        | surfaces   | absent                 | created from its scaffold       |
        | principles | customized by the user | preserved byte-identical        |
        | personas   | customized by the user | preserved byte-identical        |
        | surfaces   | customized by the user | preserved byte-identical        |

    @surface.safeword-cli
    Scenario Outline: A configured knowledge path suppresses its default scaffold
      Given paths.<knowledge> points to an existing user-owned file
      And the default "<knowledge>" file is absent
      When Safeword setup reconciles the project
      Then the default "<knowledge>" file remains absent

      Examples:
        | knowledge  |
        | principles |
        | personas   |
        | surfaces   |

    @surface.safeword-cli
    Scenario Outline: A valid override passes health without an orphan advisory
      Given paths.<knowledge> points to an existing user-owned file
      And the default "<knowledge>" file is absent
      When Safeword checks project health
      Then it exits successfully without an orphan advisory

      Examples:
        | knowledge  |
        | principles |
        | personas   |
        | surfaces   |

    @rejection @surface.safeword-cli
    Scenario Outline: A missing configured knowledge file fails health checks loudly
      Given paths.<knowledge> points to a missing file
      When Safeword checks project health
      Then it exits non-zero with a "<diagnostic>" error

      Examples:
        | knowledge  | diagnostic      |
        | principles | principles-path |
        | personas   | personas-path   |
        | surfaces   | surfaces-path   |

    @surface.safeword-cli
    Scenario Outline: An overridden default is reported without deleting it
      Given paths.<knowledge> points to a user-owned file
      And the default "<knowledge>" file also exists
      When Safeword checks project health
      Then it exits successfully with an orphan advisory naming both paths

      Examples:
        | knowledge  |
        | principles |
        | personas   |
        | surfaces   |

    @surface.safeword-cli
    Scenario Outline: An orphaned default remains untouched during reconciliation
      Given paths.<knowledge> points to a user-owned file
      And the default "<knowledge>" file contains user-authored content
      When Safeword setup reconciles the project
      Then the default file remains byte-identical

      Examples:
        | knowledge  |
        | principles |
        | personas   |
        | surfaces   |

  @project-knowledge.SWM1.R2
  Rule: project-knowledge.SWM1.R2 — Design alignment is canonical without breaking legacy plans

    @surface.safeword-cli
    Scenario Outline: A single supported alignment heading passes the plan gate
      Given an otherwise complete plan uses only "<heading>"
      When the implementation-plan gate parses it
      Then the plan is accepted with that section as Design alignment

      Examples:
        | heading          |
        | Design alignment |
        | Arch alignment   |

    @rejection @surface.safeword-cli
    Scenario Outline: An ambiguous alignment contract is rejected with remediation
      Given an otherwise complete plan has "<state>"
      When the implementation-plan gate parses it
      Then the plan is rejected with "<remediation>"

      Examples:
        | state                                | remediation                         |
        | neither alignment heading            | add Design alignment                |
        | both supported alignment headings    | keep exactly one alignment heading  |

  @project-knowledge.SWM1.R3
  Rule: project-knowledge.SWM1.R3 — Every supported host preserves the same knowledge contract

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Synchronized host artifacts pass parity
      Given canonical, dogfood Claude, Cursor, and Codex artifacts carry the same knowledge contract
      When Safeword checks workflow parity
      Then every required parity pair and contract passes

    @rejection @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Host drift fails parity at the changed surface
      Given the "<surface>" artifact omits a required knowledge behavior
      When Safeword checks workflow parity
      Then parity fails and names "<surface>"

      Examples:
        | surface          |
        | canonical template |
        | dogfood Claude |
        | Cursor         |
        | Codex          |

  @project-knowledge.SWM1.R4
  Rule: project-knowledge.SWM1.R4 — Builders can discover the complete public knowledge contract

    @rejection @surface.safeword-cli
    Scenario Outline: Public documentation distinguishes a complete contract from an incomplete one
      Given the public configuration guidance is "<state>"
      When its project-knowledge contract is checked
      Then the documentation contract "<outcome>"

      Examples:
        | state                                                  | outcome |
        | lists all three keys and explains ownership and health | passes  |
        | omits paths.principles                                 | fails   |
        | omits paths.personas                                   | fails   |
        | omits paths.surfaces                                   | fails   |
        | omits preservation behavior                            | fails   |
        | omits orphan behavior                                  | fails   |
