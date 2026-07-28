# Test definitions: local acceptance verification

## Scenario: Complete local test command composes both lanes

Given the repository root manifest

When its scripts are inspected

Then `test:all` runs `test` before `test:bdd`

And the command stops if the unit suite fails before acceptance tests start

## Scenario: Contributor documentation names the complete command

Given the README development workflow

When a contributor looks up the command for all local tests

Then it names `bun run test:all`

And it labels `bun run test` as the Vitest suite rather than every test

## Test type

Unit/document-contract test: the behavior is a deterministic manifest and README contract; a subprocess test would repeat the already-passing suite rather than improve diagnosis.
