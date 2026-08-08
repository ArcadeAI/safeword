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

### Scenario: Slow runtime-profile collection cannot consume the handoff budget

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

### Scenario: Invalid public intake cannot create a quarantine record

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Existing bearer-authorized filing remains available after public ingress is added

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: SWM2.R3 — Expire public personal data while retaining dedupe identity

### Scenario: Public payload and runtime profile expire after 30 days

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A tombstone-only public namespace still dedupes its original request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Public payload is retained before its 30-day lifetime ends

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
