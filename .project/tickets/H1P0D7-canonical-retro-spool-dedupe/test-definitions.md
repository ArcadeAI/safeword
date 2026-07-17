# Test Definitions: Keep cloud-spooled retro filing from bypassing duplicate checks

Feature source: `packages/cli/features/canonical-retro-spool-dedupe.feature`

## Rule: New cloud spool records retain the code-owned canonical identity

### Scenario: A current spooled draft round-trips its canonical signature

- [x] RED skip: tests were authored and implemented in one local TDD pass
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: optional-field parser remains local to the spool

### Scenario: A malformed canonical signature spool field rejects the spool line

- [x] RED skip: tests were authored and implemented in one local TDD pass
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: shared parser retains legacy records

## Rule: Cloud filing uses a canonical identity only when it agrees with the code-owned body marker

### Scenario: A canonical field that differs from the body marker cannot select an issue

- [x] RED skip: tests were authored and implemented in one local TDD pass
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: one exact-marker helper owns the rule

### Scenario: A missing canonical body marker disables canonical fallback

- [x] RED skip: same invalid-canonical partition
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: covered by the same pure helper

### Scenario: A legacy match remains usable when canonical fallback is disabled

- [x] RED skip: cloud MCP behavior is represented by the shipped prompt contract
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: no TypeScript MCP implementation exists

## Rule: Cloud filing uses exact legacy-first canonical matching without title guesses

### Scenario: A legacy match takes precedence over a canonical match

- [x] RED skip: prompt-contract regression
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: table-driven contract test

### Scenario: A canonical recurrence is acknowledged on its existing issue

- [x] RED skip: prompt-contract regression
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: table-driven contract test

### Scenario: A same-title issue without an exact marker is not acknowledged

- [x] RED skip: prompt-contract regression
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: table-driven contract test

### Scenario: A pull request marker is not acknowledged as an issue

- [x] RED skip: prompt-contract regression
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: table-driven contract test

### Scenario: A closed issue marker is not acknowledged

- [x] RED skip: prompt-contract regression
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: table-driven contract test

### Scenario: Both shipped filer definitions direct the current spool contract

- [x] RED skip: tests were authored and implemented in one local TDD pass
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: table-driven assertions avoid duplication

## Rule: Older spool records remain fileable through legacy signature matching

### Scenario: A legacy spooled draft is acknowledged by its legacy signature

- [x] RED skip: retained behavior
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: no change needed

### Scenario: An unmatched legacy draft is filed as new

- [x] RED skip: prompt-contract regression
- [x] GREEN skip: focused verification is recorded in verify.md
- [x] REFACTOR skip: table-driven contract test

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: canonical eligibility is one pure helper and template checks are table-driven.
