Feature: Installed plugin outcome
  Scenario: Successful installation reports activation guidance
    When plugin installation finishes
    Then installation succeeds and reload guidance is shown
