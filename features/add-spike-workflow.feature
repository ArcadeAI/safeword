@surface.claude-code @surface.openai-codex @surface.cursor @surface.safeword-cli
Feature: Resolve build-only uncertainty with a spike
  Safe Word maintainers need executable evidence for technical risks without
  weakening the production feature workflow or merging disposable code.

  @spike-workflow.SWM1.R1
  Rule: spike-workflow.SWM1.R1 — a spike is bounded before code is written

    Scenario: Eligible uncertainty starts with a complete experiment charter
      Given a validated feature with a build-only kill risk
      When the maintainer invokes the spike action
      Then the experiment requires a question, hypothesis, kill criterion, proof, and budget

    @rejection
    Scenario Outline: An incomplete charter cannot execute
      Given a validated feature with a build-only kill risk
      And its experiment charter is missing the <field>
      When the maintainer invokes the spike action
      Then no proof command runs
      And the workflow identifies the missing <field>

      Examples:
        | field          |
        | question       |
        | hypothesis     |
        | kill criterion |
        | proof          |
        | budget         |

    @rejection
    Scenario Outline: Non-executable uncertainty is routed without a spike
      Given the uncertainty is <kind>
      When the maintainer considers a spike
      Then the workflow directs the maintainer to <route>
      And no experimental code begins

      Examples:
        | kind                                    | route         |
        | answerable from documentation or code   | research      |
        | dependent on user-only knowledge        | elicit        |
        | a choice among researchable alternatives | figure-it-out |

    Scenario Outline: Spike execution stays question-sized
      Given a proposed spike contains <shape>
      When the workflow bounds the experiment
      Then it <outcome>

      Examples:
        | shape                           | outcome                                        |
        | one kill-risk slice             | creates one experiment                         |
        | independent comparison variants | permits only those variants to fan out         |
        | feature-wide component work     | rejects the proposal as production implementation |

  @spike-workflow.SWM1.R2
  Rule: spike-workflow.SWM1.R2 — evidence persists while experimental code stays disposable

    Scenario Outline: Every spike result feeds the production implementation plan
      Given a bounded spike has reached a <result> result
      When the maintainer distills the experiment
      Then impl-plan.md records its evidence, shortcuts, decisions, and production consequences

      Examples:
        | result      |
        | VALIDATED   |
        | PARTIAL     |
        | INVALIDATED |

    @rejection
    Scenario: Spike code never becomes production implementation
      Given a completed spike branch contains experimental commits and changed files
      When production implementation begins
      Then production implementation starts from the pre-spike production base in a fresh worktree
      And its branch history contains no merged or cherry-picked spike commits
      And the spike branch remains unmerged

  @spike-workflow.TBU1.R1
  Rule: spike-workflow.TBU1.R1 — supported hosts expose one manual action

    Scenario: Setup installs the same spike action for project-scoped hosts
      Given a project without Claude or Cursor spike artifacts
      When the maintainer runs the real safeword setup CLI entry point
      Then the installed Claude Code and Cursor artifacts each expose a manual spike action
      And both actions require the same charter, isolation, and evidence-distillation contract

    Scenario: Catalogue generation ships the same spike action for Codex
      Given a Codex plugin catalogue without the spike action
      When the maintainer runs the real Codex catalogue generator
      Then the generated Codex artifact exposes a manual spike action
      And it requires the canonical charter, isolation, and evidence-distillation contract

    @rejection
    Scenario: Automatic skill selection cannot spend a spike budget
      Given the spike action is installed for every supported host
      When each host evaluates workflows eligible for automatic selection
      Then Claude Code and Codex exclude spike through manual-only skill metadata
      And Cursor exposes spike as a command without an automatic rule

  @spike-workflow.TBU1.R2
  Rule: spike-workflow.TBU1.R2 — BDD offers a spike only at the planning seam

    Scenario: Build-only kill risk is surfaced at the planning seam
      Given scenario validation has completed
      And one implementation risk requires executable evidence
      When BDD transitions toward plan-implementation
      Then the spike checkpoint is the next offered action
      And plan-implementation has not begun

    @rejection
    Scenario Outline: BDD does not offer a spike before behavior is validated
      Given BDD is in <phase>
      And scenario validation has not completed
      When BDD selects the next workflow action
      Then the spike checkpoint is not offered
      And BDD <transition>

      Examples:
        | phase           | transition                                       |
        | intake          | advances to define-behavior                      |
        | define-behavior | advances to scenario-gate                        |
        | scenario-gate   | remains in scenario-gate until validation passes |

    @rejection
    Scenario: Routine features proceed without a spike
      Given behavior is validated and no build-only kill risk remains
      When BDD prepares implementation planning
      Then BDD proceeds directly to plan-implementation
