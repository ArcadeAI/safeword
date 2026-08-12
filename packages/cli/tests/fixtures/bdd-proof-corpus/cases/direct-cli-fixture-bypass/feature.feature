Feature: Hermetic CLI fixture execution
  Scenario: A BDD step runs the CLI through a sanitized fixture
    When the step invokes the real CLI
    Then the result is sanitized runner-envelope evidence
