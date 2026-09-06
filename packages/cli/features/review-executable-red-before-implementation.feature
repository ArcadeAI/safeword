@proof.vitest
Feature: Trust executable RED before production implementation
  A builder should know that an acceptance proof really failed for the intended
  missing behavior before production implementation begins.

  @executable-red.TBU1.R1 @surface.safeword-cli
  Rule: executable-red.TBU1.R1 — Safeword executes every distinct primary proof against sealed inputs

    Scenario: A real missing-behavior failure produces trusted execution evidence
      Given a sealed pre-implementation proof whose actor-boundary assertion fails
      When Safeword executes the exact primary-proof command
      Then the attestation records the canonical command, working directory, environment identity, source fingerprint, termination, and bounded output with full-stream digests

    Scenario: Distinct primary proofs are executed separately
      Given two primary proofs have different canonical proof targets
      When Safeword executes both primary proofs
      Then each exact command produces its own trusted execution attestation

    @rejection
    Scenario: Author-supplied output cannot stand in for execution
      Given no Safeword execution attestation exists
      When an author supplies plausible RED output for independent review
      Then the review refuses to treat the output as executed evidence

    @rejection
    Scenario: Modified execution evidence cannot stand in for the trusted attestation
      Given a Safeword execution attestation has been modified after execution
      When an author submits it for independent review
      Then the review refuses to treat the modified attestation as trusted execution evidence

    @rejection
    Scenario: An interrupted proof is recorded but cannot earn approval
      Given a sealed primary proof that exceeds its execution deadline
      When Safeword executes the exact primary-proof command
      Then the attestation records the termination signal and the review remains unapproved

  @executable-red.TBU1.R2
  Rule: executable-red.TBU1.R2 — RED is accepted only for the intended missing behavior at the actor boundary

    Scenario: The intended actor-boundary assertion failure is accepted
      Given trusted execution evidence for a failing actor-boundary assertion
      When an independent reviewer compares it with the scenario and proof plan
      Then the reviewer approves the failure as evidence of the intended missing behavior

    @rejection
    Scenario Outline: A wrong-reason failure is rejected
      Given trusted execution evidence for a <failure reason> failure
      When an independent reviewer compares it with the scenario and proof plan
      Then the reviewer rejects the failure as unrelated to the intended missing behavior

      Examples:
        | failure reason                     |
        | syntax                             |
        | import                             |
        | fixture                            |
        | configuration                      |
        | infrastructure                     |
        | unrelated actor-boundary assertion |

  @executable-red.TBU1.R3
  Rule: executable-red.TBU1.R3 — Material proof-input changes invalidate prior review

    @rejection
    Scenario Outline: A material proof input changes after approval
      Given an approved RED review bound to sealed proof inputs
      When the <input> changes
      Then the prior review reports stale instead of approved

      Examples:
        | input                 |
        | scenario              |
        | proof-plan row        |
        | canonical command     |
        | evidence class        |
        | primary proof target  |
        | declared support file |

  @executable-red.NTB1.R1
  Rule: executable-red.NTB1.R1 — Failed review explains the gap and the next action plainly

    @rejection
    Scenario: Independent review routes are exhausted during advisory rollout
      Given trusted RED execution evidence and no available independent review route
      When the builder requests executable-RED review
      Then the result says the proof is not independently confirmed and names the exact retry or fallback action

  @executable-red.NTB1.R2
  Rule: executable-red.NTB1.R2 — Genuine shared proofs avoid repeated review ceremony

    Scenario: Scenario Outline rows share one proof implementation
      Given several Scenario Outline rows use the same canonical proof targets and command
      When the builder requests executable-RED review for every row
      Then one fresh review receipt covers the shared proof implementation

    @rejection
    Scenario: Similar scenarios use materially different proof implementations
      Given two scenarios use different canonical proof targets
      When the builder requests executable-RED review for both scenarios
      Then each distinct proof implementation requires its own review receipt

  @executable-red.SWM1.R1
  @surface.claude-code @surface.claude-code-cloud
  @surface.openai-codex @surface.openai-codex-cloud
  @surface.cursor @surface.cursor-cloud-agents
  Rule: executable-red.SWM1.R1 — Every agent sends one complete host-neutral RED review packet

    Scenario: Supported agents use the same trusted execution contract
      Given each supported agent has a new primary executable proof
      When its BDD workflow requests executable-RED review
      Then the packet binds the scenario, proof-plan row, declared proof targets, evidence class, and Safeword execution attestation

    @rejection
    Scenario: A supported agent omits a declared proof input
      Given a supported agent has an approved executable-RED receipt bound to complete proof inputs
      When its next packet omits a declared support file
      Then Safeword refuses to reuse the approved receipt

  @executable-red.SWM1.R2
  Rule: executable-red.SWM1.R2 — Receipt reuse follows distinct proof identity

    @rejection
    Scenario Outline: Proof identity determines receipt reuse
      Given a reviewed proof and a candidate with <identity relationship>
      When Safeword resolves whether the receipt covers the candidate
      Then the receipt is <reuse verdict>

      Examples:
        | identity relationship               | reuse verdict |
        | identical canonical proof inputs    | reused        |
        | different canonical proof inputs    | not reused    |

  @executable-red.SWM1.R3
  Rule: executable-red.SWM1.R3 — Advisory status never overstates independent evidence

    @rejection
    Scenario Outline: The advisory describes the current evidence honestly
      Given executable RED has <review state>
      When Safeword reports its implementation-readiness advisory
      Then the advisory says <message>

      Examples:
        | review state                | message                              |
        | a fresh approved receipt    | independently confirmed              |
        | no fresh approved receipt   | not independently confirmed          |
        | an author self-review only  | not independently confirmed          |
        | cached passing suite status | not independently confirmed          |
