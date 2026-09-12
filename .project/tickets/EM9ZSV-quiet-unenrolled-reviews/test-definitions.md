# Test Definitions: Point-of-need Safeword enrollment

Feature source: `packages/cli/features/quiet-unenrolled-reviews.feature`

test-definitions.md is the R/G/R ledger.

## Rule: quiet-unenrolled-reviews.NTB1.R1 — State dependency triggers one enrollment choice

### Scenario Outline: Every supported surface asks before project state is accessed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Every state-access mechanism asks before project state is accessed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every catalogued state-access route declares the shared enrollment boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unguarded catalogued route fails enrollment parity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An uncatalogued project-state route fails enrollment parity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The enrollment choice explains the benefit without internal jargon

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Loading an agent surface stays quiet until project state is needed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A stateless Safeword operation does not prompt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Explicit installation does not prompt recursively

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Enrollment inspection remains read-only

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Removal from an unenrolled repository does not ask to enroll

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Diagnostic and planning commands do not prompt or mutate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Non-marker Safeword paths do not count as enrollment

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: quiet-unenrolled-reviews.NTB1.R2 — Enrollment requires explicit consent

### Scenario: Accepting setup enters the bounded canonical install plan

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Approving the bounded plan applies only its disclosed effects

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed approved installation remains confined to disclosed effects

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Declining setup authorizes no repository change

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unanswered enrollment choice authorizes no repository change

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Agent-originated acceptance does not substitute for builder consent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Enrollment excludes unrelated integrations and dependencies

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Profile-delivered OpenCode enrollment installs only project substrate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Enrollment preserves customer-owned paths that resemble Safeword state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Enrollment honors a configured custom namespace root

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: quiet-unenrolled-reviews.NTB1.R3 — The initiating workflow resolves after the choice

### Scenario: Accepted enrollment runs the canonical installer and resumes a real workflow

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Declining required state stops automatic BDD before artifacts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Declining optional proof preserves a no-ticket review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One decline covers later state needs in the same operation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A later independent operation may offer enrollment again

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A decline at an optional need also covers a later required need

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: quiet-unenrolled-reviews.NTB1.R4 — Resume follows the proven installation outcome

### Scenario: Sufficient concurrent enrollment prevents duplicate installation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Insufficient concurrent enrollment reports recovery without resuming

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A partial install that satisfies required setup permits resume

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unmet setup requirement prevents resume

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A second resume trigger does not replay a completed operation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cancelling installation prevents resume

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed resume handoff does not replay the initiating operation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: quiet-unenrolled-reviews.NTB1.R5 — Existing Safeword workflows do not change

### Scenario Outline: Enrolled workflows across supported surfaces do not ask again

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Supported namespaces resolve existing state without asking again

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Enrollment does not weaken an existing invocation-proof gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing authored knowledge is not repaired as enrollment

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing managed setup in an enrolled repository does not restart enrollment

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
