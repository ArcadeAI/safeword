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

  Scenario: No Prettier nag at session start in a Biome repo
    Given a repo whose formatting is owned by Biome
    When safeword runs its session lint check
    Then the lint hook's internal prettierMissing flag stays false
