# Test Definitions: Cross-agent adversarial reviews

Feature source: `packages/cli/features/cross-agent-adversarial-reviews.feature`

test-definitions.md is the R/G/R ledger. Executable Given/When/Then behavior lives in the feature source.

## Rule: cross-agent-review.TBU1.R1 — Available class-1 reviews use the opposite agent

### Scenario Outline: Each author agent selects the opposite headless reviewer

- [x] RED ddb235b15
- [x] GREEN 012896828
- [x] REFACTOR 1ab101c1c

### Scenario: A same-agent candidate cannot displace an available opposite reviewer

- [x] RED skip: route policy shipped in the preceding walking-skeleton loop; regression proof fails if the same-agent candidate is selected
- [x] GREEN cb453b649
- [x] REFACTOR skip: the shared oppositeReviewer policy already expresses the rule without duplication

### Scenario: An author outside the Claude and Codex pairing keeps its existing route

- [x] RED 32083119d
- [x] GREEN 268905524
- [x] REFACTOR skip: the existing-route branch is already the minimal explicit policy outcome

## Rule: cross-agent-review.TBU1.R2 — Review evidence names the actual agents and independence level

### Scenario: A validated opposite-agent result earns complete provenance

- [x] RED 1d281517b
- [x] GREEN 6c23a4d5f
- [x] REFACTOR skip: model assignment remains centralized beside the runtime argument contract

### Scenario Outline: Reviewer identity faults earn no review evidence

- [x] RED c8fca35b0
- [x] GREEN 6d22461d7
- [x] REFACTOR skip: the two identity classifications share one focused validation function

## Rule: cross-agent-review.TBU1.R3 — The reviewer is isolated from writes and unrelated credentials

### Scenario: A reviewer write attempt cannot alter the judged work

- [x] RED 96e21004a
- [x] GREEN de526f26d
- [x] REFACTOR e16184777

### Scenario: An unrelated author-vendor credential never enters the reviewer boundary

- [x] RED 6d3720066
- [x] GREEN fa48814c7
- [x] REFACTOR skip: vendor environment filtering is isolated in one table-driven helper

## Rule: cross-agent-review.TBU2.R1 — Preferred-route failures are classified before fallback

### Scenario Outline: Each preferred-route failure keeps its specific cause

- [x] RED 2c3e217d2
- [x] GREEN db85fc1ee
- [x] REFACTOR skip: ReviewRuntimeError centralizes the typed failure matrix without route-specific branches

## Rule: cross-agent-review.TBU2.R2 — Fallback evidence never overstates independence

### Scenario: A permitted host-native fallback is recorded as degraded

- [x] RED 7c916682a
- [x] GREEN 695114d4a
- [x] REFACTOR 7ae53833f

### Scenario: A degraded fallback cannot satisfy hard cross-agent enforcement

- [x] RED f70dc8a4f
- [x] GREEN a409b5a68
- [x] REFACTOR skip: policy parsing and the hard-enforcement branch are isolated in focused helpers

## Rule: cross-agent-review.TBU2.R3 — Exhausting safe routes blocks with recovery guidance

### Scenario: No safe review route blocks without hanging or minting evidence

- [x] RED dccb0c6a1
- [x] GREEN c1d391969
- [x] REFACTOR skip: one shared recovery helper covers exhausted and enforced routes without duplicate diagnosis logic

## Rule: cross-agent-review.NTB1.R1 — The outcome plainly states whether an independent agent checked the work

### Scenario Outline: Every outcome leads with its independence status

- [x] RED fcf9332b7
- [x] GREEN 68d473edc
- [x] REFACTOR skip: one review-specific renderer helper derives all three leading statements from typed result data

### Scenario: An opaque technical status is not accepted as the builder-facing result

- [x] RED skip: the preceding human-output outline introduced the same first-line contract while JSON tests retained technical detail
- [x] GREEN 68d473edc
- [x] REFACTOR skip: plain-language presentation and supporting wire data remain separated by the shared renderer

## Rule: cross-agent-review.NTB1.R2 — A degraded or blocked outcome leads with one recommended recovery action

### Scenario Outline: The builder receives one actionable recovery step for each failure

- [x] RED skip: the exhausted-routes walking skeleton already required one recovery entry before the five-cause matrix was expanded
- [x] GREEN 0e5225ac7
- [x] REFACTOR skip: one table-driven recoveryDescription helper maps every classified cause to a single action

## Rule: cross-agent-review.SWM1.R1 — Every class-1 surface uses one coordinator contract

### Scenario Outline: Each class-1 surface enters the shared coordinator

- [x] RED 8e2db69d9
- [x] GREEN 791b5f3cd
- [x] REFACTOR skip: each canonical class-1 instruction names the same public command and kind

### Scenario: A class-1 surface that bypasses the coordinator fails parity validation

- [x] RED 8e2db69d9
- [x] GREEN 791b5f3cd
- [x] REFACTOR skip: the parity table reports the exact canonical template that omits the coordinator

## Rule: cross-agent-review.SWM1.R2 — Opposite-agent behavior is consistent across desktop and cloud

### Scenario Outline: Existing desktop or cloud authentication can run the opposite reviewer

- [x] RED skip: symmetric public-command and credential-boundary walking-skeleton tests already covered the four environment rows before the managed-credential matrix was completed
- [x] GREEN 65626eb94
- [x] REFACTOR skip: desktop profiles and managed cloud credentials share the same vendor-scoped child environment

### Scenario: A cloud session never invents or exposes a missing reviewer credential

- [x] RED skip: the preferred-route authentication matrix already failed closed as not_authenticated without reading a secret value
- [x] GREEN 0e5225ac7
- [x] REFACTOR skip: the sign-in recovery action names no package, environment variable, credential format, or secret

### Scenario: An explicit opt-out retains the existing route without cross-agent evidence

- [x] RED ce5937c9e
- [x] GREEN 41e4f292d
- [x] REFACTOR skip: the opt-out is a single early policy return before any packet or process work

### Scenario: An explicit opt-out cannot satisfy hard cross-agent enforcement

- [x] RED b90d16f26
- [ ] GREEN
- [ ] REFACTOR

## Rule: cross-agent-review.SWM1.R3 — Non-class-1 work retains its existing routing

### Scenario Outline: Excluded reviewer classes do not enter the cross-agent coordinator

- [x] RED skip: class-2, class-3, TDD, and refactor routes predated the coordinator and the new negative parity table guards that boundary
- [x] GREEN 791b5f3cd
- [x] REFACTOR skip: exclusions remain declarative rows in the same parity test without production routing changes

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario
