# Test Definitions: Keep cloud-spooled retro filing from bypassing duplicate checks

Feature source: `packages/cli/features/canonical-retro-spool-dedupe.feature`

## Rule: New cloud spool records retain the code-owned canonical identity

### Scenario: A current spooled draft round-trips its canonical signature

- [x] RED skip: test and implementation were committed together in the historical feature pass
- [x] GREEN f59c2a3af
- [x] REFACTOR skip: optional-field parser remained local to the spool

### Scenario: A malformed canonical signature spool field rejects the spool line

- [x] RED skip: test and implementation were committed together in the historical feature pass
- [x] GREEN f59c2a3af
- [x] REFACTOR skip: shared parser retained legacy records

## Rule: Cloud filing uses a canonical identity only when it agrees with the code-owned body marker

### Scenario: A canonical field that differs from the body marker cannot select an issue

- [x] RED skip: the integrity gap was discovered in review of the combined initial feature pass
- [x] GREEN 3edf49819
- [x] REFACTOR skip: one exact-marker helper owns the rule

### Scenario: A missing canonical body marker disables canonical fallback

- [x] RED skip: the integrity gap was discovered in review of the combined initial feature pass
- [x] GREEN 3edf49819
- [x] REFACTOR skip: covered by the same pure helper

### Scenario: A legacy match remains usable when canonical fallback is disabled

- [x] RED skip: cloud MCP behavior is represented by the shipped prompt contract
- [x] GREEN f59c2a3af
- [x] REFACTOR skip: no TypeScript MCP implementation exists

## Rule: Cloud filing uses exact legacy-first canonical matching without title guesses

### Scenario: A legacy match takes precedence over a canonical match

- [x] RED skip: prompt-contract regression was committed with its implementation
- [x] GREEN f59c2a3af
- [x] REFACTOR skip: table-driven contract test needed no distinct refactor commit

### Scenario: A canonical recurrence is acknowledged on its existing issue

- [x] RED skip: prompt-contract regression was committed with its implementation
- [x] GREEN f59c2a3af
- [x] REFACTOR skip: table-driven contract test needed no distinct refactor commit

### Scenario: A same-title issue without an exact marker is not acknowledged

- [x] RED skip: prompt-contract regression was committed with its implementation
- [x] GREEN f59c2a3af
- [x] REFACTOR skip: table-driven contract test needed no distinct refactor commit

### Scenario: A pull request marker is not acknowledged as an issue

- [x] RED skip: prompt-contract regression was committed with its implementation
- [x] GREEN f59c2a3af
- [x] REFACTOR skip: table-driven contract test needed no distinct refactor commit

### Scenario: A closed issue marker is not acknowledged

- [x] RED skip: prompt-contract regression was committed with its implementation
- [x] GREEN f59c2a3af
- [x] REFACTOR skip: table-driven contract test needed no distinct refactor commit

### Scenario: The shipped Claude/Cursor filer agent and Codex plugin filer skill direct the current spool contract

- [x] RED skip: the failing test was exercised locally before the combined implementation commit
- [x] GREEN 7e31bd70d
- [ ] REFACTOR

## Rule: Older spool records remain fileable through legacy signature matching

### Scenario: A legacy spooled draft is acknowledged by its legacy signature

- [x] RED skip: retained behavior was exercised in the combined initial feature pass
- [x] GREEN f59c2a3af
- [x] REFACTOR skip: no change needed

### Scenario: An unmatched legacy draft is filed as new

- [x] RED skip: prompt-contract regression was committed with its implementation
- [x] GREEN f59c2a3af
- [x] REFACTOR skip: table-driven contract test needed no distinct refactor commit

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: canonical eligibility remains one pure helper and template checks remain table-driven
