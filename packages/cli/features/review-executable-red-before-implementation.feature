@wip
Feature: Stop hollow acceptance proofs before implementation

  @executable-red.TBU1.R1
  Rule: executable-red.TBU1.R1 — Every new or changed primary proof is independently executed before implementation

    Scenario: A new primary proof is run from its captured pre-implementation state
      Given a scenario has a new primary executable proof
      When the builder requests RED review for that proof
      Then Safeword runs the exact selected test and records its terminal result from the captured pre-implementation state

    @rejection
    Scenario: A new proof with no trusted execution cannot earn RED approval
      Given a scenario has a new primary executable proof with only author-supplied output
      When the builder requests RED approval
      Then Safeword refuses approval because no trusted execution witnessed the result

  @executable-red.TBU1.R2
  Rule: executable-red.TBU1.R2 — RED is accepted only for the intended missing behavior at the actor boundary

    Scenario: An assertion failure caused by the missing actor-visible behavior is accepted
      Given the selected test exercises the scenario's actor entrypoint and observable result
      When trusted execution reports the expected assertion failure for the missing behavior
      Then the independent reviewer approves the RED proof

    @rejection
    Scenario: A setup failure is not accepted as behavioral RED
      Given the selected test cannot reach its assertion because collection or setup fails
      When the independent reviewer examines the trusted execution
      Then the reviewer rejects the proof as the wrong failure reason

    @rejection
    Scenario: A narrower internal test is not accepted for an actor-boundary claim
      Given the selected test fails through an internal seam without exercising the claimed actor entrypoint
      When the independent reviewer compares the execution with the scenario
      Then the reviewer rejects the proof for missing the claimed boundary

  @executable-red.TBU1.R3
  Rule: executable-red.TBU1.R3 — Material proof changes invalidate prior RED approval

    @rejection
    Scenario Outline: A material proof input change makes the receipt stale
      Given an approved RED receipt binds the current <proof input>
      When that <proof input> changes after review
      Then Safeword refuses GREEN credit until the changed proof is executed and reviewed again

      Examples:
        | proof input    |
        | scenario       |
        | proof-plan row |
        | test or glue   |
        | helper         |
        | command        |
        | evidence class |

    Scenario: An implementation-only change preserves the RED receipt
      Given an approved RED receipt whose bound proof inputs are unchanged
      When production implementation changes without changing the proof inputs
      Then Safeword still accepts the receipt as evidence for GREEN

  @executable-red.NTB1.R1
  Rule: executable-red.NTB1.R1 — A failed gate explains the problem and next action plainly

    @rejection
    Scenario Outline: A blocked proof names the missing evidence and recovery command
      Given GREEN credit is blocked by <evidence problem>
      When Safeword explains the block to the builder
      Then the message names the unproved behavior and the exact command that can produce current evidence

      Examples:
        | evidence problem          |
        | missing trusted execution |
        | wrong failure reason      |
        | stale receipt             |
        | unavailable review route  |

  @executable-red.NTB1.R2
  Rule: executable-red.NTB1.R2 — Legitimate proof reuse does not repeat review ceremony

    Scenario: Scenario Outline rows sharing one proof implementation use one review
      Given several Scenario Outline rows execute the same distinct proof implementation
      When that implementation earns a fresh RED receipt
      Then each covered row can use that one receipt without another review

    @rejection
    Scenario: Distinct scenario proofs cannot share an umbrella receipt
      Given different scenarios delegate to one umbrella verdict without exercising their own outcomes
      When the builder tries to use one RED receipt for all of them
      Then Safeword refuses the receipt for every proof implementation it did not cover

  @executable-red.SWM1.R1
  Rule: executable-red.SWM1.R1 — The review packet carries complete execution evidence

    Scenario: The reviewer receives the proof contract and trusted execution together
      Given Safeword has completed a trusted RED execution
      When it prepares the independent review packet
      Then the packet contains the scenario, proof-plan row, proof sources, canonical command, terminal output, evidence class, and captured-state identity

    @rejection
    Scenario: A fabricated execution record cannot become an approved receipt
      Given a project-authored record claims that a RED command failed correctly
      When Safeword verifies the record before review
      Then Safeword refuses it because the trusted executor did not authenticate it

  @executable-red.SWM1.R2
  Rule: executable-red.SWM1.R2 — Every supported host enforces the same receipt before GREEN

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.openai-codex-cloud @surface.opencode @surface.cursor @surface.cursor-cloud-agents @surface.safeword-cli
    @rejection
    Scenario Outline: A host blocks GREEN when the RED receipt is absent or stale
      Given a feature is in implementation through <host>
      And its current primary proof has no fresh independent RED receipt
      When the agent tries to record GREEN credit
      Then the host blocks the transition through Safeword's shared receipt gate

      Examples:
        | host                |
        | Claude Code         |
        | Claude Code Cloud   |
        | OpenAI Codex        |
        | OpenAI Codex Cloud  |
        | OpenCode            |
        | Cursor              |
        | Cursor Cloud Agents |
        | Safeword CLI        |

    Scenario: A fresh receipt permits GREEN through the shared gate
      Given trusted execution and independent review approved the current primary proof
      When the agent records GREEN credit through a supported host
      Then Safeword permits the transition with the same receipt contract
