# Test Definitions: Keep failed reviews out of benchmark scores

Feature source: `features/reject-incomplete-evaluation-trials.feature`

test-definitions.md is the R/G/R ledger.

## Rule: pr-review-eval.SWM1.R1 — Only positively complete trials are scoreable

### Scenario: A completed reviewer finding is usable

- [ ] RED
- [x] GREEN 130a8ccbf
- [x] REFACTOR skip: the positive finding shape is a direct classifier fixture

### Scenario: A completed reviewer may return multiple findings

- [ ] RED
- [x] GREEN 130a8ccbf
- [x] REFACTOR skip: the same finding-shape predicate accepts any non-empty valid collection

### Scenario: A completed reviewer may explicitly find nothing

- [ ] RED
- [x] GREEN 130a8ccbf
- [x] REFACTOR skip: the explicit empty collection uses the same positive classifier path

### Scenario Outline: Hidden completion failures are unusable

- [x] RED 640c3bf11
- [x] GREEN 2145bb94f
- [x] REFACTOR skip: classifier partitions and adapter provenance remain single-purpose with no structural duplication to remove

### Scenario Outline: Positive completion evidence cannot be inferred

- [x] RED d6e1c25ad
- [x] GREEN 7f16dffb1
- [x] REFACTOR skip: terminal-state emission and positive admission checks are already single-purpose and linear

### Scenario Outline: Every scorer-consumed field is validated before admission

- [x] RED 32c2b0a28
- [x] GREEN b20381597
- [x] REFACTOR skip: one finding-shape predicate covers every scorer-consumed collection

### Scenario Outline: Frozen reviewer routing cannot drift

- [x] RED f948a4a36
- [x] GREEN 0aa2de93a
- [x] REFACTOR skip: one route tuple binds expert, provider, and model in both model and outcome evidence

### Scenario Outline: Every emitted reviewer outcome must match the frozen route

- [x] RED 8eb575194
- [x] GREEN 8eb31e5ca
- [x] REFACTOR skip: one exact route-set check rejects both missing and additional outcomes

### Scenario Outline: Scored finding views agree with the routed reviewer output

- [x] RED 8eb575194
- [x] GREEN 8eb31e5ca
- [x] REFACTOR 47712ea29

### Scenario: Matching scored finding views are admitted

- [ ] RED
- [x] GREEN 2145bb94f
- [x] REFACTOR skip: the positive path uses the same finding-consistency predicate as the rejection path

## Rule: pr-review-eval.SWM1.R2 — Failure handling preserves paired experimental validity

### Scenario Outline: One retryable transport failure is retried once

- [x] RED b2670c4dc
- [x] GREEN 1cfb1e9e3
- [x] REFACTOR skip: the walking skeleton keeps locking, durable writes, and sealing in one cohesive ticket-local module

### Scenario Outline: A second retryable transport failure excludes the paired case

- [x] RED c03099d0d
- [x] GREEN 8cb41393a
- [x] REFACTOR skip: quarantine sealing and durable reserve allocation form one ordered crash-safety transition with no duplication worth extracting

### Feature-level cross-scenario refactor

- [x] cross-scenario b56a58045

### Scenario Outline: A non-infrastructure failure gets no silent retry

- [x] RED 6a5ff56e0
- [x] GREEN bf4b85235
- [x] REFACTOR skip: the coordinator has one ordered responsibility and reuses the existing retry, attempt-write, and quarantine primitives

### Scenario: Paired-case quarantine is atomic

- [ ] RED
- [x] GREEN c0e9f9512
- [x] REFACTOR skip: one case-directory rename keeps every sibling on the same side of the scoring boundary

### Scenario: A thrown semantic provider failure quarantines without retry

- [x] RED f948a4a36
- [x] GREEN 0aa2de93a
- [x] REFACTOR skip: one thrown-disposition mapper keeps semantic and infrastructure exception handling disjoint

### Scenario: An early failure cancels pending paired work

- [ ] RED
- [x] GREEN c0e9f9512
- [x] REFACTOR skip: the sequential work loop exits immediately after the quarantine transition

### Scenario: A retryable failure followed by a semantic failure ends the pair

- [ ] RED
- [x] GREEN c0e9f9512
- [x] REFACTOR skip: one retry loop already terminates on the second attempt's semantic disposition

