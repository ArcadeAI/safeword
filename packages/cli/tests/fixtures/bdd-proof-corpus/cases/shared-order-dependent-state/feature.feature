Feature: Account lifecycle
  Scenario: Create an account
    When I create account A
    Then account A exists

  Scenario: Delete an account
    When I delete account A
    Then account A is absent
