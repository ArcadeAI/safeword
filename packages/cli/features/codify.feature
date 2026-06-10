@spec:102a @smoke
Feature: safeword codify emits a Gherkin skeleton

  The dogfood acceptance test for ticket 102a: safeword runs its own
  `.feature` specs through cucumber-js, the same setup it scaffolds for
  customers. Drives the built CLI from the outside.

  @fast
  Scenario: Codify a ticket as a Gherkin feature
    Given a ticket "DEMO" with one scenario
    When I run "codify DEMO --format gherkin"
    Then the output contains "Feature:"
    And the output contains "Scenario:"
