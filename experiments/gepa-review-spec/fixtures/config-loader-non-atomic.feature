Feature: config loader
  safeword loads a project's config, applying documented defaults and rejecting malformed input.

  Scenario: Loading resolves defaults and rejects unknown keys
    Given a config file that omits the "timeout" field
    And a config file with an unknown key "widgets"
    When each config is loaded
    Then the first resolves "timeout" to 30
    And the second fails with an "unknown key: widgets" error

  Scenario: No config file yields the full default set
    Given no config file on disk
    When the config is loaded
    Then the resolved config equals the documented defaults
