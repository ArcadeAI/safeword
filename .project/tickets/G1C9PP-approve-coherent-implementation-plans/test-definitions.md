# Test Definitions: Approve coherent Implementation Plans

Feature source: `features/approve-coherent-implementation-plans.feature`

test-definitions.md is the R/G/R ledger.

Proof boundary: every untagged semantic scenario must derive its verdict from
the exact packaged Implementation Plan contract bytes through the deterministic
contract-conformance reviewer boundary. A per-scenario scripted verdict cannot
satisfy RED or GREEN. Scenarios tagged `@surface.safeword-cli` additionally
prove real installed CLI wiring.

## Rule: plan-implementability.TBU1.G1C9PP.R1 — Implementation Planning is a distinct approach-decision phase

## Scenario: Safeword CLI enforces and releases the decision boundary

- [x] RED d847b78da
- [x] GREEN 828d8af75
- [x] REFACTOR skip: gate wiring and decision parsing are already minimal

## Rule: plan-implementability.TBU1.G1C9PP.R2 — Authors and reviewers use one decision-quality contract

### Scenario: Contract agreement controls review eligibility

- [x] RED 50004d6fe
- [x] GREEN 5f6201106
- [x] REFACTOR skip: contract comparison is isolated and introduces no duplicated production path

## Rule: plan-implementability.TBU1.G1C9PP.R3 — The plan opens with an architecture-at-a-glance mental model and keeps decision-bearing detail in the main review path without becoming an execution or evidence manual

## Scenario: Decision presentation controls focused reviewability

- [x] RED 57a353172
- [x] GREEN b59f684be
- [x] REFACTOR skip: the focused-review obligation is one canonical clause with generated mirrors and no duplicated production path

## Rule: plan-implementability.TBU1.G1C9PP.R4 — The Implementation Plan is a project-local reviewed artifact

### Scenario: Safeword CLI accepts only the project-local Implementation Plan

- [x] RED b59d6f7b9
- [x] GREEN 2722ee208
- [x] REFACTOR skip: the authority check is one public-command boundary with no duplicated production path

### Scenario: A divergent host-private copy never becomes authoritative

- [x] RED 4f168b359
- [x] GREEN 2722ee208
- [x] REFACTOR skip: the scenario reuses the same single authority boundary and packet capture path

## Rule: plan-implementability.TBU1.G1C9PP.R5 — Architecture applicability is explicit

### Scenario: Architecture applicability accepts consequences or a justified skip

- [x] RED 61636f429
- [x] GREEN 5b00d9413
- [x] REFACTOR skip: one rubric clause and one authoring prompt express the applicability rule without a new parser or abstraction

## Rule: plan-implementability.TBU1.G1C9PP.R6 — Applicable data decisions cover purpose, store and model, schema and relationships, source of truth, ownership and access, identity and integrity, cross-system flow, lifecycle and retention, migration and backfill, compliance, and rollback at decision depth

### Scenario: Data guidance follows data-contract applicability

- [x] RED 23abfdefc
- [x] GREEN 6e58244f2
- [x] REFACTOR skip: the field list is one review obligation mirrored once in the authoring template, with no production parser added

### Scenario: Data decisions cannot be replaced by migration commands

- [x] RED c642b9967
- [x] GREEN 80e39608d
- [x] REFACTOR 790f3be0e

## Rule: plan-implementability.TBU1.G1C9PP.R7 — Significant decisions also enter the durable architecture record

### Scenario: Durable recording routes only significant decisions to the architecture record

- [x] RED ca18e79a6
- [x] GREEN d2084c8c0
- [x] REFACTOR 0379b57e3

### Scenario: An unrecorded significant decision blocks approval

- [x] RED 37d445eb2
- [x] GREEN 8504f326d
- [x] REFACTOR b58e82d6f

### Scenario: Planning access permits only the configured durable architecture record

- [x] RED a6dd169da
- [x] GREEN 6c3fbeb00
- [x] REFACTOR 9056971a8

## Rule: plan-implementability.TBU1.G1C9PP.R8 — Architectural significance uses semantic triggers

### Scenario: A one-file shared contract is significant while a many-file mechanical edit is not

- [x] RED 9410f11e6
- [x] GREEN 6c7040887
- [x] REFACTOR f76c9d7e4

## Rule: plan-implementability.TBU1.G1C9PP.R9 — One feature has one design plan of record

### Scenario: One design plan remains the feature plan of record

- [x] RED c572e44ab
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R10 — Implementation planning chooses proof scope and confidence without absorbing execution mechanics or the verification ledger

### Scenario: Proof scope excludes execution mechanics

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R11 — Behavior-shaping decisions cannot leak into execution planning

### Scenario: Decision resolution controls its Implementation Plan obligation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed review reports every simultaneous decision blocker

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R12 — Load-bearing choices carry alternatives and evidence

### Scenario: Decision evidence controls semantic review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R13 — Decision evidence is structurally present and semantically judged

### Scenario: Evidence fields accept honest applicability without allowing empty decision coverage

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Evidence presentation does not replace evidence completeness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R14 — Decision discovery is scope-bounded and covers the consequential trust, operation, approval, and recovery needs of every accepted persona

### Scenario: Discovery respects and updates scope only with user authority

Proof limit: the accepting scope-expansion row exercises the consumer contract
with fixture-minted authority. Sibling `5F5ZZA` owns authentic host-user-event
provenance and the end-to-end positive proof; this scenario cannot satisfy that
release prerequisite by itself.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Persona consequence coverage controls approach approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Omitting one accepted persona blocks approach approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R15 — Review receipts expose decision reviewability and concrete recovery

### Scenario: The receipt records the focused-review judgment

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocked receipt gives a Non-Technical Builder a concrete recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocked receipt preserves evidence for a Technical Builder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R16 — When planning and implementation states coexist, the plan distinguishes proposed decisions, implemented facts, available proof, known defects, and pending human authority without treating one as another

### Scenario: Plan-state claims remain truthful

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R17 — Significant concurrency, security, durability, lifecycle, migration, and compatibility choices include the applicable state, authority, atomicity, retry, and evidence model at decision depth

### Scenario: Significant workflow decisions are complete at decision depth

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R18 — Accepted quantitative promises carry a design-level measurement contract without moving Product-owned outcomes or Execution-owned instrumentation into the Implementation Plan

### Scenario: Measurement detail stays with the phase that owns it

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R19 — The existing optional human design approval binds the exact semantically reviewed Implementation Plan before Execution Planning; unchanged approach bytes reuse that approval, changed approach bytes require a new decision, approval is not duplicated after the Execution Plan, and headless work records pending authority without deadlocking or claiming approval

### Scenario: Installed CLI human design authority follows configuration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A declined design returns to Implementation Planning

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Human design authority follows approach currency

Proof limit: this scenario proves only whether human design approval still
binds the exact current approach bytes. Sibling `5F5ZZA` owns semantic review
record invalidation, provenance changes, and context-digest recomputation.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A completed Execution Plan does not trigger a second design approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A completed Execution Plan cannot preserve stale design approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU1.G1C9PP.R20 — An incomplete or incorrect plan returns to decision discovery with the full current set of blocking defects and is corrected and re-reviewed on its new exact bytes until complete and correct or honestly waiting on an external decision

### Scenario: Review repairs every known plan defect before execution planning

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: External authority pauses repair without disguising the plan as complete

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every corrected plan is re-reviewed until its current bytes are clean

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
