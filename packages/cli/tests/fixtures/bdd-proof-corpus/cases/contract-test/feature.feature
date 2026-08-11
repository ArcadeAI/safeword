Feature: Review result contract
  Scenario: A blocked review maps to action required
    When I map a blocked review result
    Then the contract state is "action_required"
