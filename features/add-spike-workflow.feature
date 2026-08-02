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

    Scenario Outline: Every spike result produces a structured planning handoff
      Given a bounded spike has reached a <result> result
      When the maintainer distills the experiment
      Then the workflow returns its evidence, shortcuts, decision, and production consequences

      Examples:
        | result      |
        | VALIDATED   |
        | PARTIAL     |
        | INVALIDATED |

    Scenario: Planning consumes the spike handoff after creating its design record
      Given a completed spike returned structured evidence and impl-plan.md does not exist
      When plan-implementation begins
      Then plan-implementation creates impl-plan.md
      And it maps evidence to the Approach proof
      And it maps shortcuts to the build order
      And it maps the decision to Decisions
      And it maps production consequences to implementation tasks and Assessment triggers

    @rejection
    Scenario Outline: Dirty validated state cannot become the pre-spike base
      Given <state> has uncommitted changes
      When the maintainer prepares PRE_SPIKE_BASE
      Then the workflow does not record PRE_SPIKE_BASE
      And it creates no spike branch or worktree
      And it requires the <state> changes to be included in a commit

      Examples:
        | state               |
        | validated scenarios |
        | ticket state        |

    Scenario: Committed validated state becomes the shared spike base
      Given validated scenarios and ticket state are included in one commit
      When the maintainer prepares PRE_SPIKE_BASE
      Then PRE_SPIKE_BASE identifies that commit
      And the spike worktree contains the exact validated scenario and ticket changes

    @rejection
    Scenario: Spike code never becomes production implementation
      Given a completed spike branch contains experimental commits and changed files
      When production implementation begins
      Then production implementation starts from the pre-spike production base in a fresh worktree
      And its branch history contains no merged or cherry-picked spike commits
      And the spike branch remains unmerged

  @spike-workflow.TBU1.R1
  Rule: spike-workflow.TBU1.R1 — supported hosts expose an explicit spike action

    Scenario: Setup installs the same spike action for project-scoped hosts
      Given a project without Claude or Cursor spike artifacts
      When the maintainer runs the real safeword setup CLI entry point
      Then the installed Claude Code and Cursor artifacts each expose a manual spike action
      And both actions require the same charter, isolation, and evidence-distillation contract

    Scenario: Catalogue generation ships the same spike action for Codex
      Given a Codex plugin catalogue without the spike action
      When the maintainer runs the real Codex catalogue generator
      Then the generated Codex artifact exposes a spike action whose contract requires explicit invocation
      And it requires the canonical charter, isolation, and evidence-distillation contract

    @rejection
    Scenario: Host contracts keep spike behind explicit invocation
      Given the spike action is available through each host's supported delivery surface
      When each host evaluates workflows eligible for automatic selection
      Then Claude Code excludes spike through manual-only skill metadata
      And the generated Codex description and body instruct the agent to run spike only after an explicit user request
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
