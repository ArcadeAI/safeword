# Test Definitions: Turn accepted decisions into startable work

Feature source: `features/turn-decisions-into-startable-work.feature`

test-definitions.md is the R/G/R ledger.

## Rule: plan-implementability.TBU2.7CAMAD.R1 — Execution Planning requires a reviewed current approach

### Scenario: Implementation Plan review state controls Execution Planning

- [x] RED 5d2aa327f
- [x] GREEN 88efda591
- [x] REFACTOR skip: production path already delegates to the shared review authority

### Scenario: Review routes preserve their actual provenance

- [x] RED 5d2aa327f
- [x] GREEN 88efda591
- [x] REFACTOR skip: fallback provenance already uses the canonical authenticated receipt

### Scenario: An unearned fallback receipt cannot authorize planning

- [x] RED 5d2aa327f
- [x] GREEN 88efda591
- [x] REFACTOR skip: rejection shares the existing authenticated review decision path

### Scenario: A self-authored independence claim cannot authorize planning

- [x] RED 5d2aa327f
- [x] GREEN 88efda591
- [x] REFACTOR skip: self-claim rejection already shares the canonical provenance check

## Rule: plan-implementability.TBU2.7CAMAD.R2 — Every execution step is startable without inventing a contract

### Scenario: A fresh-context agent turns an accepted approach into the first RED

- [x] RED 39163e735
- Structural support only; the later journey commits supply the actor-boundary
  proof.
- [x] RED 265496503
- The first installed-CLI journey reached semantic review but did not exercise
  the complete phase-entry, production-edit denial, RED execution, and ledger
  path.
- [x] RED 6d08a5cd7
- The complete journey blocked the production edit before RED, but did not
  prove that recording the observed failure releases that same edit.
- [x] RED 7380ff209
- [x] GREEN 3936a7d0b
- [x] REFACTOR d86fd1745

### Scenario: A later unstartable step blocks an otherwise startable plan

- [x] RED skip: live — see work log 2026-09-19T08:43:10.000Z "later-step implementability"
- [x] GREEN 7a9e321b8
- [x] REFACTOR skip: corpus case, live admission, and installed-CLI assertion already share the canonical review path

### Scenario: First-step availability and ordering control startability

- [x] RED skip: live — see work log 2026-09-19T10:14:00.000Z "first-step ordering"
- [x] GREEN e8d7cf539
- [x] REFACTOR skip: fixtures already share the existing plan builder and each slice keeps one proof-aligned purpose

## Rule: plan-implementability.TBU2.7CAMAD.R3 — Authors and reviewers use one implementability contract

### Scenario: Review-contract identity controls semantic approval

- [x] RED bb2bf5c8d
- [x] GREEN b5ddd8b22
- [x] REFACTOR skip: canonical identity logic is isolated in one focused helper and shares the existing generator and reconciliation paths

## Rule: plan-implementability.TBU2.7CAMAD.R4 — Execution discoveries return to the owning phase

### Scenario: A discovered change returns only when it alters an accepted decision

- [x] RED skip: live — see work log 2026-09-19T12:52:03.000Z "discovery routing"
- [x] GREEN f7a05dc4a
- [x] REFACTOR skip: typed destination parsing and phase mutation already have single focused owners

## Rule: plan-implementability.TBU2.7CAMAD.R5 — The Execution Plan is a project-local reviewed artifact

### Scenario: Project-local Execution Plan state controls coding authorization

- [x] RED 86cda081d
- [x] GREEN 153b78709
- [x] REFACTOR skip: production path is already a thin projection over the shared prerequisite evaluator

### Scenario: A missing project-local plan names the project-local artifact to create

- [x] RED 86cda081d
- [x] GREEN 153b78709
- [x] REFACTOR skip: recovery is already emitted by the shared prerequisite owner

## Rule: plan-implementability.TBU2.7CAMAD.R6 — Semantic review detects disguised unresolved decisions

### Scenario: Decision specificity controls semantic approval

- [x] RED skip: live Claude review evidence recorded at 2026-09-19T13:41:10.000Z
- [x] RED skip: live — corrected durable reference to the same 2026-09-19T13:41:10.000Z evidence
- [x] RED skip: live — work log 2026-09-19T13:41:10.000Z
- [x] GREEN 0c5f1a6ce
- [x] REFACTOR skip: conformance fixtures already share the complete-plan builder

## Rule: plan-implementability.TBU2.7CAMAD.R7 — Structural gates report facts rather than semantic quality

