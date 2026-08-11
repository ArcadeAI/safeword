Feature: Reviewer collaborator protocol
  Scenario: Codex receives the documented review invocation
    When the review coordinator invokes Codex
    Then Codex receives the exact ordered collaborator arguments
