Feature: Build source-map provenance
  Scenario: The acceptance fixture uses the current CLI build
    When I inspect the built CLI artifacts
    Then every reachable artifact has current source-map provenance
