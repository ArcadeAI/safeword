# Test Definitions: Retro recall — delta re-arm + sonnet + async hook + signature dedupe

Feature source: `packages/cli/features/retro-recall-delta-rearm.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Delta windows tile the whole session

### Scenario: The first fire digests from the start of the transcript

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A later fire digests only the window since the previous fire's offset

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A back-half-only finding reaches the egress pipeline

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The overlap re-includes the boundary so a straddling finding appears whole

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Extraction defaults to sonnet at both model sites

### Scenario: The runner builds the extractor with sonnet by default

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The headless extraction default is sonnet when no model is passed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A configured model overrides the sonnet default

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Re-fires dedupe by content signature, not the model-generated title

### Scenario: A repeat signature under a different title opens no second issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A genuinely new signature opens a new issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The issue body embeds the searchable signature marker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A stable session id reaches the extraction child

### Scenario: The resolved session id is forwarded to the child

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Offset state survives concurrent Stops

### Scenario: Offset state is written atomically via temp-file then rename

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The recorded offset only advances across fires

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The retro Stop hook is non-blocking

### Scenario: The generated Claude Stop settings register the retro hook async

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The retro Stop hook is not registered asyncRewake

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Re-fire cadence is bounded and fail-open

### Scenario: Growth below the re-arm threshold holds the fire

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Growth at the re-arm threshold re-fires

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The backstop caps total fires per session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A retro child never re-fires

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A state-write failure still fires

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Every delta window passes the full egress pipeline unchanged

### Scenario: A secret in a back-half finding is redacted before filing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A delta-window finding with an unresolved surface is dropped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