### Scenario: Frozen reserves are selected deterministically

- [x] RED 473dbe7d1
- [x] GREEN 110a239b3
- [x] REFACTOR skip: one ordered effective-case list directly models chained reserve replacement

### Scenario: A process crash does not strand the run lock

- [x] RED 751aaf339
- [x] GREEN c6c15a9d5
- [x] REFACTOR skip: ownership probing and recovery ordering are already isolated helpers

### Scenario: Contending restarts cannot both reclaim one stale lock

- [x] RED 473dbe7d1
- [x] GREEN 110a239b3
- [x] REFACTOR skip: candidate publication and stale reclamation are already separate atomic rename steps

### Scenario Outline: Ambiguous lock ownership fails closed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed durable write does not poison the next write

- [x] RED 32c2b0a28
- [x] GREEN b20381597
- [x] REFACTOR skip: unique temporary names and one cleanup path keep the writer linear

### Scenario Outline: Injected crashes exercise the durable quarantine transaction

- [x] RED 779847571
- [x] GREEN 665898cbe
- [x] REFACTOR skip: the optional failure callback is a test seam with no production branching

### Scenario: Recovery preserves failed-attempt evidence and cost

- [x] RED 183420791
- [x] GREEN a90b2edd3
- [x] REFACTOR skip: recovery exposes one typed evidence callback and keeps accounting policy in the live runner

### Scenario: Missing usage cannot bypass quarantine or authorize more spend

- [x] RED ca0993b71
- [x] GREEN 94d3cc83e
- [x] REFACTOR skip: one tolerant extractor carries completeness beside known cost and the loop consumes that state

### Scenario: An unclassified thrown attempt is not assumed to be free

- [x] RED bad6d0a87
- [x] GREEN 821d371ed
- [x] REFACTOR skip: null output is represented by the same completeness bit consumed by the spend loop

### Scenario Outline: Interrupted quarantine is never partially scoreable

- [x] RED f7b7d089b
- [x] GREEN b39d3c7b5
- [x] REFACTOR skip: concrete pre-rename and post-rename faults cover the only observable atomic-move boundaries

### Scenario: Reserve exhaustion stops the run

- [ ] RED
- [x] GREEN c0e9f9512
- [x] REFACTOR skip: the terminal no-reserve path reuses the same durable whole-case quarantine and accounting boundary

## Rule: pr-review-eval.SWM1.R3 — Scoring derives validity from admitted records

### Scenario: A complete run is scoreable

- [x] RED e2f3fdfda
- [x] GREEN 251bde01d
- [x] REFACTOR c230e01c4

### Scenario Outline: A structurally incomplete paired case is not scoreable

- [x] RED e2f3fdfda
- [x] GREEN 251bde01d
- [x] REFACTOR skip: table-driven partitions already share the production matrix validator

### Scenario: Validity gates change when admitted evidence changes

- [x] RED e2f3fdfda
- [x] GREEN 251bde01d
- [x] REFACTOR c230e01c4

### Scenario Outline: Invalid finding verification cannot change a score

- [x] RED baff4f129
- [x] GREEN 9f8db4b55
- [x] REFACTOR skip: one validator owns shape, vocabulary, uniqueness, and scoreable-key checks

### Scenario: Matching contamination evidence belongs to its frozen run

- [x] RED baff4f129
- [x] GREEN 9f8db4b55
- [x] REFACTOR skip: one binding module owns digest and identity checks used by the scorer

### Scenario Outline: Mismatched contamination evidence stops scoring

- [x] RED baff4f129
- [x] GREEN 9f8db4b55
- [x] REFACTOR skip: the same binding module rejects every byte and identity mismatch

### Scenario: Finding verification belongs to one system trial

- [x] RED ca0993b71
- [x] GREEN 94d3cc83e
- [x] REFACTOR skip: one evidence identity key includes every scored record dimension

## Rule: pr-review-eval.SWM1.R4 — A paid canary gates larger spend

### Scenario: The no-cost fixture inventory is independently checkable

- [x] RED a7d8259d1
- [x] GREEN 47d0ed48c
- [x] REFACTOR skip: one exact taxonomy validator rejects missing, extra, or duplicate fixtures

### Scenario: Operational failure injection covers the R2 taxonomy

