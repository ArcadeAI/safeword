Feature: config loader
  safeword loads a project's config, applying documented defaults and rejecting malformed input.

  Scenario: A missing optional field falls back to its default
    Given a config file that omits the "timeout" field
    When the config is loaded
    Then the resolved "timeout" is 30

  Scenario: An unknown top-level key is rejected
    Given a config file with an unknown key "widgets"
    When the config is loaded
    Then loading fails with an "unknown key: widgets" error

  Scenario: No config file yields the full default set
    Given no config file on disk
    When the config is loaded
    Then the resolved config equals the documented defaults
