# Test Definitions: Let users rank local reviewers and models

Feature source: `packages/cli/features/rank-local-reviewers-and-models.feature`

## Scenario: Explicit reviewer and model routes run in configured order

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Reversed reviewer and model routes run in configured order

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Cached observations do not change route order

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Runtime default keeps its configured position

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: First successful independent route completes the review

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Invalid model identifiers reject route configuration

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Empty route lists reject configuration

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Unfunded routes are reported without launch

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Runtime-wide failure skips later models on that runtime

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Attempt failure keeps the next model on that runtime eligible

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Exhausted configured routes remain blocked

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: A valid funded route launches normally

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Same-author success cannot satisfy independent review

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Last same-author success remains degraded

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Catalogued models are not reported as proven

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Successful review records proven evidence

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Unlisted models are not reported as catalogued

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Installed runtimes without model selection are not compatible

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Missing runtimes are reported as not installed

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Most recent failure replaces stale proven evidence

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario Outline: Legacy settings preserve the existing route plan

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Scenario: Ordered routes replace legacy route settings when both exist

- [x] RED: `db83e7761` introduced the approved behavior contract before the ranked-route implementation existed.
- [x] GREEN: the focused policy, runtime, durable-job, and public-command suites pass against the implemented behavior.
- [x] REFACTOR: the shared refactor/fix passes through `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd` preserved this scenario while reducing duplication and correcting evidence semantics.

## Feature-level cross-scenario refactor

- [x] cross-scenario: shared route parsing, evidence projection, and inspection helpers were simplified across `a78fe51a4`, `bc22a2382`, `84cebba2b`, and `9f6f6efbd`; focused suites remained green.