- [x] RED a7d8259d1
- [x] GREEN 47d0ed48c
- [x] REFACTOR skip: one exact taxonomy validator rejects missing, extra, duplicate, or failed operational records

### Scenario: The paid canary outcomes are independently checkable

- [x] RED a7d8259d1
- [x] GREEN 47d0ed48c
- [x] REFACTOR skip: one individual-outcome loop validates identity, coverage, label, provenance, and cost

### Scenario: A hidden provider failure is rejected through real wiring

- [x] RED 217916be9
- [x] GREEN 8d29f64bd
- [x] REFACTOR skip: the production adapter, lifecycle writer, and scorer validator are composed directly

### Scenario: A successful reviewer matrix is scored through real wiring

- [ ] RED
- [x] GREEN f9c092874
- [x] REFACTOR skip: the fixture composes production boundaries without a new abstraction

### Scenario: The live entry point is exercised without provider spend

- [ ] RED
- [x] GREEN 0aa2de93a
- [x] REFACTOR skip: the process fixture shares one runner invocation helper across success, resume, and exclusion

### Scenario: The adapter checkout is explicit and commit-pinned

- [x] RED f948a4a36
- [x] GREEN 0aa2de93a
- [x] REFACTOR skip: runtime path resolution is isolated from immutable commit and clean-tree verification

### Scenario: Untracked adapter files invalidate the pinned collaborator

- [x] RED bad6d0a87
- [x] GREEN 821d371ed
- [x] REFACTOR skip: one clean-tree guard precedes dynamic import

### Scenario: Successful wiring advances durable run state

- [x] RED baff4f129
- [x] GREEN 9f8db4b55
- [x] REFACTOR skip: the shared commit helper preserves the record-before-state ordering without duplicating it

### Scenario Outline: The aggregate cost stop is enforced at its exact boundary

- [x] RED baff4f129
- [x] GREEN 9f8db4b55
- [x] REFACTOR skip: the renamed frozen field states the existing post-attempt behavior directly

### Scenario: A clean canary authorizes the next checkpoint

- [x] RED a7d8259d1
- [x] GREEN 47d0ed48c
- [x] REFACTOR skip: one decision object carries the bound next checkpoint and complete evidence result

### Scenario Outline: A canary prerequisite defect blocks more spend

- [x] RED a7d8259d1
- [x] GREEN 47d0ed48c
- [x] REFACTOR skip: the same paid-outcome predicate adds a call-specific blocking reason

### Scenario: One canary label disagreement blocks more spend

- [x] RED a7d8259d1
- [x] GREEN 47d0ed48c
- [x] REFACTOR skip: the same paid-outcome predicate compares each frozen and observed label

### Scenario: Total cost includes every attempt

- [x] RED a7d8259d1
- [x] GREEN 47d0ed48c
- [x] REFACTOR skip: one attempt ledger computes total and usable cost separately

### Scenario Outline: Incomplete canary cost data blocks more spend

- [x] RED a7d8259d1
- [x] GREEN 47d0ed48c
- [x] REFACTOR skip: one finite completeness predicate covers attempt and usage-derived cost

## Rule: pr-review-eval.SWM1.R5 — Raw evidence and corpus roles cannot drift

### Scenario: Frozen raw artifacts can be reused

- [x] RED d6d054141
- [x] GREEN d832b5ba1
- [x] REFACTOR skip: one verifier returns only bytes read after identity, type, and digest validation

### Scenario Outline: Drifted raw evidence cannot be reused

- [x] RED d6d054141
- [x] GREEN d832b5ba1
- [x] REFACTOR skip: one manifest walk rejects unsafe identity, inventory, type, timing, and digest drift

### Scenario: The void corpus cannot confirm or tune the replacement scorer

- [x] RED d6d054141
- [x] GREEN d832b5ba1
- [x] REFACTOR skip: one corpus-role guard rejects any instrument-void confirmatory input

### Scenario: Confirmatory estimates use a fresh holdout

- [x] RED d6d054141
- [x] GREEN d832b5ba1
- [x] REFACTOR skip: one corpus-role guard requires disjoint, preregistered, powered cases and reserves

### Scenario Outline: Invalid holdout construction cannot produce confirmatory estimates

- [x] RED d6d054141
- [x] GREEN d832b5ba1
- [x] REFACTOR skip: the same guard reports every holdout construction defect before analysis
