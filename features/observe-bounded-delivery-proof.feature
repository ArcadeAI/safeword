@wip @surface.safeword-cli
Feature: Observe trustworthy current proof for contributors

  @bounded-observation.SWM1.R1
  Rule: bounded-observation.SWM1.R1 — Observation is restricted to the approved proof and candidate

    Scenario: The observer runs the fixed proof set without changing the source checkout
      Given a clean committed candidate bound to the approved T3E4NS proof set
      When the maintainer requests a local observation through the Safeword CLI
      Then the execution names exactly the approved proof set and candidate
      And the original checkout's product inputs remain unchanged

    @rejection
    Scenario: A caller cannot substitute an execution command
      Given a request that substitutes a command for the fixed proof lane
      When the maintainer submits the observation request through the Safeword CLI
      Then execution is refused before that command runs
      And the result names the unsupported override and the fixed request to use

    @rejection
    Scenario: Uncommitted execution inputs prevent observation
      Given the approved candidate has an uncommitted proof configuration change
      When the maintainer requests a local observation through the Safeword CLI
      Then no proof execution starts
      And the result names the changed input and asks for a committed clean candidate

    @rejection
    Scenario: A candidate change during execution prevents a successful observation
      Given the fixed local CLI execution is paused after identifying its committed candidate and inputs
      When the candidate advances to another commit before the run finishes
      Then no successful observation is issued
      And the result names the changed candidate and asks for a new run on a stable committed candidate

  @bounded-observation.SWM1.R2
  Rule: bounded-observation.SWM1.R2 — Successful observations require complete passing proof

    @demo
    Scenario: Complete fixed-lane execution produces verifiable current evidence
      Given a clean bound candidate whose fixed lane has passing required assertions for all 37 delivery cases
      When the maintainer requests a local observation through the Safeword CLI
      Then the CLI returns a verifiable observation identifying its command, candidate, runtime, inputs and complete results
      And the retained full report supports every declared required assertion

    @rejection
    Scenario: An unmapped delivery case prevents execution
      Given one of the 37 bounded delivery cases has no declared assertion mapping
      When the maintainer requests a local observation through the Safeword CLI
      Then no proof execution starts
      And the result names the unmapped case and asks for a reviewed complete mapping

    @rejection
    Scenario Outline: A required assertion without a passing result prevents success
      Given a bound candidate whose fixed proof lane reports a required assertion as <result>
      When the maintainer requests a local observation through the Safeword CLI
      Then no successful observation is issued
      And the result names that assertion and the corrective rerun action

      Examples:
        | result |
        | absent from the report |
        | skipped |
        | failed |

    @rejection
    Scenario: A failed runner cannot hide behind passing assertions
      Given a bound candidate whose fixed runner passes every required assertion but exits unsuccessfully
      When the maintainer requests a local observation through the Safeword CLI
      Then no successful observation is issued
      And the retained diagnostics name the runner failure and the corrective action

  @bounded-observation.SWM1.R3
  Rule: bounded-observation.SWM1.R3 — Retained attempts remain verifiable and honest

    @rejection
    Scenario: Altered report bytes cannot verify as observed proof
      Given the retained report of an authentic successful observation has changed
      When the maintainer verifies that observation through the Safeword CLI
      Then verification refuses the altered evidence
      And the result asks for a new observation of the unchanged committed candidate

    Scenario: Retrying an interrupted attempt preserves the failed evidence
      Given an interrupted fixed-lane attempt has a retained nonempty failure diagnostic
      When the maintainer retries the same clean committed candidate successfully through the Safeword CLI
      Then the new successful observation is retained as a distinct attempt
      And the same earlier interrupted attempt and its diagnostic remain readable byte-for-byte unchanged and do not verify as success

  @bounded-observation.SWM1.R4
  Rule: bounded-observation.SWM1.R4 — Current success follows current proof inputs

    Scenario Outline: Observation currency follows meaningful input changes
      Given a successful observation followed by <change>
      When the maintainer verifies that observation through the Safeword CLI
      Then verification reports <currency>
      And the result <next_action>
      And the original retained evidence remains readable

      Examples:
        | change | currency | next_action |
        | a committed edit to required assertion source | stale evidence without current success | names the changed assertion source and requests an observation of the new committed candidate |
        | a committed edit to the ticket's accepted scope | stale evidence without current success | names the changed scope and requests review of an updated shipped contract before another observation |
        | an appended Work Log entry with all bound fields unchanged | current successful execution | explains that no new observation is needed for this bookkeeping change |
        | a new audit summary that is not a loaded execution input | current successful execution | explains that no new observation is needed for this audit-only output |

  @bounded-observation.SWM1.R5
  Rule: bounded-observation.SWM1.R5 — Observation grants no historical or closing authority

    Scenario: Successful observation leaves historical and completion authority unchanged
      Given the original ledgers, receipts and all 33 deferred case identities are recorded
      When the fixed-lane observation succeeds through the Safeword CLI
      Then the result identifies execution evidence only without RED, certification or completion authority
      And the original scopes, ledgers, receipts, deferred identities and ticket phases remain unchanged
