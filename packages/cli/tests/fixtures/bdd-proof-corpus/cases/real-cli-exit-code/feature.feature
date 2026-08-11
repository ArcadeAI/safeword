Feature: CLI process outcomes
  Scenario: Unknown command is rejected
    When I run an unknown safeword command
    Then the CLI exits nonzero and reports the unknown command

  Scenario: Help is accepted
    When I run safeword help
    Then the CLI exits 0 and prints usage
