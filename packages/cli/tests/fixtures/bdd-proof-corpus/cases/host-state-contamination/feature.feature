Feature: Claude-only fixture isolation
  Scenario: Claude setup ignores unrelated user agent state
    When I run the Claude-only setup scenario
    Then only Claude state influences the result
