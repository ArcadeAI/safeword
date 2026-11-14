@wip
Feature: Complete EP9 with independent current evidence and honest history

  @verify-existing-ep9-behavior-for-maintainers.SWM1.R1 @surface.safeword-cli
  Rule: verify-existing-ep9-behavior-for-maintainers.SWM1.R1 — Only the fixed EP9 delivery is eligible

    Scenario: Complete EP9 proof receives current verification credit
      Given the installed EP9 profile matches a clean candidate
      And complete passing execution has trusted CI provenance and current qualified independent review
      When the maintainer requests current-proof credit
      Then only EP9 receives current verification credit

    @rejection
    Scenario: Another ticket cannot borrow EP9 proof
      Given valid evidence for a different ticket or installed profile
      When that evidence is presented for EP9 credit
      Then admission refuses without changing completion records

    Scenario: Partial proof cannot receive current credit
      Given an EP9 observation lacks a required bound behavior
      When current-proof credit is requested
      Then admission refuses despite a passing aggregate test count

  @verify-existing-ep9-behavior-for-maintainers.SWM1.R2 @surface.safeword-cli
  Rule: verify-existing-ep9-behavior-for-maintainers.SWM1.R2 — Authority is independent and revocable

    @rejection
    Scenario: A fresh review cannot authenticate invented execution
      Given candidate-authored evidence claims successful tests that never ran
      And a fresh independent reviewer approves its apparent coverage
      When EP9 credit is requested
      Then admission refuses for missing trusted execution provenance

    @surface.github-actions-execution-sandbox
    Scenario Outline: Only accepted execution can acquire trusted provenance
      Given a complete passing report from <origin>
      When the trusted signing job considers the report
      Then successful execution provenance is <result>

      Examples:
        | origin                          | result |
        | the accepted execution workflow | issued |
        | an arbitrary upload             | denied |

    @surface.github-actions-execution-sandbox
    Scenario: Candidate execution cannot reach signing authority
      Given candidate code executes on the actual GitHub execution runner
      When it attempts credential access or replacement of the report between execution and signing
      Then it cannot issue or replace a trusted successful execution claim

    Scenario: Live closing feasibility is established before adoption
      Given the actual CI signer issues a valid completion checkpoint
      When the observation is imported and verified through the installed closing path
      Then measured query-to-close latency fits the five-minute window and verification fits the host deadline

    Scenario: Invalid independent review cannot authorize current credit
      Given complete EP9 execution has valid trusted provenance
      But its review does not establish current qualified independent approval of every group
      When current-proof admission is requested
      Then admission refuses without replacing historical evidence

    Scenario: A locally forged validation record cannot replace external proof
      Given a fresh independent coverage review
      And candidate-controlled validation data lacks valid external signatures matching the installed trust pin
      When explicit completion is requested
      Then local closing refuses

    @surface.github-actions-execution-sandbox
    Scenario: A newer unfinished or failed execution blocks an older pass
      Given a passing execution is followed by a failed or unfinished execution for the same bound candidate
      When the trusted signer prepares a completion checkpoint
      Then it refuses to authorize closing from the older pass

    Scenario: A stale completion checkpoint cannot authorize closing
      Given otherwise valid execution provenance and independent review with an expired checkpoint
      When explicit completion is requested
      Then local closing refuses and requests renewal

    Scenario: Changed bound proof revokes current credit
      Given current proof and its independent review were admitted for EP9
      When a bound input changes before explicit completion
      Then closing refuses the old claim

    Scenario: Missing trusted support never grants completion
      Given EP9 has otherwise valid current evidence
      When trusted verification cannot finish within the supported host deadline
      Then completion refuses with a trusted-support recovery action

  @verify-existing-ep9-behavior-for-maintainers.SWM1.R3 @surface.safeword-cli
  Rule: verify-existing-ep9-behavior-for-maintainers.SWM1.R3 — Historical claims remain unchanged

    @demo @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Explicit EP9 completion preserves its actual history
      Given valid EP9 current proof and all ordinary completion prerequisites
      And EP9 retains both genuine recorded history and missing historical evidence
      When the maintainer explicitly completes EP9 on a supported local host
      Then only EP9 completes with each historical claim unchanged
      And missing historical RED remains visible beside distinct current verification

    @rejection
    Scenario: Current credit does not bypass ordinary prerequisites
      Given valid EP9 current-proof credit
      But an ordinary completion prerequisite is unmet
      When explicit completion is requested
      Then that prerequisite still refuses completion

    Scenario: Observation and certification do not automatically close work
      Given EP9 execution is independently observed and certified
      When no explicit completion is requested
      Then no ticket status changes

    Scenario: Excluded coding-agent hosts remain excluded
      Given completion is requested from an unsupported coding-agent host
      When current-proof completion is requested
      Then no EP9 completion authority is granted
