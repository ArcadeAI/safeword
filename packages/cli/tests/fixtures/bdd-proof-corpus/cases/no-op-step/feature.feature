Feature: Refuse an invalid token
  Scenario: An expired token is rejected
    When I submit an expired token
    Then access is denied
