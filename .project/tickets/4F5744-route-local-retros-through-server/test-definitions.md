# Test Definitions: Route local retros through the durable server

Feature source: `packages/cli/features/route-local-retros-through-server.feature`

This file mirrors the current feature's scenario titles and records their RED / GREEN / REFACTOR state. Earlier, finer-grained cases were consolidated under the current scenario in the same Rule; their lower-level regression tests remain in the suite. Bare historical checks predate commit anchoring; current proof comes from the manifest's executable test mappings. Production-evidence scenarios track their real artifact instead.

## Rule: local-retro-cutover.NTB1.R1 — Local submission requires no customer setup

### Scenario Outline: A fresh local installation submits through its installed harness

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Missing project identity prevents public submission

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.NTB1.R2 — Retrospective transport is silent and bounded

### Scenario Outline: Every transport outcome stays within the shared stop budget

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An exhausted stop budget prevents transport

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Preparation and transport share one stop budget

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.NTB1.R3 — Collection remains disclosed and optional

### Scenario: Default installation documents the sanitized feedback path

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A project opt-out prevents collection

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.TBU1.R1 — One captured window keeps one request identity

### Scenario: A lost receipt retries the persisted request

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Re-extracting the same transcript window reuses its durable identity

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A later transcript window is not suppressed by an earlier request

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Conflicting retry bytes preserve both recovery records

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.TBU1.R2 — Durable acceptance transfers recovery exactly once

### Scenario: Collector acceptance transfers recovery to the server

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A legacy quarantine receipt preserves direct recovery

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A typed intake rejection preserves local diagnosis

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: A transport failure before acceptance preserves local recovery

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.TBU1.R3 — Raw GitHub bodies are duplicate authority

### Scenario: Exact authority markers suppress a duplicate create

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Non-authoritative evidence cannot suppress filing

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.TBU1.R4 — Accepted intake is safe and relay-compatible

### Scenario: The maximum-count relay-compatible batch is filed without truncation

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: The rendered-body boundary is accepted end to end

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An oversized envelope is rejected before storage

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A malformed request identity is rejected before storage

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Prohibited request fields are rejected before storage

- [x] RED skip: audit repair adds proof for an existing schema rejection
- [x] GREEN 3a84c300a
- [x] REFACTOR skip: the boundary test needs no reusable abstraction

### Scenario: Public intake holds no GitHub filing authority

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.TBU1.R5 — Server ownership survives interrupted filing

### Scenario: A claim crash is reclaimed and filed once

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario Outline: Ambiguous creation follows raw-body ground truth

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Incomplete ambiguity scan retains the request for reconciliation

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.TBU1.R6 — Routine operations do not expose findings

### Scenario: Lifecycle inspection returns metadata without payload

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An ordinary operator credential cannot read raw payloads

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: An unauthenticated caller cannot inspect accepted work

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Break-glass payload access is audited

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Authorized worker payload access is separately authenticated and audited

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.TBU1.R7 — Cutover preserves old work and routes new work only through the server

### Scenario: Cutover preserves a draft captured under the old route

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Cutover routes a newly captured finding only through the server

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.SWM1.R1 — Real harness canaries precede global cutover

### Scenario Outline: A real harness canary proves terminal production filing

- [ ] CAPTURED — Claude Code and Codex are captured; Cursor needs a host-bound recapture with session scope
- [ ] VERIFIED — Codex is verified; Claude Code still needs session-scope correlation and Cursor still needs recapture
- [ ] LINKED IN READINESS MANIFEST

## Rule: local-retro-cutover.SWM1.R2 — Readiness proves truthful runtime provenance

### Scenario Outline: Cursor host detection records truthful provenance

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.SWM1.R3 — Production fault evidence proves recoverable ownership

### Scenario Outline: Server-owned work survives a filing fault

- [ ] CAPTURED
- [ ] VERIFIED
- [ ] LINKED IN READINESS MANIFEST

## Rule: local-retro-cutover.SWM1.R4 — Intake and filing bounds contain anonymous volume

### Scenario: Admitted work drains oldest-first within filing quotas

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Configured filing quota controls admitted filing volume

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Exhausted public intake rejects before storage

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Prolonged filing quota exhaustion reaches an alerted terminal state

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.SWM1.R5 — Readiness rejects incomplete or untruthful evidence

### Scenario: Complete truthful evidence enables global cutover

- [x] RED b74302007
- [x] GREEN 03aca01b4
- [x] REFACTOR cb98cb7d3

### Scenario: Managed Cursor evidence cannot satisfy local readiness

- [x] RED b74302007
- [x] GREEN 03aca01b4
- [x] REFACTOR cb98cb7d3

### Scenario: Missing harness evidence keeps the global cutover disabled

- [x] RED 538ddb0b0
- [x] GREEN cb98cb7d3
- [x] REFACTOR skip: exact-key validation shares the existing completeness helper

### Scenario: Indeterminate Cursor provenance cannot satisfy local readiness

- [x] RED b74302007
- [x] GREEN 03aca01b4
- [x] REFACTOR cb98cb7d3

### Scenario: Mismatched build ancestry cannot satisfy readiness

- [x] RED dbcba1337
- [x] GREEN 03aca01b4
- [x] REFACTOR cb98cb7d3

### Scenario: A fault artifact without recovery evidence cannot enable cutover

- [x] RED 538ddb0b0
- [x] GREEN cb98cb7d3
- [x] REFACTOR skip: fault completeness is a single exact-key-and-hash predicate

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: proof migration changed no shared production structure
