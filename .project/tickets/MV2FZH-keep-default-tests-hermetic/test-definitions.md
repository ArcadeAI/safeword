# Test Definitions: Keep default tests hermetic

## Rule: Default setup fixtures do not install dependencies

### Scenario: A default setup fixture skips package installation

- [x] RED — `setup-or-throw.test.ts` observed no default environment.
- [x] GREEN — default fixture environment now sets `SAFEWORD_SKIP_INSTALL=1`.
- [x] REFACTOR — the existing helper remains the single setup seam.

### Scenario: An explicit setup environment can opt into installation

- [x] RED — explicit environment precedence was unprotected.
- [x] GREEN — the focused test proves an explicit empty value overrides the default.
- [x] REFACTOR — one environment merge keeps the opt-in path local.
