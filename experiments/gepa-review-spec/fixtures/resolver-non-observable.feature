Feature: test-plan resolver
  safeword emits the test command for every language present in a repo.

  Scenario: Python with a tox.ini runs tox
    Given a Python repo with a "tox.ini"
    When I request the test plan
    Then the "python" entry command is "tox"

  Scenario: A repo with no recognized manifest yields an empty plan
    Given a repo with no recognized language manifest
    When I request the test plan
    Then the plan is empty

  Scenario: A manifest inside an excluded directory is ignored
    Given a repo with a "Cargo.toml" only under "target"
    When I request the test plan
    Then the resolver's internal exclude-set contains "target"
