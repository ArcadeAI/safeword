Feature: Live editor activation
  Scenario: The installed plugin activates after restart
    When I restart the live editor
    Then the installed plugin is active
