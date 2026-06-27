Feature: Formatter-aware lint hook
  safeword's auto-lint hook defers to whatever formatter a repo already uses.

  Scenario: The hook respects both customer Prettier and greenfield defaults
    Given a repo with its own Prettier config that uses double quotes
    When the agent edits a TypeScript file
    Then the file is formatted with double quotes
    Given a repo with no formatter configuration
    When the agent edits a TypeScript file
    Then the file is formatted with safeword's Prettier style

  Scenario: No Prettier nag at session start in a Biome repo
    Given a repo whose formatting is owned by Biome
    When safeword runs its session lint check
    Then it emits no warning that Prettier is missing
