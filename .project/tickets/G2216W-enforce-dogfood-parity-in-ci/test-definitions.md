# Test Definitions: Enforce dogfood parity in CI

## Rule: CI exposes an explicit parity gate

### Scenario: Pull request runs the parity command

- [x] RED skip: the focused workflow test was added with the initial implementation and was observed failing before the job existed.
- [x] GREEN 783aa4927
- [x] REFACTOR skip: a standalone job is already the smallest non-duplicative shape.
