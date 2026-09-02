# Test Definitions: Let users rank local reviewers and models

Feature source: `packages/cli/features/rank-local-reviewers-and-models.feature`

## Scenario: Explicit reviewer and model routes run in configured order

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Reversed reviewer and model routes run in configured order

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Cached observations do not change route order

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Runtime default keeps its configured position

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: First successful independent route completes the review

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Invalid model identifiers reject route configuration

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Empty route lists reject configuration

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Unfunded routes are reported without launch

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Runtime-wide failure skips later models on that runtime

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Attempt failure keeps the next model on that runtime eligible

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Exhausted configured routes remain blocked

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: A valid funded route launches normally

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Same-author success cannot satisfy independent review

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Last same-author success remains degraded

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Catalogued models are not reported as proven

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Successful review records proven evidence

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Unlisted models are not reported as catalogued

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Installed runtimes without model selection are not compatible

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Missing runtimes are reported as not installed

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Most recent failure replaces stale proven evidence

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario Outline: Legacy settings preserve the existing route plan

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Scenario: Ordered routes replace legacy route settings when both exist

- [x] RED: db83e7761
- [x] GREEN: 9f6f6efbd
- [x] REFACTOR: 9f6f6efbd

## Feature-level cross-scenario refactor

- [x] cross-scenario: 9f6f6efbd
