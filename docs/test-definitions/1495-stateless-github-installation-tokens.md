# Test definitions: accept and redact stateless GitHub installation tokens

Source: GitHub issue #1495 and
`docs/user-stories/1495-stateless-github-installation-tokens.md`.

## Rule: valid GitHub installation tokens are selected

### Scenario: classic opaque and stateless `ghs_` values reach the transport

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: validation stays anchored and rejects placeholders

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: stateless GitHub installation tokens are fully scrubbed

### Scenario: rule ordering determines full versus partial redaction

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: trailing hyphen and underscore leave no token residue

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: classic GitHub tokens remain fully scrubbed

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

- [x] cross-scenario — skip: shared fixtures and mutation helper are already
      scoped once; validator anchoring and scrubber ordering require separate
      production patterns.
