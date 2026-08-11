Feature: Publish a package
  Scenario: An unsigned package is rejected
    When I publish an unsigned package
    Then publishing is refused
