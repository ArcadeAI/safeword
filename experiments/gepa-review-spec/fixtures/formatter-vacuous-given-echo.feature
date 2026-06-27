Feature: Formatter-aware lint hook
  safeword's auto-lint hook defers to whatever formatter a repo already uses.

  Scenario: A file already written with double quotes still has double quotes
    Given a TypeScript file already written with double quotes
    When the agent edits that file
    Then the file uses double quotes

  Scenario: A greenfield repo is formatted with safeword's defaults
    Given a repo with no formatter configuration
    When the agent edits a TypeScript file
    Then the file is formatted with safeword's Prettier style

  Scenario: No Prettier nag at session start in a Biome repo
    Given a repo whose formatting is owned by Biome
    When safeword runs its session lint check
    Then it emits no warning that Prettier is missing
