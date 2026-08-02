# Test Definitions: Prevent stale Safe Word guidance from blocking Codex users

Feature source: `packages/cli/features/prevent-legacy-global-instructions.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Current Safe Word project paths remain authoritative when legacy profile guidance is present

### Scenario: Session context explicitly supersedes retired Safe Word paths

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Retired paths are never presented as current Safe Word authority

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Conflicting profile guidance is diagnosed without changing user-owned content

### Scenario: Read-only diagnostics classify conflicting global guidance without mutation

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: User-authored global guidance is not reported as Safe Word legacy content

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: Positively identified historical content has an explicit recoverable cleanup path

### Scenario: Edited legacy guidance is refused during cleanup

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Guidance changed after diagnosis is preserved

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Guidance changed at the move boundary is restored

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A concurrently recreated active file is preserved during restoration

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Exact legacy guidance is moved to a recoverable backup

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Existing cleanup backup is never overwritten

- [x] RED
- [x] GREEN
- [x] REFACTOR

---

## Feature-level cross-scenario refactor

- [x] cross-scenario
