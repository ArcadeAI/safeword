# Test Definitions: Keep cloud-spooled retro filing from bypassing duplicate checks

Feature source: `packages/cli/features/canonical-retro-spool-dedupe.feature`

## Rule: New cloud spool records retain the code-owned canonical identity

### Scenario: A current spooled draft round-trips its canonical signature

- [x] RED: serialization test failed before the field existed
- [x] GREEN: valid sealed current draft round-trips and remains postable
- [x] REFACTOR: optional-field parser remains local to the spool

### Scenario: A malformed canonical signature spool field rejects the spool line

- [x] RED: malformed-record test failed before type validation
- [x] GREEN: non-string canonicalSignature is dropped
- [x] REFACTOR: shared parser retains legacy records

## Rule: Cloud filing uses a canonical identity only when it agrees with the code-owned body marker

### Scenario: A canonical field that differs from the body marker cannot select an issue

- [x] RED: no safe-use contract existed
- [x] GREEN: canonical helper returns undefined for a mismatch
- [x] REFACTOR: one exact-marker helper owns the rule

### Scenario: A missing canonical body marker disables canonical fallback

- [x] RED skip: same invalid-canonical partition
- [x] GREEN: absent marker returns undefined
- [x] REFACTOR skip: covered by the same pure helper

### Scenario: A legacy match remains usable when canonical fallback is disabled

- [x] RED skip: cloud MCP behavior is represented by the shipped prompt contract
- [x] GREEN: prompts preserve legacy-first lookup
- [x] REFACTOR skip: no TypeScript MCP implementation exists

## Rule: Cloud filing uses exact legacy-first canonical matching without title guesses

### Scenario: A legacy match takes precedence over a canonical match

- [x] RED skip: prompt-contract regression
- [x] GREEN: definition test pins legacy marker before canonical marker
- [x] REFACTOR skip: table-driven contract test

### Scenario: A canonical recurrence is acknowledged on its existing issue

- [x] RED skip: prompt-contract regression
- [x] GREEN: both definitions require exact canonical fallback
- [x] REFACTOR skip: table-driven contract test

### Scenario: A same-title issue without an exact marker is not acknowledged

- [x] RED skip: prompt-contract regression
- [x] GREEN: both definitions forbid title authority
- [x] REFACTOR skip: table-driven contract test

### Scenario: A pull request marker is not acknowledged as an issue

- [x] RED skip: prompt-contract regression
- [x] GREEN: both definitions require is:issue is:open
- [x] REFACTOR skip: table-driven contract test

### Scenario: A closed issue marker is not acknowledged

- [x] RED skip: prompt-contract regression
- [x] GREEN: both definitions require is:issue is:open
- [x] REFACTOR skip: table-driven contract test

### Scenario: Both shipped filer definitions direct the current spool contract

- [x] RED: both templates lacked the canonical procedure
- [x] GREEN: parse-plus-contract test covers Markdown and TOML
- [x] REFACTOR: table-driven assertions avoid duplication

## Rule: Older spool records remain fileable through legacy signature matching

### Scenario: A legacy spooled draft is acknowledged by its legacy signature

- [x] RED skip: retained behavior
- [x] GREEN: optional field leaves legacy spool records valid
- [x] REFACTOR skip: no change needed

### Scenario: An unmatched legacy draft is filed as new

- [x] RED skip: prompt-contract regression
- [x] GREEN: definitions prohibit title fallback for legacy records
- [x] REFACTOR skip: table-driven contract test

## Feature-level cross-scenario refactor

- [x] cross-scenario: canonical eligibility is one pure helper; template checks are table-driven.
