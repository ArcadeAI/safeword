Feature: Shared actor adapter contract
  Scenario: Claude evidence keeps its actor identity
    When I observe settings through the "claude" actor adapter
    Then the evidence names that actor and its observed state

  Scenario: Codex evidence keeps its actor identity
    When I observe settings through the "codex" actor adapter
    Then the evidence names that actor and its observed state
