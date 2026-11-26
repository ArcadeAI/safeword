# Current-proof prerequisite implementation ledger

Feature source: `features/verify-existing-ep9-behavior-for-maintainers.feature`

New prospective implementation only. Draft scenarios are not RED, current
verification or qualification evidence. Original EP9 and T0FK4H rows stay intact.

## Rule: verify-existing-ep9-behavior-for-maintainers.SWM1.R1 — Only the fixed EP9 delivery is eligible

### Scenario: Complete EP9 proof receives current verification credit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Another ticket cannot borrow EP9 proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Partial proof cannot receive current credit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: verify-existing-ep9-behavior-for-maintainers.SWM1.R2 — Authority is independent and revocable

### Scenario: A fresh review cannot authenticate invented execution

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Only accepted execution can acquire trusted provenance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Both examples are required: genuine accepted execution issues provenance and an
arbitrary upload is denied. A signer that always refuses cannot earn GREEN.

### Scenario: Candidate execution cannot reach signing authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Live gate: actual GitHub runner credential access and inter-job artifact-replacement
controls are required. Local Docker or mocked attestations do not earn GREEN.
Record that each token-access and artifact-replacement attempt actually executed
and failed; a test which never attempted access cannot satisfy this gate.

### Scenario: Live closing feasibility is established before adoption

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Live gate: measure real query-to-close freshness and installed verifier latency;
do not infer these from mocked clocks or synthetic receipts. CI execution remains
unauthorized until separately approved.
Failed measurement blocks adoption; do not earn GREEN by relaxing the accepted
five-minute window or host deadline.

### Scenario: Invalid independent review cannot authorize current credit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A locally forged validation record cannot replace external proof

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A newer unfinished or failed execution blocks an older pass

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A stale completion checkpoint cannot authorize closing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Changed bound proof revokes current credit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing trusted support never grants completion

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: verify-existing-ep9-behavior-for-maintainers.SWM1.R3 — Historical claims remain unchanged

### Scenario: Explicit EP9 completion preserves its actual history

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Live gate: actual installed Claude Code, Codex and Cursor walkthroughs are each
required for GREEN. One host or synthetic adapter fixtures cannot substitute.

### Scenario: Current credit does not bypass ordinary prerequisites

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Observation and certification do not automatically close work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Excluded coding-agent hosts remain excluded

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Feature-level cross-scenario refactor

- [ ] cross-scenario
