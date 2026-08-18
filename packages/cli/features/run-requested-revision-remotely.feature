Feature: Run the requested revision remotely with least privilege
  Customer-owned GitHub Actions should run the requested Safeword test lane
  against the requested immutable commit without unnecessary repository authority.
  A deterministic recording runner resolves the admitted workflow job and observes
  checkout inputs, repository process starts, and result evidence. A semantic workflow
  contract evaluator checks the bundled workflow's authority and dependencies.

  @remote-runner.TBU1.R1 @surface.github-actions-execution-sandbox
  Rule: remote-runner.TBU1.R1 — The remote job tests and reports the exact requested commit

    Scenario Outline: The requested commit is reported for a passing or failing test
      Given a remote test request names a valid full commit SHA that is not a branch tip
      When the remote test job runs a test plan that <behavior>
      Then the requested SHA, observed checkout ref, and reported revision are identical
      And the reported conclusion is <conclusion>

      Examples:
        | behavior | conclusion |
        | passes   | passed     |
        | fails    | failed     |

    @rejection
    Scenario Outline: An invalid commit value starts no repository test
      Given a remote test request names <invalid-revision>
      When the remote test job evaluates the request
      Then no repository checkout or test command runs
      And the job fails without reporting a test result

      Examples:
        | invalid-revision                              |
        | the branch name `main`                        |
        | the tag name `v1.2.3`                         |
        | the abbreviated SHA `0123456`                 |
        | exactly 39 lowercase hexadecimal characters  |
        | exactly 41 lowercase hexadecimal characters  |
        | exactly 40 uppercase hexadecimal characters  |
        | 39 lowercase hexadecimal characters plus `g` |
        | no revision                                   |

    @rejection
    Scenario: An unavailable requested commit is never replaced by another revision
      Given a remote test request names a full commit SHA unavailable to checkout
      When the remote test job attempts the request
      Then the job fails without running tests or reporting a substitute revision

    Scenario: A checkout that lands on another commit is rejected before tests
      Given checkout lands on a different commit than the valid requested SHA
      When the remote test job verifies the checkout
      Then no repository test command runs
      And the result rejects the checkout with both commit SHAs

    Scenario Outline: Cancellation is not reported as a request rejection or test conclusion
      Given a valid remote test request is cancelled during <phase>
      When the remote test job reports the interrupted request
      Then the reported conclusion is incomplete
      And the result has no rejection reason

      Examples:
        | phase                 |
        | validation            |
        | checkout              |
        | revision verification |

  @remote-runner.TBU1.R2 @surface.github-actions-execution-sandbox
  Rule: remote-runner.TBU1.R2 — The remote job runs only the requested supported test lane

    Scenario Outline: A supported lane runs its matching Safeword test plan
      Given a remote test request selects the <lane> lane
      When the remote test job executes the request
      Then the <lane> Safeword test-plan lane runs
      And no other Safeword test-plan lane runs

      Examples:
        | lane |
        | done |
        | full |

    @rejection
    Scenario Outline: An unsupported lane starts no repository test
      Given a remote test request selects the lane value "<lane>"
      When the remote test job evaluates the request
      Then no repository checkout or test command runs
      And the job fails without reporting a test result

      Examples:
        | lane         |
        | smoke        |
        | DONE         |
        |              |
        | done --watch |

  @remote-runner.TBU1.R3 @surface.github-actions-execution-sandbox
  Rule: remote-runner.TBU1.R3 — Repository code receives only the admitted read-only authority and immutable workflow dependencies

    Scenario: The bundled workflow is accepted under the minimum runner contract
      Given the bundled managed remote test workflow candidate
      When the runner contract evaluates the candidate
      Then the candidate is accepted under the minimum runner contract

    @rejection
    Scenario Outline: A workflow outside the minimum authority contract is rejected
      Given a candidate remote test workflow <violation>
      When the runner contract evaluates the candidate
      Then the candidate is rejected as outside the minimum runner contract

      Examples:
        | violation |
        | declares no token permissions |
        | grants repository write permission |
        | omits checkout |
        | persists the checkout credential |
        | references checkout by a mutable version |
        | references an additional remote action by a mutable version |
        | passes a Safeword-provided secret to the job |
