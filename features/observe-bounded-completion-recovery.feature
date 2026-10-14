@live
Feature: Observe current proof without inventing historical test work
  Scenario: Recovery observes the committed candidate itself
    When I observe the current committed 5F5ZZA candidate through the public CLI
    Then the retained recovery observation contains all 142 passing active cases
    And observation alone cannot close 5F5ZZA without independent certification
