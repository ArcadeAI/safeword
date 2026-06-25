Feature: test-plan resolver
  safeword emits the test command for every language present in a repo.

  Scenario: Python with a tox.ini runs tox
    Given a Python repo with a "tox.ini"
    When I request the test plan
    Then the "python" entry command is "tox"

  Scenario: A manifest inside an excluded directory is ignored
    Given a repo with a "Cargo.toml" only under "target"
    When I request the test plan
    Then the plan has no "rust" entry

  Scenario: A Cargo.toml under target is detected
    Given a repo with a "Cargo.toml" only under "target"
    When I request the test plan
    Then the plan includes a "rust" entry
