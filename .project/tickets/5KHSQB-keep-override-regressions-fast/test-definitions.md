# Test Definitions: Keep override regressions fast

## Rule: Override coverage reuses installed tooling without weakening assertions

### Scenario: All override examples run without upgrade-time installation

Given the repository has its development toolchain installed
And each temporary override fixture can resolve that toolchain locally
When the ten historical override examples run
Then every upgrade reconciles with package and skill installation disabled
And every generated lint-hook invocation completes without a launcher failure
And the TypeScript and Python override assertions remain green

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: single RGR loop; no cross-scenario refactor applies
