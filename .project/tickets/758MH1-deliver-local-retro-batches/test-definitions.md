# Test Definitions: Deliver every eligible local retro finding in one bounded batch

Feature source: `features/deliver-local-retro-batches.feature`

test-definitions.md is the R/G/R ledger.

## Rule: deliver-local-retro-batches.SWM1.R1 — Every valid sanitized finding from one local session is recorded in original order as one bounded submission

### Scenario: Every local carrier submits multiple findings as one ordered batch

- [x] RED 9a5166e9c
- [x] GREEN e05294490
- [x] REFACTOR skip: first slice is the minimal shared batch handoff; cross-scenario cleanup follows after collector compatibility

### Scenario: One finding uses the same batch contract

- [x] RED skip: the generalized builder landed with the first slice; characterization is recorded at e1cd398e5
- [x] GREEN e05294490
- [x] REFACTOR skip: one and many findings intentionally share the same serializer

### Scenario: Invalid findings are excluded before a mixed batch leaves the project

- [x] RED skip: validity partitioning predates this slice; mixed-batch characterization is recorded at 88037dc17
- [x] GREEN 88037dc17
- [x] REFACTOR skip: the existing prepareEncounters partition remains the single filter

### Scenario: No valid findings make no public attempt

- [x] RED skip: all-invalid suppression predates this slice; characterization is recorded at 88037dc17
- [x] GREEN 88037dc17
- [x] REFACTOR skip: no additional branch was needed

### Scenario: A request exactly at the shared byte limit is accepted whole

- [x] RED skip: the shared size guard predates batching; exact v2 characterization is recorded at 710bdc323
- [x] GREEN 710bdc323
- [x] REFACTOR skip: byte measurement remains centralized in preparePublicRetroRequest

### Scenario: An oversized request makes no partial public attempt

- [x] RED skip: the shared size guard predates batching; above-limit v2 characterization is recorded at 710bdc323
- [x] GREEN 710bdc323
- [x] REFACTOR skip: whole-request abandonment reuses the existing guard

## Rule: deliver-local-retro-batches.SWM1.R2 — Released single-finding senders and new batch senders share one exact collector boundary without weakening raw-body duplicate authority

### Scenario: The shipped local batch crosses the real collector boundary unchanged

- [x] RED skip: the lifecycle seam already existed; the batch collaborator proof is recorded at e0925b601
- [x] GREEN e0925b601
- [x] REFACTOR skip: the existing real-collaborator outline covers all three harnesses

### Scenario: Released v1 and exact v2 requests are both accepted

- [x] RED f18595c5a
- [x] GREEN bd323ba88
- [x] REFACTOR skip: one version predicate keeps the strict schemas adjacent

### Scenario: Byte-identical replay in one session scope reuses the durable receipt

- [x] RED 0c01b71fb
- [x] GREEN 469e6a213
- [x] REFACTOR skip: raw BLOB comparison is the smallest durable authority

### Scenario: Identical bytes in a different session scope receive a distinct receipt

- [x] RED skip: distinct-scope acceptance was already covered by the collector matrix
- [x] GREEN 469e6a213
- [x] REFACTOR skip: the existing unique session_scope boundary remains unchanged

### Scenario: Unequal raw bytes in one session scope remain a conflict

- [x] RED skip: unequal-byte conflict was already covered by the collector matrix
- [x] GREEN 469e6a213
- [x] REFACTOR skip: equal and unequal raw bytes share one comparison point

### Scenario: A v2 batch cannot replace a v1 submission in the same session scope

- [x] RED skip: the strict version schemas made this conflict green immediately; proof is recorded at 92b602ecd
- [x] GREEN 92b602ecd
- [x] REFACTOR skip: cross-version conflict uses the normal raw-byte rule

### Scenario: Invalid v2 envelopes are rejected before storage

- [x] RED skip: strict v2 validation landed with collector acceptance; malformed matrix is recorded at 92b602ecd
- [x] GREEN 92b602ecd
- [x] REFACTOR skip: table-driven malformed cases avoid duplicated setup

### Scenario: The collector enforces the shared whole-request byte limit

- [x] RED skip: the shared reader limit predates v2; v1/v2 boundary characterization is recorded at 5d29703e8
- [x] GREEN 5d29703e8
- [x] REFACTOR skip: both versions use the same raw request reader

## Rule: deliver-local-retro-batches.NTB1.R1 — Public acceptance failure timeout opt-out invalid input and oversize never block completion or consume private recovery

### Scenario: Public acceptance preserves private recovery silently

- [x] RED skip: private-first ordering predates this slice and remains covered by command tests
- [x] GREEN e1cd398e5
- [x] REFACTOR skip: batching did not alter private recovery ordering

### Scenario: Opt-out preserves private recovery silently

- [x] RED skip: opt-out behavior predates this slice and is exercised by the lifecycle outline
- [x] GREEN e0925b601
- [x] REFACTOR skip: no opt-out path changed

### Scenario: Oversize preserves private recovery silently

- [x] RED skip: oversize recovery predates this slice; exact v2 size proof is recorded at 710bdc323
- [x] GREEN 710bdc323
- [x] REFACTOR skip: the existing silent abandonment path is reused

### Scenario: Public collector outcomes preserve private recovery silently

- [x] RED skip: collector refusal and malformed-response fault tests predate batching and were migrated at e1cd398e5
- [x] GREEN e1cd398e5
- [x] REFACTOR skip: all collector outcomes remain inside one silent boundary

### Scenario: A collector timeout preserves private recovery silently

- [x] RED skip: the controlled timeout test predates batching and was migrated at e1cd398e5
- [x] GREEN e1cd398e5
- [x] REFACTOR skip: the existing abort deadline remains the only timer

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: review found one coherent serializer, one parser predicate, and one raw-byte store comparison; extraction, transport, and recovery seams remain appropriately separate
