Feature: test-plan resolver
  safeword emits the test command for every language present in a repo.

  Scenario: The resolver handles tox repos and empty repos
    Given a Python repo with a "tox.ini"
    When I request the test plan
    Then the "python" entry command is "tox"
    Given a repo with no recognized language manifest
    When I request the test plan
    Then the plan is empty

  Scenario: A manifest inside an excluded directory is ignored
    Given a repo with a "Cargo.toml" only under "target"
    When I request the test plan
    Then the plan has no "rust" entry
