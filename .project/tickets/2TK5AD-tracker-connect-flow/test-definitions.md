# Test Definitions: Tracker connect/onboarding flow (2TK5AD)

Feature source: `features/tracker-connect-flow.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.

## Rule: setup offers connect, opt-in and default no

### Scenario: Declining the setup offer leaves the project inert

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Accepting the setup offer runs the same connect flow

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: connect writes non-secret config and prints the per-provider handoff

### Scenario: Connecting github writes config and prints the App/PAT handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Connecting linear writes config and prints the Arcade OAuth handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Re-connecting a different provider leaves no stale provider

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: secrets live outside the repo

### Scenario: The credential is stored in the keychain, never in config

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: verify before declaring the connection live

### Scenario: Verification passes and the connection is reported live

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Verification fails and names the missing piece

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: a successful connect seeds the empty sidecar

### Scenario: A verified connect seeds an empty tracker-map sidecar

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed verification does not seed the sidecar

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: connect offers the pollution opt-ins

### Scenario: Accepting the pollution opt-ins writes both files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Declining the pollution opt-ins writes neither file

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: an unsupported provider is rejected cleanly

### Scenario: Connecting an unsupported provider performs no partial wiring

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
