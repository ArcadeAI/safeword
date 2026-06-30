# Test Definitions: Retro recall — delta re-arm + sonnet + async hook + signature dedupe

Feature source: `packages/cli/features/retro-recall-delta-rearm.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Delta windows tile the whole session

### Scenario: The first fire digests the whole transcript so far under the digest cap

- [x] RED skip: pure windowFor slicer asserted directly; RED for applied behavior proven by the back-half run (delta filed 0 pre-impl); lint no-unused-properties blocked a type-only scaffold commit
- [x] GREEN e50230d
- [x] REFACTOR skip: windowFor is a one-line clamp+slice

### Scenario: A later fire digests only the window since the previous fire's offset

- [x] RED skip: covered by windowFor later-fire unit + decision windowStart (60863c6); RED verified by run
- [x] GREEN e50230d
- [x] REFACTOR skip: no structural improvement

### Scenario: A back-half-only finding beyond the head cap is filed by the delta fire

- [x] RED skip: end-to-end run filed 0 before windowFor applied (verified); lint blocked a type-only scaffold RED commit
- [x] GREEN e50230d
- [x] REFACTOR skip: composes existing runRetro pipeline

### Scenario: The window re-includes the overlap region before the previous offset

- [x] RED skip: windowFor overlap-clamp unit asserted directly; RED verified by run
- [x] GREEN e50230d
- [x] REFACTOR skip: one-line clamp

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

### Scenario: A fuzzy signature-search near-miss is rejected by the exact filter

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A stable session id reaches the extraction child

### Scenario: The resolved session id is forwarded to the child

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No session id resolves, so nothing is filed under the unknown fallback

- [x] RED d05e17a
- [x] GREEN 60863c6
- [x] REFACTOR skip: clean fail-open branch, no structural improvement

## Rule: Offset state survives concurrent Stops

### Scenario: Offset state is written atomically via temp-file then rename

- [x] RED d05e17a
- [x] GREEN 60863c6
- [x] REFACTOR skip: helper is minimal (temp-write + rename)

### Scenario: A later sequential fire strictly advances the recorded offset

- [x] RED d05e17a
- [x] GREEN 60863c6
- [x] REFACTOR skip: covered by the cadence decision, no cleanup

### Scenario: A concurrent reader never sees a torn state file

- [x] RED d05e17a
- [x] GREEN 60863c6
- [x] REFACTOR skip: graceful-parse branch is minimal

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

### Scenario: A first Stop below the substance threshold does not fire

- [x] RED d05e17a
- [x] GREEN 60863c6
- [x] REFACTOR skip: single guard branch, no cleanup

### Scenario: Growth below the re-arm threshold holds the fire

- [x] RED d05e17a
- [x] GREEN 60863c6
- [x] REFACTOR skip: covered by the cadence branch

### Scenario: Growth at the re-arm threshold re-fires

- [x] RED d05e17a
- [x] GREEN 60863c6
- [x] REFACTOR skip: covered by the cadence branch

### Scenario: The backstop caps total fires per session

- [x] RED d05e17a
- [x] GREEN 60863c6
- [x] REFACTOR skip: single backstop guard

### Scenario: A retro child never re-fires

- [x] RED d05e17a
- [x] GREEN 60863c6
- [x] REFACTOR skip: guard ordering unchanged from 7D8PJP

### Scenario: A state-write failure still fires and leaves the offset unchanged

- [x] RED d05e17a
- [x] GREEN 60863c6
- [x] REFACTOR skip: fail-open try/catch mirrors markNudged

## Rule: Every delta window passes the full egress pipeline unchanged

### Scenario: A secret in a back-half finding is redacted before filing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A delta-window finding with an unresolved surface is dropped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
