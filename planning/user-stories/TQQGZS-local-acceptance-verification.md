# Run acceptance coverage locally for contributors

## User story

As a Safeword contributor, I want one clearly named local test command so that I can run the same unit and Gherkin acceptance coverage before pushing a change.

## Acceptance criteria

1. Given a contributor is at the repository root, when they run `bun run test:all`, then unit tests run before the Gherkin acceptance suite.
2. Given a contributor reads the development testing guide, when they need complete local coverage, then it names `bun run test:all` instead of implying that `bun run test` is every test.
3. Given a contributor only needs fast static feedback, when they run `bun run lint`, then its behavior and cost remain unchanged.

## Out of scope

- Adding customer-project scripts to Safeword's installation schema.
- Changing CI workflow composition or pre-commit hooks.
- Making lint run acceptance tests.
