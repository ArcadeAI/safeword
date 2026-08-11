Feature: Token validation
  Scenario: An expired token is rejected
    When I submit token "expired"
    Then the response status is 401

  Scenario: A current token is accepted
    When I submit token "current"
    Then the response status is 200
