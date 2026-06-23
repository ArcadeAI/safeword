# Test Definitions: safeword sync-tracker — one-way projection (v1)

Feature source: `features/sync-tracker.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.

## Rule: With no tracker configured, sync is a friendly no-op

### Scenario: provider none prints guidance and exits zero

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: an unsupported tracker is treated as none

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A configured provider without a credential fails loudly

### Scenario: provider set but no credential resolves

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Each ticket maps to a flat IssuePayload

### Scenario: an active ticket maps to an open payload with epic and type labels

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: a terminal ticket maps to a closed payload

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: a ticket with no epic yields only the type label

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: One call site routes to the provider's writer

### Scenario: the linear provider routes to the Linear writer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: the github provider routes to the GitHub writer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: First sync creates issues and records refs

### Scenario: a ticket absent from a present sidecar is created and recorded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Re-run is idempotent — update, never duplicate

### Scenario: a ticket already in the sidecar is updated, not recreated

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: safeword writes only the fields it owns

### Scenario: re-sync of an active ticket touches title and labels only

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: a newly-terminal ticket closes its issue

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A crashed mid-corpus run resumes without double-creating

### Scenario: a ticket created with a pending ref is reconciled, not recreated

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A missing or corrupt sidecar never blind-recreates

### Scenario: a corrupt sidecar stops the run pending an explicit reset

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: a missing sidecar on a configured project stops pending an explicit reset

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Body egress defaults to minimal

### Scenario: the default body omits the spec and work log

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: body full to a public github repo emits an egress warning

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Secrets stay out of the repo and the logs

### Scenario: a token is read from the environment, never from committed config

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: the resolved token never appears in output or logs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Non-interactive Arcade auth warns about silent failure

### Scenario: a CI run on an Arcade user identity is warned

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Corpus writes are rate-limited with backoff

### Scenario: a rate-limited write is retried with backoff and succeeds

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
