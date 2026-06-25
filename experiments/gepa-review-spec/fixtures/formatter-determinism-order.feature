Feature: Formatter-aware lint hook
  safeword's auto-lint hook defers to whatever formatter a repo already uses.

  Scenario: Edits follow the customer's Prettier style, not safeword's
    Given a repo with its own Prettier config that uses double quotes
    When the agent edits a TypeScript file
    Then the file is formatted with double quotes

  Scenario: A greenfield repo is formatted with safeword's defaults
    Given a repo with no formatter configuration
    When the agent edits a TypeScript file
    Then the file is formatted with safeword's Prettier style

  Scenario: The session lint check lists findings in a fixed order
    Given a repo with both a Prettier issue and an ESLint issue
    When safeword runs its session lint check
    Then the first reported finding is the Prettier issue
    And the second reported finding is the ESLint issue
