@wip
Feature: Install only a trusted remote-test workflow

  @install-only-trusted-remote-test-workflows.TBU1.R1 @surface.github-actions-execution-sandbox
  Rule: install-only-trusted-remote-test-workflows.TBU1.R1 — The shipped workflow grants only the authority required for explicitly requested tests

    Scenario: The exact bundled workflow is admitted
      Given the release validator reads the real bundled remote-test workflow
      When release validation runs
      Then the workflow is manual-only
      And the parser resolves the bundled `on` key as the trigger mapping
      And permissions are exactly top-level `contents: read` with no job override
      And it contains exactly one test job, one registered pre-check dependency, one checkout dependency, and the registered step list
      And every remote dependency is pinned to a full lowercase commit SHA
      And checkout credentials are not persisted
      And no secret declaration or secret expression exists
      And exactly the expected test job runs the full test lane
      And the packaged, schema, and ownership-identity bytes are identical to the source template bytes
      And those admitted bytes become the published installable managed identity

    @rejection
    Scenario Outline: Each authority boundary rejects a representative violation
      Given the valid bundled workflow is changed only by <mutation>
      When release validation runs
      Then validation fails for <property> and no new managed identity is emitted
      Examples:
        | mutation | property |
        | adding an automatic trigger | `manual-only` |
        | removing the manual trigger | `manual-only` |
        | granting write permission | `least-privilege` |
        | adding a second read-only permission scope | `least-privilege` |
        | omitting top-level permissions | `least-privilege` |
        | adding a job-level permission override | `least-privilege` |
        | replacing an action SHA with a tag | `immutable-dependencies` |
        | replacing an action SHA with a short lowercase SHA | `immutable-dependencies` |
        | adding an unpinned reusable workflow | `immutable-dependencies` and `registered-dependencies` |
        | adding a SHA-pinned unregistered remote action | `registered-dependencies` |
        | adding a `docker://` action | `immutable-dependencies` and `registered-dependencies` |
        | adding a local `./` action | `immutable-dependencies` and `registered-dependencies` |
        | enabling persisted checkout credentials | `credential-safe` |
        | adding a secret expression | `secret-free` |
        | adding a secret declaration | `secret-free` |
        | adding a second job | `expected-test-lane` |
        | removing the checkout step | `expected-test-lane` and `credential-safe` |
        | removing the registered pre-check step | `expected-test-lane` and `registered-dependencies` |
        | changing the full test command | `expected-test-lane` |

    @rejection
    Scenario Outline: Representative ambiguous YAML is rejected
      Given the valid bundled workflow is changed only by <form>
      When release validation runs
      Then the parse-ambiguity guard rejects the workflow and no new managed identity is emitted
      Examples:
        | form |
        | adding duplicate mapping keys |
        | adding an alias or merge key |
        | adding another YAML document |
        | replacing the permissions mapping with a scalar |
        | replacing the raw-source `on` key with a literal `true` key |

    @rejection
    Scenario Outline: Representative single-artifact byte drift blocks release
      Given <artifact> alone differs while every other distribution artifact is identical
      When release validation runs
      Then the distribution-byte-identity guard reports a mismatch involving <artifact>
      And release fails and no installable managed identity is published
      Examples:
        | artifact |
        | the source template |
        | the packaged workflow |
        | schema registration |
        | the HWZZJ8 ownership identity |
