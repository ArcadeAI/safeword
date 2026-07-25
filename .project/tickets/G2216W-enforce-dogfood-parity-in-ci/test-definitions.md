# Test Definitions: Enforce dogfood parity in CI

## Rule: CI exposes an explicit parity gate

### Scenario: Pull request runs the parity command

- [x] RED — a focused workflow test fails until the job and command exist.
- [x] GREEN — the workflow declares `dogfood-parity` and runs the all-mode parity check.
- [x] REFACTOR — the check remains a small standalone job with no duplicate implementation.
