# Test Definitions: Keep cloud-spooled retro filing from bypassing duplicate checks

Feature source: `packages/cli/features/canonical-retro-spool-dedupe.feature`

## Rule: New cloud spool records retain the code-owned canonical identity

### Scenario: A current spooled draft round-trips its canonical signature

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed canonical signature spool field rejects the spool line

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Cloud filing uses a canonical identity only when it agrees with the code-owned body marker

### Scenario: A canonical field that differs from the body marker cannot select an issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A missing canonical body marker disables canonical fallback

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A legacy match remains usable when canonical fallback is disabled

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Cloud filing uses exact legacy-first canonical matching without title guesses

### Scenario: A legacy match takes precedence over a canonical match

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A canonical recurrence is acknowledged on its existing issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A same-title issue without an exact marker is not acknowledged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A pull request marker is not acknowledged as an issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A closed issue marker is not acknowledged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Both shipped filer definitions direct the current spool contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Older spool records remain fileable through legacy signature matching

### Scenario: A legacy spooled draft is acknowledged by its legacy signature

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unmatched legacy draft is filed as new

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
