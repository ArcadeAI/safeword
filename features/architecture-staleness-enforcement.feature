@architecture-staleness-enforcement
Feature: Enforced freshness of the generated architecture doc (Slice 2, single-repo)

  Builds on Slice 1's self-heal: the generated architecture doc
  (.project/architecture.generated.md) is not just refreshed at session start but
  kept fresh through commits. During an agent session a structural change is
  regenerated and staged into the commit automatically, and a CI check is the hard
  backstop so a stale doc can never reach the main branch — covering a bypassed
  hook or a human's hand-written commit. Enforcement is on by default and can be
  opted out per project. It governs only safeword-owned structure: foreign
  hand-written docs and lagging prose stay advisory, never blocking.

  Rule: A structural change is committed fresh, automatically and without blocking

    @architecture-staleness-enforcement.TB1.AC1
    Scenario Outline: A would-change doc is regenerated and staged into the commit
      Given a project whose committed architecture doc is <state>
      When the agent commits the project
      Then a freshly-generated architecture doc carrying the current shape-fingerprint is staged in that commit
      And the commit is not blocked

      Examples:
        | state                                         |
        | absent while modules exist (uncreated)        |
        | behind the current shape (stale)              |
        | present but missing its fingerprint (corrupt) |

    @architecture-staleness-enforcement.TB1.AC3
    Scenario: Auto-staging preserves an unrelated staged change
      Given an unrelated file is already staged for commit
      And the committed architecture doc is behind the current shape
      When the agent commits the project
      Then the unrelated staged change is still part of the commit
      And the regenerated architecture doc is also part of the commit

  Rule: A doc that needs no change is left untouched at commit time

    @architecture-staleness-enforcement.TB1.AC2
    Scenario Outline: A doc that needs no change is not staged
      Given a project whose committed architecture doc is <state>
      When the agent commits the project
      Then the architecture doc is not staged
      And the commit is not blocked

      Examples:
        | state                                  |
        | current with the shape (unchanged)     |
        | absent with no modules (noop)          |

    @architecture-staleness-enforcement.TB1.AC2
    Scenario: A foreign hand-written doc is never auto-staged
      Given an architecture doc with no safeword generator marker
      And the project's structure has since changed
      When the agent commits the project
      Then the foreign doc is left untouched
      And the commit is not blocked

  Rule: A stale architecture doc cannot reach the main branch

    @architecture-staleness-enforcement.TB2.AC1
    Scenario Outline: The CI check fails when the committed doc would change
      Given a committed architecture doc that is <state>
      When the architecture check runs
      Then the check exits non-zero

      Examples:
        | state                                         |
        | absent while modules exist (uncreated)        |
        | behind the current shape (stale)              |
        | present but missing its fingerprint (corrupt) |

    @architecture-staleness-enforcement.TB2.AC1
    Scenario: The CI check defaults to on when no config file is present
      Given a repository with no safeword config file
      And a committed architecture doc behind the current shape
      When the architecture check runs
      Then the check exits non-zero

    @architecture-staleness-enforcement.TB2.AC2
    Scenario Outline: The CI check passes when nothing needs to change
      Given a committed architecture doc that is <state>
      When the architecture check runs
      Then the check exits zero

      Examples:
        | state                              |
        | current with the shape (fresh)     |
        | absent with no modules (noop)      |
        | a foreign hand-written doc         |

  Rule: Enforcement is on by default and can be opted out per project

    @architecture-staleness-enforcement.TB3.AC1
    Scenario Outline: The commit-time auto-fix obeys the enforcement switch
      Given the committed architecture doc is behind the current shape
      And architectureDocEnforcement config is <config>
      When the agent commits the project
      Then the stale doc is <result>

      Examples:
        | config                 | result                                 |
        | absent (default-on)    | regenerated and staged into the commit |
        | set to false (opt-out) | left unchanged and not staged          |

    @architecture-staleness-enforcement.TB3.AC2
    Scenario: Opting out makes the CI check pass despite a stale doc
      Given a project with architectureDocEnforcement set to false
      And a committed architecture doc behind the current shape
      When the architecture check runs
      Then the check exits zero
