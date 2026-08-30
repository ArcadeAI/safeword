# Test Definitions: Route local retros through the durable server

Feature source: `packages/cli/features/route-local-retros-through-server.feature`

This file is the RED / GREEN / REFACTOR ledger for automated scenarios. Production-evidence scenarios track their real artifact instead.

## Rule: local-retro-cutover.NTB1.R1 — Local submission requires no customer setup

### Scenario: A fresh local installation submits through its installed harness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing project identity prevents public submission

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.NTB1.R2 — Retrospective transport is silent and bounded

### Scenario: Every transport outcome stays within the shared stop budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An exhausted stop budget prevents another transport attempt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Multiple pending requests share one stop budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.NTB1.R3 — Collection remains disclosed and optional

### Scenario: Default installation documents the sanitized feedback path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A project opt-out prevents collection

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.TBU1.R1 — One captured window keeps one request identity

### Scenario: A lost receipt retries the persisted request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Re-extracting the same transcript window reuses its durable identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A later transcript window is not suppressed by an earlier request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Conflicting retry bytes preserve both recovery records

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.TBU1.R2 — Durable acceptance transfers recovery exactly once

### Scenario: Collector acceptance transfers recovery to the server

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A legacy quarantine receipt does not transfer recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A typed intake rejection preserves local diagnosis

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A transport failure before acceptance preserves local recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.TBU1.R3 — Raw GitHub bodies are duplicate authority

### Scenario: Exact authority markers suppress a duplicate create

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-authoritative evidence cannot suppress filing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.TBU1.R4 — Accepted intake is safe and relay-compatible

### Scenario: The largest normalized batch is accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The largest accepted batch remains relay-compatible

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An oversized envelope is rejected before storage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed request identity is rejected before storage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Prohibited finding content is rejected before storage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Public intake holds no GitHub filing authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.TBU1.R5 — Server ownership survives interrupted filing

### Scenario: A claim crash is reclaimed and filed once

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ambiguous creation follows raw-body ground truth

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Incomplete ambiguity scan retains the request for reconciliation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.TBU1.R6 — Routine operations do not expose findings

### Scenario: Lifecycle inspection returns metadata without payload

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An ordinary operator credential cannot read raw payloads

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unauthenticated caller cannot inspect accepted work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Break-glass payload access is audited

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Authorized worker payload access is separately authenticated and audited

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.TBU1.R7 — Cutover preserves old work and routes new work only through the server

### Scenario: Cutover preserves a draft captured under the old route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cutover routes a newly captured finding only through the server

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.SWM1.R1 — Real harness canaries precede global cutover

### Scenario: A real harness canary proves terminal production filing

- [ ] CAPTURED
- [ ] VERIFIED
- [ ] LINKED IN READINESS MANIFEST

## Rule: local-retro-cutover.SWM1.R2 — Readiness proves truthful runtime provenance

### Scenario: Cursor host detection records truthful provenance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.SWM1.R3 — Production fault evidence proves recoverable ownership

### Scenario: Server-owned work survives a filing fault

- [ ] CAPTURED
- [ ] VERIFIED
- [ ] LINKED IN READINESS MANIFEST

## Rule: local-retro-cutover.SWM1.R4 — Intake and filing bounds contain anonymous volume

### Scenario: Admitted work drains oldest-first within filing quotas

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Configured filing quota controls admitted filing volume

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Exhausted public intake rejects before storage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Prolonged filing quota exhaustion reaches an alerted terminal state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: local-retro-cutover.SWM1.R5 — Readiness rejects incomplete or untruthful evidence

### Scenario: Complete truthful evidence enables global cutover

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Managed Cursor evidence cannot satisfy local readiness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing harness evidence keeps the global cutover disabled

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Indeterminate Cursor provenance cannot satisfy local readiness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Mismatched build ancestry cannot satisfy readiness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A fault artifact without recovery evidence cannot enable cutover

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
