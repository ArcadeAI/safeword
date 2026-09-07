@wip
Feature: Stop hollow acceptance proofs before implementation

  @executable-red.TBU1.R1
  Rule: executable-red.TBU1.R1 — Every new or changed primary proof is independently executed before implementation

    Scenario: A new primary proof is run from its captured pre-implementation state
      Given a scenario has a new primary executable proof
      When the builder requests RED review for that proof
      Then Safeword runs the exact selected test and records its terminal result with the exact captured-state identity
      And confirms that captured state predates the scenario's production implementation

    @rejection
    Scenario: Execution from a state containing the production implementation cannot earn RED approval
      Given the captured execution state already contains the scenario's production implementation
      When the builder requests RED approval
      Then Safeword refuses the receipt because the proof was not executed from its pre-implementation state

    @rejection
    Scenario: A new proof with no trusted execution cannot earn RED approval
      Given a scenario has a new primary executable proof with only author-supplied output
      When the builder requests RED approval
      Then Safeword refuses approval because no trusted execution witnessed the result

    @rejection
    Scenario: Execution of an unrelated test cannot earn RED approval
      Given trusted execution ran a test other than the primary proof bound to the scenario
      When the builder requests RED approval
      Then Safeword refuses approval because the executed test does not match the selected proof

    @rejection
    Scenario Outline: A non-independent verdict cannot earn a RED receipt
      Given the RED verdict comes from <verdict source>
      When the builder requests RED approval
      Then Safeword refuses the receipt because the approval was not independently produced for this proof

      Examples:
        | verdict source                         |
        | the same agent that authored the proof |
        | a cached suite status                  |

    @rejection
    Scenario: An unavailable independent reviewer blocks RED approval
      Given trusted execution produced a valid failure but no independent review route is available
      When the builder requests RED approval
      Then Safeword refuses the receipt because no independent verdict exists

  @executable-red.TBU1.R2
  Rule: executable-red.TBU1.R2 — RED is accepted only for the intended missing behavior at the actor boundary

    Scenario: An assertion failure caused by the missing actor-visible behavior is accepted
      Given the selected test exercises the scenario's actor entrypoint and observable result
      When trusted execution reports the expected assertion failure for the missing behavior
      Then the independent reviewer approves the RED proof

    @rejection
    Scenario: A passing pre-implementation proof is not accepted as RED
      Given the selected test passes while the scenario's behavior is still missing
      When trusted execution reports the passing result
      Then the independent reviewer rejects the proof because the intended behavior did not fail

    @rejection
    Scenario: A setup failure is not accepted as behavioral RED
      Given the selected test cannot reach its assertion because collection or setup fails
      When the independent reviewer examines the trusted execution
      Then the reviewer rejects the proof as the wrong failure reason

    @rejection
    Scenario: An interrupted proof run is not accepted as behavioral RED
      Given the selected test is killed or times out before producing its assertion result
      When the independent reviewer examines the trusted execution
      Then the reviewer rejects the proof because the intended failure was not observed

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
        | proof input          |
        | scenario             |
        | proof-plan row       |
        | test                 |
        | glue                 |
        | World or shared state |
        | helper               |
        | command              |
        | evidence class       |

    Scenario: An implementation-only change preserves the RED receipt
      Given an approved RED receipt whose bound proof inputs are unchanged
      When production implementation changes without changing the proof inputs
      Then Safeword still accepts the receipt as evidence for GREEN

  @executable-red.NTB1.R1
  Rule: executable-red.NTB1.R1 — A failed gate explains the problem and next action plainly

    @rejection
    Scenario Outline: A blocked proof distinguishes the cause and recovery command
      Given GREEN credit is blocked by <evidence problem>
      When Safeword explains the block to the builder
      Then the message says <named cause>
      And contains none of the workflow terms RED, GREEN, receipt, or gate
      And gives <next action> as the exact recovery command

      Examples:
        | evidence problem          | named cause                                      | next action                         |
        | missing trusted execution | the selected proof has not been run               | the selected primary-proof command  |
        | wrong failure reason      | the intended behavior was not reached             | the corrected primary-proof command |
        | stale receipt             | the proof changed after its approval               | the fresh RED-review command         |
        | unavailable review route  | no independent reviewer can currently approve it  | the reviewer recovery command        |

  @executable-red.NTB1.R2
  Rule: executable-red.NTB1.R2 — Legitimate proof reuse does not repeat review ceremony

    Scenario: Scenario Outline rows sharing one proof implementation use one review
      Given several Scenario Outline rows execute the same distinct proof implementation
      When that implementation earns a fresh RED receipt
      Then Safeword accepts that receipt as current evidence for every covered row and requests no additional review

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

    @rejection
    Scenario: A forged independent-review receipt cannot authorize GREEN
      Given a project-authored receipt claims independent approval that the review coordinator never issued
      When Safeword verifies the receipt before GREEN credit
      Then Safeword refuses it because its independent-review provenance is not authentic

  @executable-red.SWM1.R2
  Rule: executable-red.SWM1.R2 — Every supported host enforces the same receipt before GREEN

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.openai-codex-cloud @surface.opencode @surface.cursor @surface.cursor-cloud-agents @surface.safeword-cli
    @rejection
    Scenario Outline: A host blocks GREEN when the RED receipt is absent or stale
      Given a feature is in implementation through <host> at its <gate entrypoint>
      And its current primary proof has no fresh independent RED receipt
      When the agent tries to record GREEN credit
      Then the <gate entrypoint> blocks the transition with <evidence class> evidence

      Examples:
        | host                | gate entrypoint                    | evidence class              |
        | Claude Code         | configured Claude hook             | local host integration      |
        | Claude Code Cloud   | configured cloud Claude hook       | managed cloud integration   |
        | OpenAI Codex        | packaged Codex plugin workflow     | local host integration      |
        | OpenAI Codex Cloud  | cloud workflow invoking the CLI    | managed cloud integration   |
        | OpenCode            | Safeword plugin event              | exact-version conformance   |
        | Cursor              | configured Cursor hook             | local host integration      |
        | Cursor Cloud Agents | configured project command hook    | managed cloud integration   |
        | Safeword CLI        | direct GREEN-credit command        | public command integration  |

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.openai-codex-cloud @surface.opencode @surface.cursor @surface.cursor-cloud-agents @surface.safeword-cli
    Scenario Outline: A fresh receipt permits GREEN through every supported host
      Given trusted execution and independent review approved the current primary proof through <host> at its <gate entrypoint>
      When the agent records GREEN credit through the <gate entrypoint>
      Then Safeword permits the transition with <evidence class> evidence under the same receipt contract

      Examples:
        | host                | gate entrypoint                    | evidence class              |
        | Claude Code         | configured Claude hook             | local host integration      |
        | Claude Code Cloud   | configured cloud Claude hook       | managed cloud integration   |
        | OpenAI Codex        | packaged Codex plugin workflow     | local host integration      |
        | OpenAI Codex Cloud  | cloud workflow invoking the CLI    | managed cloud integration   |
        | OpenCode            | Safeword plugin event              | exact-version conformance   |
        | Cursor              | configured Cursor hook             | local host integration      |
        | Cursor Cloud Agents | configured project command hook    | managed cloud integration   |
        | Safeword CLI        | direct GREEN-credit command        | public command integration  |
