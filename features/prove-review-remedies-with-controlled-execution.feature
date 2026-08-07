@wip
Feature: Prove review remedies with controlled execution

  @advisory-execution.TBU1.R1 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: advisory-execution.TBU1.R1 — A verified-remedy claim identifies the exact patch and successful relevant commands

    @rejection
    Scenario: Exact successful execution can support a verified-remedy claim
      Given Safeword applied the exact displayed patch in an eligible sandbox
      And every named relevant command succeeded against that patch
      When Safeword describes the remedy as verified
      Then the receipt identifies the exact patch, commands, revision, and results

  @advisory-execution.TBU1.R2 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: advisory-execution.TBU1.R2 — Mismatched, partial, failed, or errored execution remains unverified

    @rejection
    Scenario Outline: Insufficient execution evidence cannot verify a remedy
      Given Safeword has <execution-evidence>
      When Safeword renders the remedy
      Then the remedy is labeled unverified

      Examples:
        | execution-evidence |
        | an applied patch different from the displayed remedy |
        | a failed named relevant command |
        | an errored named relevant command |
        | only a subset of named relevant commands |

  @advisory-execution.SWM1.R1 @surface.safeword-cli
  Rule: advisory-execution.SWM1.R1 — Eligibility alone never authorizes code execution

    @rejection
    Scenario: Same-repository eligibility without a declared evidence need executes nothing
      Given a same-repository pull request is execution-eligible
      And no named check is required to resolve a declared unknown
      When Safeword performs the review
      Then no customer code is executed

  @advisory-execution.SWM1.R2 @surface.safeword-cli @surface.github-pull-request-conversation
  Rule: advisory-execution.SWM1.R2 — Every execution records its command, revision, outcome, and purpose

    @rejection @surface.github-actions-execution-sandbox
    Scenario: A named evidence check is confined and recorded
      Given a same-repository review has a declared unknown resolvable by a named deterministic check
      When Safeword runs that check in an eligible sandbox
      Then only the named argv command runs against the identified revision
      And the receipt records the command, revision, outcome, and unknown it addressed
