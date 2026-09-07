@wip
Feature: Stop hollow acceptance proofs before implementation

  @executable-red.TBU1.R1
  Rule: executable-red.TBU1.R1 — Every distinct new or changed primary proof is independently executed before production implementation

    Scenario: A new primary proof is run from its captured pre-implementation state
      Given a scenario has a new primary executable proof captured before its production implementation
      When the technical builder requests RED review for that proof
      Then Safeword admits the execution to independent review as pre-implementation evidence

    @rejection
    Scenario: Execution from a state containing the production implementation cannot earn RED approval
      Given the captured execution state already contains the scenario's production implementation
      When the technical builder requests RED approval
      Then Safeword records that approval is refused because the proof was not executed from its pre-implementation state

    @rejection
    Scenario: A new proof with no trusted execution cannot earn RED approval
      Given a scenario has a new primary executable proof with only author-supplied output
      When the technical builder requests RED approval
      Then Safeword records that approval is refused because no trusted execution witnessed the result

    @rejection
    Scenario: Execution of an unrelated test cannot earn RED approval
      Given trusted execution ran a test other than the primary proof bound to the scenario
      When the technical builder requests RED approval
      Then Safeword records that approval is refused because the executed test does not match the selected proof

    @rejection
    Scenario: Execution with no selected primary test cannot earn RED approval
      Given trusted execution ran a suite without selecting the primary proof bound to the scenario
      When the technical builder requests RED approval
      Then Safeword records that approval is refused because no execution witnessed the selected proof

    @rejection
    Scenario Outline: A non-independent verdict cannot earn a RED receipt
      Given the RED verdict comes from <verdict source>
      When the technical builder requests RED approval
      Then Safeword records that approval is refused because the verdict was not independently produced for this proof

      Examples:
        | verdict source                         |
        | the same agent that authored the proof |
        | a cached suite status                  |

    @rejection
    Scenario: An unavailable independent reviewer blocks RED approval
      Given trusted execution produced a valid failure and the degraded review ladder returned a best-available approval
      And no independent review route is available
      When the technical builder requests RED approval
      Then Safeword records that approval is refused because no independent verdict exists

  @executable-red.TBU1.R2
  Rule: executable-red.TBU1.R2 — RED is accepted only when the intended missing behavior fails through the stated actor boundary

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
    Scenario Outline: An interrupted proof run is not accepted as behavioral RED
      Given the selected test ends through <interruption> before producing its assertion result
      When the independent reviewer examines the trusted execution
      Then the reviewer rejects the proof because the intended failure was not observed

      Examples:
        | interruption  |
        | process kill  |
        | runner timeout |

    @rejection
    Scenario: A narrower internal test is not accepted for an actor-boundary claim
      Given the selected test fails through an internal seam without exercising the claimed actor entrypoint
      When the independent reviewer compares the execution with the scenario
      Then the reviewer rejects the proof for missing the claimed boundary

    @rejection
    Scenario: A proof of the wrong observable is not accepted for a scenario
      Given the selected test reaches the claimed actor entrypoint but asserts a different observable result
      When the independent reviewer compares the execution with the scenario
      Then the reviewer rejects the proof for missing the scenario's claimed observable

    @rejection
    Scenario: A result caused by leaked shared state is not accepted as behavioral RED
      Given the selected test result depends on leaked World or shared state instead of the missing behavior
      When the independent reviewer examines the trusted execution
      Then the reviewer rejects the proof because the intended failure is not isolated

  @executable-red.TBU1.R3
  Rule: executable-red.TBU1.R3 — Material changes to the scenario, proof plan, test, glue, World, shared state, helpers, command, or evidence class invalidate the prior receipt

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
        | World                |
        | shared state         |
        | helper               |
        | command              |
        | evidence class       |

    Scenario: An implementation-only change preserves the RED receipt
      Given an approved RED receipt whose bound proof inputs are unchanged
      When production implementation changes without changing the proof inputs
      Then Safeword still accepts the receipt as evidence for GREEN

  @executable-red.NTB1.R1
  Rule: executable-red.NTB1.R1 — A failed review explains the missing evidence and concrete next action in plain language

    @rejection
    Scenario Outline: A blocked proof distinguishes the cause and next action
      Given GREEN credit is blocked by <evidence problem> for a non-technical builder
      When Safeword explains the block
      Then the message says <named cause>
      And contains none of the workflow terms RED, GREEN, receipt, or gate
      And says <next action>
      And <command presentation>

      Examples:
        | evidence problem          | named cause                                      | next action                                      | command presentation                                                       |
        | missing trusted execution | the selected check has not been run               | run the displayed check command                  | the message displays the exact captured primary-proof command               |
        | wrong failure reason      | the intended behavior was not reached             | fix the check so it reaches the expected result  | the message explains no command can recover it until the check is corrected |
        | stale receipt             | the check changed after its approval               | run and review the changed check again            | the message displays the exact current proof and review command              |
        | unavailable review route  | no independent reviewer can currently approve it  | follow the displayed reviewer recovery command   | the message displays the coordinator-provided exact recovery command        |

  @executable-red.NTB1.R2
  Rule: executable-red.NTB1.R2 — Legitimate reuse does not create repetitive review ceremony

    Scenario: Scenario Outline rows sharing one proof implementation use one review
      Given a non-technical builder requested several examples of the same behavior that share one check
      When the technical builder requests independent review for those examples
      Then Safeword dispatches exactly one independent review and requests no further review for the covered examples

    @rejection
    Scenario: Distinct scenario proofs cannot share an umbrella receipt
      Given a non-technical builder's different requested behaviors delegate to one umbrella verdict without exercising their own outcomes
      When the builder tries to use one RED receipt for all of them
      Then Safeword requires one independent review for each distinct check

  @executable-red.SWM1.R1
  Rule: executable-red.SWM1.R1 — One review packet contains the scoped scenario or Rule body, proof-plan row, primary proof, glue, World definition, shared-state sources, helpers, exact command, full output, captured state, and evidence class

    Scenario Outline: The reviewer receives the complete proof contract and trusted execution together
      Given Safeword has completed a trusted RED execution
      And the primary proof is scoped to a <proof scope>
      When it prepares the independent review packet
      Then the packet contains the <required contract artifact>, proof-plan row, primary proof, glue, World definition, shared-state sources, helpers, canonical command, terminal output, evidence class, and captured-state identity

      Examples:
        | proof scope | required contract artifact |
        | scenario    | scenario body              |
        | Rule        | Rule body                  |

    @rejection
    Scenario Outline: An incomplete review packet is not dispatched
      Given a review packet is missing the <missing packet member>
      When Safeword validates the packet for independent review
      Then Safeword refuses dispatch and names <expected missing member>

      Examples:
        | missing packet member   | expected missing member  |
        | scoped scenario body    | the scenario body        |
        | captured-state identity | captured-state identity  |

  @executable-red.SWM1.R2
  Rule: executable-red.SWM1.R2 — Trusted execution records and independent-review receipts carry authentic coordinator provenance

    Scenario: Authentic coordinator provenance is accepted
      Given a trusted execution record and independent-review receipt were issued by the coordinator
      When Safeword verifies their provenance
      Then Safeword accepts them as authentic evidence for the current proof

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

    @rejection
    Scenario: An authentic receipt cannot be replayed onto another proof
      Given the coordinator issued an authentic receipt for a different primary proof
      When Safeword verifies it for the proof requesting GREEN credit
      Then Safeword refuses it because the bound proof identity does not match

  @executable-red.SWM1.R3
  Rule: executable-red.SWM1.R3 — Every supported agent host requires the same fresh, independently witnessed execution receipt before GREEN credit

    # skip: Per-host invocation wiring is owned by the existing agent-parity and schema contracts; this Rule proves the shared transition decision once.

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.openai-codex-cloud @surface.opencode @surface.cursor @surface.cursor-cloud-agents @surface.safeword-cli
    @rejection
    Scenario: The shared transition boundary blocks GREEN without a fresh RED receipt
      Given a feature's current primary proof has no fresh independent RED receipt
      When a supported host requests GREEN credit through Safeword's shared transition boundary
      Then Safeword blocks the transition and names the unproved behavior

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.openai-codex-cloud @surface.opencode @surface.cursor @surface.cursor-cloud-agents @surface.safeword-cli
    Scenario: The shared transition boundary permits GREEN with a fresh receipt
      Given trusted execution and independent review approved the current primary proof
      When a supported host requests GREEN credit through Safeword's shared transition boundary
      Then Safeword permits the transition under the same receipt contract
