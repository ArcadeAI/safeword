@proof.vitest @surface.safeword-cli
Feature: Configure review routes by scope

  Rule: User routes apply when the project has no route list for the author

    @scoped-review-routes.TBU1.R1
    Scenario: A user preference supplies the effective route list
      Given a user route list for the current author
      And the project has no route list for that author
      When effective routes are resolved through the real CLI
      Then the effective routes are exactly the user routes in user order with their configured models

    @scoped-review-routes.TBU1.R1
    Scenario: A project preference for another author does not mask the user list
      Given a user route list for the current author
      And the project configures routes only for another author
      When effective routes are resolved through the real CLI
      Then the effective routes are exactly the user routes in user order with their configured models

    @scoped-review-routes.TBU1.R1
    Scenario: An empty project routes object preserves the user list
      Given a user route list for the current author
      And the project config holds an empty routes object
      When effective routes are listed through the real CLI
      Then the listing reports the user profile as the source
      And it reports exactly the user routes in user order with their configured models

  Rule: Project routes replace user routes for the same author

    @scoped-review-routes.TBU1.R2
    Scenario: A project list wins without merging
      Given different user and project route lists for the current author
      When effective routes are resolved through the real CLI
      Then only the project routes are returned in project order

    @scoped-review-routes.TBU1.R2
    Scenario: A project-only list is authoritative
      Given the project configures routes for the current author
      And the user scope has no routes for that author
      When effective routes are listed through the real CLI
      Then it reports only the project routes in project order

  Rule: Configuration changes preserve unrelated settings

    @scoped-review-routes.TBU1.R3
    Scenario Outline: Set replaces one author only at the selected scope
      Given both configs hold routes for two authors and unrelated settings
      And the selected scope has existing routes for the current author
      When the real CLI sets routes for the current author at <scope> scope
      Then the <scope> config holds exactly the new routes for the current author
      And the other config is left byte-for-byte unchanged
      And unrelated settings and the other author routes are unchanged

      Examples:
        | scope   |
        | user    |
        | project |

    @scoped-review-routes.TBU1.R3
    Scenario: Resetting an absent project entry is a no-op
      Given no project config exists
      And only the user scope has routes for the current author
      When the real CLI resets routes for that author at project scope
      Then the command succeeds
      And no project config file is created and the user routes still apply

    @scoped-review-routes.TBU1.R3
    Scenario Outline: Reset removes one author only at the selected scope
      Given both configs hold routes for two authors and unrelated settings
      When the real CLI resets routes for one author at <scope> scope
      Then only that author entry is removed from the <scope> config
      And the other config is left byte-for-byte unchanged
      And unrelated settings and the other author routes are unchanged

      Examples:
        | scope   |
        | user    |
        | project |

  Rule: Effective inspection explains the selected configuration

    @scoped-review-routes.TBU1.R4
    Scenario: Effective list reports source order and runtime defaults
      Given the user profile holds an ordered route list with an explicit model and a runtime-default route
      When effective routes are listed through the real CLI
      Then the listing reports the user profile as the source
      And it reports the explicit model first and the runtime default second

    @scoped-review-routes.TBU1.R4
    Scenario: Effective list reports a project override
      Given user and project route lists for the current author
      When effective routes are listed through the real CLI
      Then the listing reports the project config as the source
      And it reports only the project routes in project order

    @scoped-review-routes.TBU1.R4
    Scenario: Listing without an author explains every author
      Given no scope has routes for any author
      When effective routes are listed through the real CLI without naming an author
      Then the listing reports claude, codex, and opencode in that order

    @scoped-review-routes.TBU1.R4
    Scenario: The listing names the setting that changes it
      Given no scope has routes for the current author
      When effective routes are listed through the real CLI
      Then the listing names the crossAgentReviewRoutes key and the project config path

    @scoped-review-routes.TBU1.R4
    Scenario: An author that is not a review agent is refused
      When routes are listed through the real CLI for an author that is not a review agent
      Then the command fails and names claude, codex, and opencode as the accepted authors

  Rule: Malformed persisted configuration fails visibly without silent fallback

    @scoped-review-routes.TBU1.R5
    Scenario Outline: Malformed scoped configuration fails visibly
      Given the <scope> config contains malformed JSON
      And the other scope has valid routes for the current author
      When effective routes are resolved through the real CLI
      Then the command fails and names the unreadable <scope> config
      And no routes are resolved from the other scope

      Examples:
        | scope   |
        | user    |
        | project |

    @scoped-review-routes.TBU1.R5
    Scenario Outline: Malformed scoped configuration is never overwritten
      Given the <scope> config contains malformed JSON
      When the real CLI sets routes for the current author at <scope> scope
      Then the command fails and names the unreadable <scope> config
      And the <scope> config is left byte-for-byte unchanged

      Examples:
        | scope   |
        | user    |
        | project |

    @scoped-review-routes.TBU1.R5
    Scenario Outline: Malformed scoped configuration is not reset
      Given the <scope> config contains malformed JSON
      When the real CLI resets routes for the current author at <scope> scope
      Then the command fails and names the unreadable <scope> config
      And the <scope> config is left byte-for-byte unchanged

      Examples:
        | scope   |
        | user    |
        | project |

    @scoped-review-routes.TBU1.R5
    Scenario Outline: A malformed non-target scope does not block mutation
      Given the <other_scope> config contains malformed JSON
      When the real CLI sets routes for the current author at <scope> scope
      Then the command succeeds and the <scope> config holds exactly the new routes
      And the <other_scope> config is left byte-for-byte unchanged

      Examples:
        | scope   | other_scope |
        | user    | project     |
        | project | user        |

    @scoped-review-routes.TBU1.R5
    Scenario Outline: A malformed non-target scope does not block reset
      Given the <other_scope> config contains malformed JSON
      And the <scope> config has routes for the current author
      When the real CLI resets routes for the current author at <scope> scope
      Then the command succeeds and the author entry is removed from the <scope> config
      And the <other_scope> config is left byte-for-byte unchanged

      Examples:
        | scope   | other_scope |
        | user    | project     |
        | project | user        |

    @scoped-review-routes.TBU1.R5
    Scenario Outline: An empty configured route list fails visibly
      Given the <scope> config configures an empty route list for the current author
      And the other scope has valid routes for that author
      When effective routes are resolved through the real CLI
      Then the command fails and names the invalid <scope> route list
      And no routes are resolved from the other scope

      Examples:
        | scope   |
        | user    |
        | project |

  Rule: Absent scoped routes resolve to the unchanged built-in fallback chain

    @scoped-review-routes.TBU1.R6
    Scenario: Absent scoped preferences preserve built-in behavior
      Given neither scope has routes for the current author
      When effective routes are listed through the real CLI
      Then the listing reports built-in defaults as the source
      And it reports the built-in default routes in built-in order

    @scoped-review-routes.TBU1.R6
    Scenario: Reset restores built-in defaults
      Given only the user scope has routes for the current author
      When the real CLI resets routes for that author at user scope
      Then effective routes listed through the real CLI report built-in defaults as the source
      And they report the built-in default routes in built-in order

    @scoped-review-routes.TBU1.R6
    Scenario: Reset restores the next scope
      Given user and project route lists for the current author
      When the real CLI resets routes for that author at project scope
      Then effective routes listed through the real CLI report the user profile as the source
      And they report the user routes in user order

  Rule: First writes create exactly one config at the selected scope

    @scoped-review-routes.TBU1.R7
    Scenario: First user-scope set creates one profile outside the project
      Given no user profile exists
      When the real CLI sets routes for the current author at user scope
      Then one user profile is created outside the project directory with exactly those routes
      And the project working tree gains no new file

    @scoped-review-routes.TBU1.R7
    Scenario: First project-scope set creates the project config
      Given no project config exists
      When the real CLI sets routes for the current author at project scope
      Then one project config is created with exactly those routes
      And no user profile is created
