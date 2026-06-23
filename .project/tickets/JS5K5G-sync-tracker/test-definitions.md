# Test Definitions: safeword sync-tracker — one-way projection (v1)

Feature source: `features/sync-tracker.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.

Build steps (bottom-up): payload `f4c50ee` · tracker-map `827655a` · secrets +
backoff `fafa40d` · writers `1e86033` · orchestrator `6412112`. Scenarios that
assert orchestrator-level behavior close at `6412112`.

## Rule: With no tracker configured, sync is a friendly no-op

### Scenario: provider none prints guidance and exits zero

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

### Scenario: an unsupported tracker is treated as none

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

## Rule: A configured provider without a credential fails loudly

### Scenario: provider set but no credential resolves

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

## Rule: Each ticket maps to a flat IssuePayload

### Scenario: an active ticket maps to an open payload with epic and type labels

- [x] RED f4c50ee
- [x] GREEN f4c50ee
- [x] REFACTOR f4c50ee

### Scenario: a terminal ticket maps to a closed payload

- [x] RED f4c50ee
- [x] GREEN f4c50ee
- [x] REFACTOR f4c50ee

### Scenario: a ticket with no epic yields only the type label

- [x] RED f4c50ee
- [x] GREEN f4c50ee
- [x] REFACTOR f4c50ee

## Rule: One call site routes to the provider's writer

### Scenario: the linear provider routes to the Linear writer

- [x] RED 1e86033
- [x] GREEN 1e86033
- [x] REFACTOR 1e86033

### Scenario: the github provider routes to the GitHub writer

- [x] RED 1e86033
- [x] GREEN 1e86033
- [x] REFACTOR 1e86033

## Rule: First sync creates issues and records refs

### Scenario: a ticket absent from a present sidecar is created and recorded

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

## Rule: Re-run is idempotent — update, never duplicate

### Scenario: a ticket already in the sidecar is updated, not recreated

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

## Rule: safeword writes only the fields it owns

### Scenario: re-sync of an active ticket touches title and labels only

- [x] RED 1e86033
- [x] GREEN 1e86033
- [x] REFACTOR 1e86033

### Scenario: a newly-terminal ticket closes its issue

- [x] RED 1e86033
- [x] GREEN 1e86033
- [x] REFACTOR 1e86033

## Rule: A crashed mid-corpus run resumes without double-creating

### Scenario: a ticket created with a pending ref is reconciled, not recreated

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

## Rule: A missing or corrupt sidecar never blind-recreates

### Scenario: a corrupt sidecar stops the run pending an explicit reset

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

### Scenario: a missing sidecar on a configured project stops pending an explicit reset

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

## Rule: Body egress defaults to minimal

### Scenario: the default body omits the spec and work log

- [x] RED f4c50ee
- [x] GREEN f4c50ee
- [x] REFACTOR f4c50ee

### Scenario: body full to a public github repo emits an egress warning

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

## Rule: Secrets stay out of the repo and the logs

### Scenario: a token is read from the environment, never from committed config

- [x] RED fafa40d
- [x] GREEN fafa40d
- [x] REFACTOR fafa40d

### Scenario: the resolved token never appears in output or logs

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

## Rule: Non-interactive Arcade auth warns about silent failure

### Scenario: a CI run on an Arcade user identity is warned

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112

## Rule: Corpus writes are rate-limited with backoff

### Scenario: a rate-limited write is retried with backoff and succeeds

- [x] RED 6412112
- [x] GREEN 6412112
- [x] REFACTOR 6412112
