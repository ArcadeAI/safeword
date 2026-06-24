Feature: test-plan resolver
  safeword emits the test command for every language present in a repo.

  Scenario: A JS+Python repo lists javascript before python
    Given a repo with a root "test" script and a "pyproject.toml"
    When I request the test plan
    Then the first plan entry is "javascript"
    And the second plan entry is "python"

  Scenario: A repo with no recognized manifest yields an empty plan
    Given a repo with no recognized language manifest
    When I request the test plan
    Then the plan is empty

  Scenario: A manifest inside an excluded directory is ignored
    Given a repo with a "Cargo.toml" only under "target"
    When I request the test plan
    Then the plan has no "rust" entry
