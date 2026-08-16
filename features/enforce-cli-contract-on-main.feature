@manual @surface.github-actions-execution-sandbox
Feature: Enforce the CLI contract on main
  The live GitHub ruleset is external mutable policy. Trusted maintainers verify
  it through GitHub rather than representing a historical rollout as a repeatable
  local Vitest proof.

  Rule: Ordinary pull requests cannot merge unless the current CLI contract passes

    Scenario: The rollout observes the dedicated context before requiring it
      Given the dedicated CLI contract check has reported for the pull-request head
      When a trusted maintainer stages the required-check rollout
      Then the selected context is exactly CLI contract for that pull-request head

    @rejection
    Scenario Outline: Unsatisfied contract results cannot permit an ordinary merge
      Given the CLI contract context is <state>
      When a trusted maintainer inspects merge eligibility for the pull-request head
      Then the live ruleset does not treat the contract as satisfied

      Examples:
        | state |
        | pending |
        | skipped |
        | neutral |
        | failed |
        | successful for a different commit SHA |
        | reported under a different context name |

    Scenario: The live main ruleset requires the exact context strictly
      Given a trusted maintainer inspects the live ruleset through the GitHub API
      When the staged rollout completes
      Then main requires CLI contract with strict current-main behavior no ordinary pull-request bypass and only explicit auditable administrative bypasses