### Scenario: The structural gate reports artifact facts without a semantic verdict

- [x] RED 82e8137ba
- [x] GREEN 9a433ff6a
- [x] REFACTOR skip: the GREEN already isolates reading, fact projection, and review-result mapping

## Rule: plan-implementability.TBU2.7CAMAD.R8 — Accepted proof strategies become exact test work

### Scenario: Concrete proof content controls test-step startability

- [x] RED 364f45b50
- [x] GREEN 760aafbe9
- [x] REFACTOR skip: canonical generator and shared corpus builder already keep the change minimal

## Rule: plan-implementability.TBU2.7CAMAD.R9 — Coding requires a reviewed current Execution Plan

### Scenario: Execution Plan currency controls coding authorization

- [x] RED 7cead12f6
- [x] GREEN 153b78709
- [x] REFACTOR skip: currency is already enforced by content-bound review admission

### Scenario: Execution Plan verdict and recorded assurance control coding authorization

- [x] RED ef18bc398
- [x] GREEN d7dc1b100
- [x] REFACTOR 4ca3c4422

## Rule: plan-implementability.TBU2.7CAMAD.R10 — Every accepted obligation maps to startable work

### Scenario: Every accepted obligation must map to startable work

- [x] RED skip: live — see work log 2026-09-19T21:26:06.000Z "R10 obligation mapping matrix"
- [x] GREEN 45bcf2227
- [x] REFACTOR skip: canonical fixture builder and generated rubric already share one contract path

### Scenario: Partial obligation mapping is not startable

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Complete obligation mapping permits semantic approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Explicitly inapplicable obligations do not manufacture execution work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.7CAMAD.R11 — Execution Planning supplies rather than replaces TDD

### Scenario: An execution step still proceeds through RED GREEN and REFACTOR

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Production code cannot precede the named RED

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.7CAMAD.R15 — Accepted measurement decisions become concrete instrumentation, test, and evidence-collection work without redefining the upstream promise or validity contract

### Scenario: Measurement execution preserves the accepted promise and validity contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.7CAMAD.R16 — Changing load-bearing behavior or scope invalidates both plan reviews, changing the accepted Implementation Plan invalidates both plan reviews, and changing only the Execution Plan invalidates only its own review

### Scenario: Review invalidation follows dependency direction

- [x] RED d25df2ea7
- [x] GREEN 2d41c4802
- [x] REFACTOR 33955c24c

### Scenario: An Execution Plan cannot stay current after its source approach changes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.7CAMAD.R17 — A design-changing implementation decision returns through revised and re-reviewed Implementation and Execution Plans, while a sequencing-only decision returns through a revised and re-reviewed Execution Plan; both paths preserve still-valid work and evidence and resume from the first invalidated obligation

### Scenario: Implementation-time replanning preserves valid progress and refreshes the affected plans

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Replanning reopens proof invalidated by the changed decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Implementation cannot continue under a stale affected plan

- [x] RED d65d37e28
- [x] GREEN 719486201
- [x] REFACTOR 2fbec3997

## Rule: plan-implementability.TBU2.7CAMAD.R12 — The Execution Plan distinguishes current implementation from target work and uses the canonical evidence-currency taxonomy owned by A639WN.R7

### Scenario: Evidence state controls the delivery claim

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Delivery evidence uses the canonical checklist taxonomy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Canonical delivery-contract identity prevents local contract drift

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Partial structural evidence cannot authorize completion

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.7CAMAD.R13 — The Execution Plan carries the feature Delivery Checklist and maps accepted obligations into dependency-ordered tasks and independently reviewable pull-request slices under the sibling checklist and slicing contracts

### Scenario: The Execution Plan maps delivery obligations into owned review units

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Canonical slicing-contract identity prevents local contract drift

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Contribution shape controls pull-request decomposition

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A complete-looking task list cannot leave delivery obligations unowned

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU2.7CAMAD.R14 — Execution Plan approval establishes only that delivery is startable and provable without a new behavior-shaping decision; it does not claim implementation, verification, human release approval, or merge authority

### Scenario: Execution approval cannot impersonate a downstream approval

- [x] RED 53d2c247e
- [x] GREEN 91aba5c13
- [x] REFACTOR skip: the public command is already a closed, thin projection over the shared prerequisite evaluator

## Feature-level cross-scenario refactor

- [x] cross-scenario 1731c2959
