Feature: test-plan resolver
  safeword emits the test command for every language present in a repo.

  Scenario: Requesting a plan that already lists python
    Given a test plan that already contains a "python" entry for "tox"
    When I request the test plan
    Then the plan includes a "python" entry

  Scenario: A repo with no recognized manifest yields an empty plan
    Given a repo with no recognized language manifest
    When I request the test plan
    Then the plan is empty

  Scenario: A manifest inside an excluded directory is ignored
    Given a repo with a "Cargo.toml" only under "target"
    When I request the test plan
    Then the plan has no "rust" entry
