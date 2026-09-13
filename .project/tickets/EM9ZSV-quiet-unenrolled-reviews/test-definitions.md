# Test Definitions: Point-of-need Safeword project context

Feature source: `packages/cli/features/quiet-unenrolled-reviews.feature`

test-definitions.md is the R/G/R ledger.

## Rule: quiet-unenrolled-reviews.NTB1.R1 — State dependency resolves the nearest usable project context

### Scenario Outline: Every supported surface asks before project state is accessed

- [x] RED 6137bffd9
- [x] GREEN 62036f7f4
- [x] REFACTOR skip: resolver responsibilities are already separated and no further structural change improves this slice

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

### Scenario: Enrolled context inside the same repository is reused automatically

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An enrolled containing project is offered before current-repository setup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Existing checkout-specific global state wins over a containing project

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An enrolled current repository wins over an enrolled ancestor

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: quiet-unenrolled-reviews.NTB1.R2 — Repository enrollment requires explicit consent

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

### Scenario: An interrupted enrollment choice authorizes no repository change

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An abandoned interactive choice authorizes no repository change

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cancelling setup authorization applies no repository plan

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

## Rule: quiet-unenrolled-reviews.NTB1.R3 — Global storage is the automatic fallback

### Scenario: Declining local setup continues automatic BDD in global storage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Declining local setup records no-ticket review proof globally

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: One decline covers later state needs in the same operation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A later independent operation reuses global state without asking again

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Silence continues the initiating workflow globally

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Prompt interruption continues the initiating workflow globally

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An abandoned interactive choice continues globally

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Optional project state uses the same automatic global fallback

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Selecting global storage under a containing project preserves both repositories

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unrelated checkouts cannot observe each other's global project data

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Linked worktrees share global project knowledge

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Linked worktrees isolate mutable execution state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A non-Git directory reuses its canonical-path global partition

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Global storage is private to the current user

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unavailable global storage never falls back to repository writes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: quiet-unenrolled-reviews.NTB1.R4 — The initiating workflow resumes once from the selected context

### Scenario: Accepted enrollment runs the canonical installer and resumes a real workflow

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Choosing an enrolled containing project resumes from it

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Sufficient concurrent enrollment prevents duplicate installation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Insufficient concurrent enrollment falls back without duplicate installation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A partial install that satisfies required setup permits resume

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unmet local setup requirement resumes globally

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A second resume trigger does not replay a completed operation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cancelling installation resumes globally

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

## Rule: quiet-unenrolled-reviews.NTB1.R6 — Local installation shadows a durable global fallback

### Scenario: A later install plan includes existing global project data

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Successful installation verifies the local overlay without retiring global data

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Hydration conflicts are surfaced without silent overwrite

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Compatible local and global data hydrates without conflict or rewrite

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cancelling hydration preserves global authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Failed hydration preserves global data and authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installing without global data keeps the ordinary plan

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A missing local overlay falls back to preserved global data

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Local changes do not update the preserved global snapshot

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unreadable global data blocks local overlay activation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Enrollment honors a configured custom namespace root

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
