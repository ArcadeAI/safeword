# Test Definitions: Route local retros through the durable server

Feature source: `packages/cli/features/route-local-retros-through-server.feature`

This file is the RED / GREEN / REFACTOR ledger for automated scenarios. Production-evidence scenarios track their real artifact instead.

## Rule: local-retro-cutover.NTB1.R1 — Local submission requires no customer setup

### Scenario: A fresh local installation submits through its installed harness

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Missing project identity prevents public submission

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.NTB1.R2 — Retrospective transport is silent and bounded

### Scenario: Every transport outcome stays within the shared stop budget

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

### Scenario: A legacy quarantine receipt does not transfer recovery

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Legacy collector rows are never leased to the worker

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A typed intake rejection preserves local diagnosis

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A transport failure before acceptance preserves local recovery

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Reusing one request identity with different bytes returns a typed conflict and preserves the accepted bytes

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.TBU1.R3 — Raw GitHub bodies are duplicate authority

### Scenario: Exact authority markers found by an all-state raw-body scan suppress a duplicate create

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Non-authoritative evidence cannot suppress filing

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A relay-owned marker on a closed issue suppresses a duplicate create

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.TBU1.R4 — Accepted intake is safe and relay-compatible

### Scenario: The largest normalized batch within the 60 KB rendered-body limit is accepted

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: The largest accepted batch remains within the 256 KiB envelope limit and preserves every finding

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Collector-envelope and relay filing-payload digests cannot substitute for one another

- [x] RED skip: implementation predates scenario; removing the envelope-digest comparison made this test receive 201 instead of 409
- [x] GREEN 71ad212b9
- [x] REFACTOR skip: the existing production guard is already minimal and the focused boundary test adds no reusable abstraction

### Scenario: An oversized envelope is rejected before storage

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: A malformed request identity is rejected before storage

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Prohibited finding content is rejected before storage

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Public intake holds no GitHub filing authority

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: The collector-worker principal has only ingest authority and leaves existing principal roles unchanged

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.TBU1.R5 — Server ownership survives interrupted filing

### Scenario: A claim crash is reclaimed and filed once

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Ambiguous creation follows raw-body ground truth

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Incomplete ambiguity scan retains the request for reconciliation

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Relay acceptance anchors one retry deadline that remains stable

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Existing direct relay clients retain their caller-supplied retry deadline

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Retry deadline exhaustion produces a durable alert

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

### Scenario: A real Claude Code session proves terminal production filing

- [x] CAPTURED
- [ ] VERIFIED — terminal filing is verified; session-scope correlation remains to be recorded
- [ ] LINKED IN READINESS MANIFEST

### Scenario: A real Codex session proves terminal production filing

- [x] CAPTURED
- [x] VERIFIED
- [ ] LINKED IN READINESS MANIFEST

### Scenario: A real Cursor session proves terminal production filing

- [ ] CAPTURED — recapture through a host-bound Cursor Desktop lifecycle and record its session scope
- [ ] VERIFIED
- [ ] LINKED IN READINESS MANIFEST

## Rule: local-retro-cutover.SWM1.R2 — Readiness proves truthful runtime provenance

### Scenario: Canary selection preserves an indeterminate runtime classification and refuses the server route

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Scenario: Cursor local readiness requires positive host-bound Desktop lifecycle evidence

- [x] RED b74302007
- [x] GREEN 03aca01b4
- [x] REFACTOR cb98cb7d3

### Scenario: Enabling one harness canary leaves every other harness on its existing route

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: local-retro-cutover.SWM1.R3 — Production fault evidence proves recoverable ownership

### Scenario: Server-owned work survives a filing fault

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

### Scenario: Stale production verification cannot enable global cutover

- [x] RED dbcba1337
- [x] GREEN 03aca01b4
- [x] REFACTOR cb98cb7d3

### Scenario: A released cutover does not expire against the customer's wall clock

- [x] RED — advancing the runtime clock beyond 30 days disabled the server route
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable production authority keeps global cutover disabled

- [x] RED
- [x] GREEN
- [x] REFACTOR 03aca01b4

### Scenario: Managed Cursor evidence cannot satisfy local readiness

- [x] RED b74302007
- [x] GREEN 03aca01b4
- [x] REFACTOR cb98cb7d3

### Scenario: Checked-in harness evidence cannot authorize cutover without protected production agreement

- [x] RED c4ed22394
- [x] GREEN 3fc71c7ea
- [x] REFACTOR skip: one exact comparison covers build, artifact, and lifecycle authority

### Scenario: Missing harness evidence keeps the global cutover disabled

- [x] RED 538ddb0b0
- [x] GREEN cb98cb7d3
- [x] REFACTOR skip: exact-key validation shares the existing completeness helper

### Scenario: Socket presence without a real harness session cannot satisfy readiness

- [x] RED 5f2388f38
- [x] GREEN 5b43f4142
- [x] REFACTOR skip: the lifecycle correlation predicate is already shared by all harnesses

### Scenario: Indeterminate Cursor provenance cannot satisfy local readiness

- [x] RED b74302007
- [x] GREEN 03aca01b4
- [x] REFACTOR cb98cb7d3

### Scenario: Mismatched build ancestry cannot satisfy readiness

- [x] RED dbcba1337
- [x] GREEN 03aca01b4
- [x] REFACTOR cb98cb7d3

### Scenario: Release verification consults real Git ancestry instead of trusting manifest pairs

- [x] RED — a rejecting Git ancestry collaborator was ignored and verification returned true
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every harness rejects collector and relay receipts whose request identity or session scope does not correlate end to end

- [x] RED 5f2388f38
- [x] GREEN 5b43f4142
- [x] REFACTOR skip: one verifier path correlates the same identity and session fields for all three harnesses

### Scenario: Readiness retrieves a closed canary by exact issue GET and validates its raw body

- [x] RED 5f2388f38
- [x] GREEN 5b43f4142
- [x] REFACTOR skip: exact raw marker validation is one focused helper

### Scenario: A fault artifact without recovery evidence cannot enable cutover

- [x] RED 538ddb0b0
- [x] GREEN cb98cb7d3
- [x] REFACTOR skip: fault completeness is a single exact-key-and-hash predicate

### Scenario: Checked-in fault digests cannot authorize cutover without protected production agreement

- [x] RED 980a1a677
- [x] GREEN 30fc8f3d8
- [x] REFACTOR skip: exact comparison against the protected value is already minimal

## Feature-level cross-scenario refactor

- [ ] cross-scenario
