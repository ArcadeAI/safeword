Feature: Review CLI distribution
  Scenario: Claude receives the review contract
    When the review distribution suite runs
    Then the Claude contract is installed

  Scenario: Codex receives the review contract
    When the review distribution suite runs
    Then the Codex contract is installed
