# Test Definitions: Hand off cloud retros without interrupting builders

Feature source: `features/preserve-cloud-retros-through-service-outages.feature`

test-definitions.md is the R/G/R ledger.

## Rule: TBU1.R1 — Durable, silent cloud handoff

### Scenario: A supported carrier receives one durable receipt without adding task narration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A client disconnect after durable acceptance preserves the same receipt on retry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A mutated retry cannot replace an accepted quarantine record

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: TBU1.R2 — Preserve accepted public work through relay restart

### Scenario: An accepted public retro survives a relay restart without a tracker write

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A public intake persistence failure creates neither receipt nor tracker filing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: TBU2.R1 — Keep failed cloud handoff quiet

### Scenario: An unavailable intake leaves a cloud task quiet and unacknowledged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A reachable but slow intake times out quietly before durable acceptance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Slow runtime-profile collection cannot consume the handoff budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed runtime-profile source is omitted without delaying handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: NTB1.R1 — Do not narrate transport status

### Scenario: Handoff transport outcome does not change the builder-facing result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: SWM1.R1 — Count only proven carriers

### Scenario: A real carrier with a durable-receipt proof is recorded as a candidate route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An endpoint without a real cloud carrier cannot count toward activation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: SWM2.R1 — Create local project identity and provenance

### Scenario: Installation creates a public project ID without contacting the relay

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reinstalling Safe Word preserves the existing public project ID

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A project without a normalized remote skips public handoff quietly

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A copied project ID remains a distinct source after a repository fork

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Handoff records available actor and runtime provenance without an identity lookup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: SWM2.R2 — Preserve privileged boundaries

### Scenario: A public project ID cannot use a privileged relay capability

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An authenticated operator can inspect an accepted public retro

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A Git email remains encrypted metadata and never reaches public output

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Handoff excludes host-local and credential data from its outbound payload

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalid public intake cannot create a quarantine record

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A configured public rate limit rejects a fresh quarantine key

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A retained quarantine key still dedupes after its rate limit is reached

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Existing bearer-authorized filing remains available after public ingress is added

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: SWM2.R3 — Retain bounded public operator data

### Scenario: A full public queue rejects a new identity without replacing stored data

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An operator is alerted before the public queue reaches capacity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The last available public queue slot accepts one new identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A retained public quarantine key still dedupes its original request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Concurrent duplicate public handoffs produce one record and receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Concurrent new keys cannot exceed the last available queue slot

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
